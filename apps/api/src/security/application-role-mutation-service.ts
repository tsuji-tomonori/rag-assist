import {
  APPLICATION_ROLES,
  ROLE_CATALOG_VERSION,
  isApplicationRole,
  type ApplicationRole
} from "@memorag-mvp/contract/access-control"
import type { UserDirectory } from "../adapters/user-directory.js"
import type { ObjectStore } from "../adapters/object-store.js"
import type { ServerManagedIdentity, VerifiedIdentityProvider } from "../adapters/verified-identity-provider.js"
import type { AppUser } from "../auth.js"
import { hasPermission } from "../authorization.js"
import type {
  SecurityMutationAuditIntent,
  SecurityMutationAuditOutboxPort,
  SecurityMutationResult
} from "./security-mutation-audit-outbox.js"
import {
  ObjectStoreRevocationCleanupCoordinator,
  type RegisterRevocationCleanupInput
} from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import {
  ObjectStoreRevocationCleanupRepairOutbox,
  type RevocationCleanupRepairIntent
} from "../rag/_shared/security/revocation-cleanup-repair-outbox.js"
import {
  ApplicationRoleMutationLockConflictError,
  ApplicationRoleMutationRecoveryRequiredError,
  ObjectStoreApplicationRoleMutationLock,
  type ApplicationRoleMutationLease,
  type ApplicationRoleMutationLockRecord
} from "./application-role-mutation-lock.js"

export const APPLICATION_ROLE_MUTATION_POLICY_VERSION = "application-role-mutation-v1" as const

export type ReplaceApplicationRolesInput = Readonly<{
  actor: AppUser
  targetUserId: string
  roles: readonly string[]
  reason: string
  commitManagedState: (input: {
    target: ServerManagedIdentity
    beforeRoles: readonly ApplicationRole[]
    afterRoles: readonly ApplicationRole[]
  }) => Promise<void>
}>

export type ApplicationRoleMutationResult = Readonly<{
  target: ServerManagedIdentity
  beforeRoles: readonly ApplicationRole[]
  afterRoles: readonly ApplicationRole[]
  auditIntentId: string
}>

export class ApplicationRoleMutationError extends Error {
  constructor(
    message: string,
    readonly result: Exclude<SecurityMutationResult, "success">
  ) {
    super(message)
    this.name = "ApplicationRoleMutationError"
  }
}

export class ApplicationRoleMutationService {
  private readonly mutationLock: ObjectStoreApplicationRoleMutationLock

  constructor(private readonly deps: {
    identityProvider: VerifiedIdentityProvider
    userDirectory: Pick<UserDirectory, "listUsers" | "replaceApplicationRoles" | "revokeSessions">
    objectStore: ObjectStore
    auditOutbox: SecurityMutationAuditOutboxPort
    cleanupCoordinator?: Pick<ObjectStoreRevocationCleanupCoordinator, "register">
    now?: () => Date
    lockLeaseDurationMs?: number
  }) {
    this.mutationLock = new ObjectStoreApplicationRoleMutationLock(
      deps.objectStore,
      deps.now,
      deps.lockLeaseDurationMs
    )
  }

  async replaceRoles(input: ReplaceApplicationRolesInput): Promise<ApplicationRoleMutationResult> {
    let actorIdentity: ServerManagedIdentity | undefined
    let target: ServerManagedIdentity | undefined
    try {
      ;[actorIdentity, target] = await Promise.all([
        this.resolveIdentity(input.actor.userId),
        this.resolveIdentity(input.targetUserId)
      ])
    } catch (error) {
      await this.recordEarlyFailure(input, "failed")
      throw normalizeMutationError(error, "failed")
    }
    if (!actorIdentity || !target) {
      await this.recordEarlyFailure(input, "denied")
      throw new ApplicationRoleMutationError("Actor or target principal is not authoritative", "denied")
    }
    const beforeRoles = canonicalRoles(target.cognitoGroups.filter(isApplicationRole))
    const auditIntent = await this.deps.auditOutbox.prepare({
      actorId: actorIdentity.userId,
      tenantId: target.tenantId,
      targetType: "applicationRolePrincipal",
      targetId: target.userId,
      operation: "applicationRole.replace",
      before: { roles: beforeRoles },
      proposedAfter: { roles: [...input.roles] },
      reason: canonicalAuditReason(input.reason),
      policyVersion: `${APPLICATION_ROLE_MUTATION_POLICY_VERSION}:${ROLE_CATALOG_VERSION}`
    })

    let afterRoles: ApplicationRole[]
    try {
      canonicalReason(input.reason)
      afterRoles = canonicalRoles(input.roles)
    } catch (error) {
      const mutationError = normalizeMutationError(error, "denied")
      await this.complete(auditIntent, mutationError.result, target, beforeRoles)
      throw mutationError
    }
    try {
      await this.validate(input.actor, actorIdentity, target, beforeRoles, afterRoles, false)
    } catch (error) {
      const mutationError = normalizeMutationError(error, "denied")
      await this.complete(auditIntent, mutationError.result, target, beforeRoles)
      throw mutationError
    }

    let lease: ApplicationRoleMutationLease
    try {
      lease = await this.acquireWithExpiredRecovery({
        tenantId: target.tenantId,
        operationId: `application-role:${auditIntent.intentId}`,
        auditIntentId: auditIntent.intentId,
        targetUserId: target.userId,
        targetUsername: target.username,
        expectedRoles: beforeRoles,
        desiredRoles: afterRoles
      })
    } catch (error) {
      const result = error instanceof ApplicationRoleMutationLockConflictError ? "conflict" : "failed"
      await this.complete(auditIntent, result, target, beforeRoles)
      throw normalizeMutationError(error, result)
    }

    try {
      const [lockedActor, lockedTarget] = await Promise.all([
        this.resolveIdentity(input.actor.userId),
        this.resolveIdentity(input.targetUserId)
      ])
      if (!lockedActor || !lockedTarget) {
        throw new ApplicationRoleMutationError("Actor or target principal disappeared while acquiring the mutation fence", "denied")
      }
      const lockedBeforeRoles = canonicalRoles(lockedTarget.cognitoGroups.filter(isApplicationRole))
      if (
        lockedTarget.tenantId !== target.tenantId ||
        lockedTarget.username !== target.username ||
        !sameRoleValues(lockedBeforeRoles, beforeRoles)
      ) throw new ApplicationRoleMutationError("Authoritative target roles changed before the fenced mutation", "conflict")
      actorIdentity = lockedActor
      target = lockedTarget
      await this.validate(input.actor, lockedActor, lockedTarget, lockedBeforeRoles, afterRoles)
    } catch (error) {
      const mutationError = normalizeMutationError(error, "failed")
      await this.complete(auditIntent, mutationError.result, target, beforeRoles)
      await this.mutationLock.release(lease)
      throw mutationError
    }

    if (!this.deps.userDirectory.revokeSessions || !this.deps.userDirectory.replaceApplicationRoles) {
      await this.complete(auditIntent, "failed", target, beforeRoles)
      await this.mutationLock.release(lease)
      throw new ApplicationRoleMutationError("Authoritative fenced role mutation adapter is not configured", "failed")
    }

    const removedRoles = beforeRoles.filter((role) => !afterRoles.includes(role))
    const addedRoles = afterRoles.filter((role) => !beforeRoles.includes(role))
    const cleanupRepairOutbox = new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore)
    let cleanupRepair: RevocationCleanupRepairIntent | undefined
    try {
      if (addedRoles.length > 0) {
        await cleanupRepairOutbox.assertResourceFenceReleased(target.tenantId, "account", target.userId)
      }
      if (removedRoles.length > 0) {
        const preparedAt = (this.deps.now?.() ?? new Date()).toISOString()
        cleanupRepair = await cleanupRepairOutbox.prepare({
          expectedBeforeDenyVersion: roleStateVersion(beforeRoles),
          cleanupRegistration: applicationRoleCleanupRegistration({
            operationId: `application-role:${auditIntent.intentId}`,
            tenantId: target.tenantId,
            targetUserId: target.userId,
            targetUsername: target.username,
            removedRoles,
            afterRoles,
            deniedAt: preparedAt
          }),
          preparedAt
        })
      }
    } catch (error) {
      const mutationError = normalizeMutationError(error, "conflict")
      await this.complete(auditIntent, mutationError.result, target, beforeRoles)
      await this.mutationLock.release(lease)
      throw mutationError
    }

    let managedCommitStarted = false
    try {
      lease = await this.mutationLock.beginIdentityMutation(lease)
      const assertFence = async () => {
        lease = await this.mutationLock.renew(lease)
      }
      // Invalidate every pre-mutation token before changing current roles.
      await assertFence()
      await this.deps.userDirectory.revokeSessions(target.username)
      await this.deps.userDirectory.replaceApplicationRoles(target.username, {
        expectedRoles: beforeRoles,
        desiredRoles: afterRoles,
        operationId: lease.record.operationId,
        fencingToken: lease.record.fencingToken,
        assertFence
      })
      await assertFence()
      const verifiedAfter = await this.resolveIdentity(target.userId)
      if (!verifiedAfter || !sameRoles(verifiedAfter.cognitoGroups, afterRoles)) {
        throw new Error("Authoritative role set verification failed")
      }
      if (cleanupRepair) {
        cleanupRepair = await cleanupRepairOutbox.markDenyCommitted(
          cleanupRepair,
          (this.deps.now?.() ?? new Date()).toISOString()
        )
        const cleanupCoordinator = this.deps.cleanupCoordinator
          ?? new ObjectStoreRevocationCleanupCoordinator(this.deps.objectStore, this.deps.now)
        await cleanupCoordinator.register(cleanupRepair.cleanupRegistration)
        cleanupRepair = await cleanupRepairOutbox.markCleanupRegistered(
          cleanupRepair,
          (this.deps.now?.() ?? new Date()).toISOString()
        )
      }
      lease = await this.mutationLock.beginManagedCommit(lease)
      managedCommitStarted = true
      await input.commitManagedState({ target: verifiedAfter, beforeRoles, afterRoles })
      lease = await this.mutationLock.markManagedCommitted(lease)
      await this.complete(auditIntent, "success", verifiedAfter, afterRoles)
      await this.mutationLock.release(lease)
      return { target: verifiedAfter, beforeRoles, afterRoles, auditIntentId: auditIntent.intentId }
    } catch (error) {
      if (managedCommitStarted) {
        // Leave the managed-commit fence for deterministic reconciliation;
        // the callback may have committed before throwing, so rolling the IdP
        // back here could diverge from the managed ledger.
        throw normalizeMutationError(error, "failed")
      }
      const rollback = await this.rollbackUnderFence(target, beforeRoles, lease)
      lease = rollback.lease
      if (rollback.restored && cleanupRepair) {
        await (cleanupRepair.status === "cleanup_registered"
          ? cleanupRepairOutbox.markCleanupCompleted(cleanupRepair, (this.deps.now?.() ?? new Date()).toISOString())
          : cleanupRepairOutbox.markAbandoned(cleanupRepair, (this.deps.now?.() ?? new Date()).toISOString()))
      }
      const current = await this.resolveIdentityBestEffort(target.userId) ?? target
      const currentRoles = observedRoles(current.cognitoGroups)
      await this.complete(auditIntent, "failed", current, currentRoles)
      if (rollback.restored) await this.mutationLock.release(lease)
      const mutationError = normalizeMutationError(error, "failed")
      throw rollback.restored
        ? mutationError
        : new ApplicationRoleMutationError(`${mutationError.message}; authoritative role reconciliation is required`, "failed")
    }
  }

  private async validate(
    actorSnapshot: AppUser,
    actor: ServerManagedIdentity,
    target: ServerManagedIdentity,
    beforeRoles: readonly ApplicationRole[],
    afterRoles: readonly ApplicationRole[],
    validateRecoveryPrincipal = true
  ): Promise<void> {
    if (actor.accountStatus !== "active" || target.accountStatus !== "active") {
      throw new ApplicationRoleMutationError("Actor and target must be active", "denied")
    }
    if (
      actor.tenantId !== target.tenantId ||
      actorSnapshot.tenantId !== actor.tenantId ||
      actorSnapshot.userId !== actor.userId
    ) throw new ApplicationRoleMutationError("Actor and target must belong to the same authoritative tenant", "denied")

    const currentActor: AppUser = {
      userId: actor.userId,
      identityUsername: actor.username,
      email: actor.email,
      cognitoGroups: [...actor.cognitoGroups],
      accountStatus: actor.accountStatus,
      tenantId: actor.tenantId
    }
    if (!hasPermission(currentActor, "access:role:assign")) {
      throw new ApplicationRoleMutationError("Actor lacks role mutation permission", "denied")
    }
    // Self grant and self removal share one guard. A separate recovery workflow
    // is required for any administrator to alter their own authority.
    if (actor.userId === target.userId) {
      throw new ApplicationRoleMutationError("Self role mutation is forbidden", "denied")
    }
    if (afterRoles.includes("SYSTEM_ADMIN") && !actor.cognitoGroups.includes("SYSTEM_ADMIN")) {
      throw new ApplicationRoleMutationError("Only a system administrator can grant system recovery authority", "denied")
    }
    if (validateRecoveryPrincipal && beforeRoles.includes("SYSTEM_ADMIN") && !afterRoles.includes("SYSTEM_ADMIN")) {
      const candidateSnapshots = (await this.deps.userDirectory.listUsers()).filter((candidate) => (
        candidate.userId !== target.userId &&
        candidate.status === "active" &&
        candidate.groups.includes("SYSTEM_ADMIN")
      ))
      const otherRecoveryPrincipals: ServerManagedIdentity[] = []
      for (const candidate of candidateSnapshots) {
        const current = await this.resolveIdentity(candidate.userId)
        if (!current) {
          throw new ApplicationRoleMutationError("Authoritative recovery-principal lookup failed", "failed")
        }
        if (
          current.tenantId === target.tenantId &&
          current.accountStatus === "active" &&
          current.cognitoGroups.includes("SYSTEM_ADMIN")
        ) otherRecoveryPrincipals.push(current)
      }
      if (otherRecoveryPrincipals.length === 0) {
        throw new ApplicationRoleMutationError("The last administrative recovery principal cannot be removed", "denied")
      }
    }
  }

  private async resolveIdentity(subject: string): Promise<ServerManagedIdentity | undefined> {
    try {
      return await this.deps.identityProvider.getCurrentIdentityBySubject(subject)
    } catch {
      throw new ApplicationRoleMutationError("Authoritative identity lookup failed", "failed")
    }
  }

  private async resolveIdentityBestEffort(subject: string): Promise<ServerManagedIdentity | undefined> {
    try {
      return await this.deps.identityProvider.getCurrentIdentityBySubject(subject)
    } catch {
      return undefined
    }
  }

  private async acquireWithExpiredRecovery(input: Readonly<{
    tenantId: string
    operationId: string
    auditIntentId: string
    targetUserId: string
    targetUsername: string
    expectedRoles: readonly ApplicationRole[]
    desiredRoles: readonly ApplicationRole[]
  }>): Promise<ApplicationRoleMutationLease> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await this.mutationLock.acquire(input)
      } catch (error) {
        if (!(error instanceof ApplicationRoleMutationRecoveryRequiredError)) throw error
        await this.recoverExpiredMutation(error.staleLease)
      }
    }
    throw new ApplicationRoleMutationError("Expired application-role mutation recovery did not converge", "failed")
  }

  private async recoverExpiredMutation(staleLease: ApplicationRoleMutationLease): Promise<void> {
    let recoveryLease = await this.mutationLock.beginExpiredRecovery(staleLease)
    const record = recoveryLease.record
    const target = await this.resolveIdentity(record.targetUserId)
    if (
      !target ||
      target.tenantId !== record.tenantId ||
      target.username !== record.targetUsername
    ) throw new ApplicationRoleMutationError("Expired role mutation target cannot be reconciled authoritatively", "failed")
    const currentRoles = observedRoles(target.cognitoGroups)

    if (record.recoveryAction === "reconcile_managed") {
      throw new ApplicationRoleMutationError("Expired role mutation stopped during the managed-state commit boundary", "failed")
    }

    if (record.recoveryAction === "complete_managed" || staleLease.record.phase === "managed_committed") {
      if (!sameRoleValues(currentRoles, record.desiredRoles)) {
        throw new ApplicationRoleMutationError("Managed-committed role mutation does not match authoritative identity", "failed")
      }
      await this.deps.auditOutbox.complete(record.auditIntentId, record.tenantId, "success", {
        userId: target.userId,
        tenantId: target.tenantId,
        accountStatus: target.accountStatus,
        roles: [...record.desiredRoles]
      })
      await this.mutationLock.release(recoveryLease)
      return
    }

    if (!sameRoleValues(currentRoles, record.expectedRoles)) {
      if (!this.deps.userDirectory.revokeSessions || !this.deps.userDirectory.replaceApplicationRoles) {
        throw new ApplicationRoleMutationError("Expired role mutation recovery adapter is not configured", "failed")
      }
      const assertFence = async () => {
        recoveryLease = await this.mutationLock.renew(recoveryLease)
      }
      await assertFence()
      await this.deps.userDirectory.revokeSessions(record.targetUsername)
      await this.deps.userDirectory.replaceApplicationRoles(record.targetUsername, {
        expectedRoles: currentRoles,
        desiredRoles: record.expectedRoles,
        operationId: record.operationId,
        fencingToken: recoveryLease.record.fencingToken,
        assertFence
      })
      await assertFence()
    }
    const recovered = await this.resolveIdentity(record.targetUserId)
    if (!recovered || !sameRoles(recovered.cognitoGroups, record.expectedRoles)) {
      throw new ApplicationRoleMutationError("Expired role mutation rollback verification failed", "failed")
    }
    await this.closeCleanupRepairAfterRollback(record)
    await this.deps.auditOutbox.complete(record.auditIntentId, record.tenantId, "failed", {
      userId: recovered.userId,
      tenantId: recovered.tenantId,
      accountStatus: recovered.accountStatus,
      roles: [...record.expectedRoles]
    })
    await this.mutationLock.release(recoveryLease)
  }

  private async closeCleanupRepairAfterRollback(record: ApplicationRoleMutationLockRecord): Promise<void> {
    const outbox = new ObjectStoreRevocationCleanupRepairOutbox(this.deps.objectStore)
    const repair = await outbox.get(record.tenantId, "account", record.targetUserId, record.operationId)
    if (repair?.status === "prepared" || repair?.status === "deny_committed") {
      await outbox.markAbandoned(repair, (this.deps.now?.() ?? new Date()).toISOString())
    } else if (repair?.status === "cleanup_registered") {
      // The authoritative roles were restored under the tenant mutation fence.
      // The manifest will independently converge to superseded; closing the
      // repair releases the resource fence without authorizing cleanup.
      await outbox.markCleanupCompleted(repair, (this.deps.now?.() ?? new Date()).toISOString())
    }
  }

  private async rollbackUnderFence(
    target: ServerManagedIdentity,
    beforeRoles: readonly ApplicationRole[],
    initialLease: ApplicationRoleMutationLease
  ): Promise<{ lease: ApplicationRoleMutationLease; restored: boolean }> {
    let lease = initialLease
    try {
      if (!this.deps.userDirectory.replaceApplicationRoles || !this.deps.userDirectory.revokeSessions) {
        return { lease, restored: false }
      }
      const current = await this.resolveIdentity(target.userId)
      if (!current) return { lease, restored: false }
      const currentRoles = observedRoles(current.cognitoGroups)
      const assertFence = async () => {
        lease = await this.mutationLock.renew(lease)
      }
      if (!sameRoleValues(currentRoles, beforeRoles)) {
        await assertFence()
        await this.deps.userDirectory.revokeSessions(target.username)
        await this.deps.userDirectory.replaceApplicationRoles(target.username, {
          expectedRoles: currentRoles,
          desiredRoles: beforeRoles,
          operationId: lease.record.operationId,
          fencingToken: lease.record.fencingToken,
          assertFence
        })
      }
      await assertFence()
      const verified = await this.resolveIdentity(target.userId)
      if (!verified || !sameRoles(verified.cognitoGroups, beforeRoles)) return { lease, restored: false }
      // Session invalidation is best-effort after the authoritative role set is
      // proven restored. Tokens minted before the attempted mutation carry the
      // same roles, while tokens minted during a temporary deny cannot exceed
      // the restored authority. A sign-out outage must not leave a false repair
      // fence after a deny that never committed (or was rolled back).
      await this.deps.userDirectory.revokeSessions(target.username).catch(() => undefined)
      return { lease, restored: true }
    } catch {
      // The failed audit intent records the last observed authoritative state
      // for deterministic operator reconciliation.
      return { lease, restored: false }
    }
  }

  private complete(
    intent: SecurityMutationAuditIntent,
    result: SecurityMutationResult,
    identity: ServerManagedIdentity,
    roles: readonly ApplicationRole[]
  ) {
    return this.deps.auditOutbox.complete(intent.intentId, intent.draft.tenantId, result, {
      userId: identity.userId,
      tenantId: identity.tenantId,
      accountStatus: identity.accountStatus,
      roles: [...roles]
    })
  }

  private async recordEarlyFailure(
    input: ReplaceApplicationRolesInput,
    result: Extract<SecurityMutationResult, "denied" | "failed">
  ): Promise<void> {
    const tenantId = input.actor.tenantId?.trim()
    if (!tenantId) throw new ApplicationRoleMutationError("Authoritative actor tenant is missing", "denied")
    const intent = await this.deps.auditOutbox.prepare({
      actorId: input.actor.userId,
      tenantId,
      targetType: "applicationRolePrincipal",
      targetId: input.targetUserId,
      operation: "applicationRole.replace",
      before: null,
      proposedAfter: { roles: [...input.roles] },
      reason: canonicalAuditReason(input.reason),
      policyVersion: `${APPLICATION_ROLE_MUTATION_POLICY_VERSION}:${ROLE_CATALOG_VERSION}`
    })
    await this.deps.auditOutbox.complete(intent.intentId, tenantId, result, null)
  }
}

function roleStateVersion(roles: readonly ApplicationRole[]): string {
  return `${ROLE_CATALOG_VERSION}:${roles.join(",") || "none"}`
}

function applicationRoleCleanupRegistration(input: Readonly<{
  operationId: string
  tenantId: string
  targetUserId: string
  targetUsername: string
  removedRoles: readonly ApplicationRole[]
  afterRoles: readonly ApplicationRole[]
  deniedAt: string
}>): RegisterRevocationCleanupInput & { operationId: string } {
  return {
    operationId: input.operationId,
    tenantId: input.tenantId,
    resourceType: "account",
    resourceId: input.targetUserId,
    trigger: "role_revoked",
    deniedPurposes: ["normal_rag", "external_model", "logging", "evaluation"],
    authoritativeDenyVersion: roleStateVersion(input.afterRoles),
    authoritativeDenyConfirmedAt: input.deniedAt,
    knownTargets: [
      { scope: "session", reference: input.targetUsername },
      ...input.removedRoles.map((role) => ({ scope: "grant" as const, reference: `role:${role}` })),
      { scope: "cache", reference: `principal:${input.targetUserId}` },
      { scope: "queued_run", reference: `principal:${input.targetUserId}` },
      { scope: "evaluation_artifact", reference: `principal:${input.targetUserId}` }
    ]
  }
}

function canonicalReason(value: string): string {
  if (!value || value.trim() !== value) {
    throw new ApplicationRoleMutationError("Role mutation reason is required and must be canonical", "denied")
  }
  return value
}

function canonicalAuditReason(value: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : "invalid_or_missing_reason"
}

function canonicalRoles(values: readonly string[]): ApplicationRole[] {
  if (values.length === 0 || values.some((value) => !isApplicationRole(value))) {
    throw new ApplicationRoleMutationError("Role set contains an unknown or missing application role", "denied")
  }
  if (new Set(values).size !== values.length) {
    throw new ApplicationRoleMutationError("Role set contains duplicates", "denied")
  }
  const selected = new Set<ApplicationRole>(values as ApplicationRole[])
  return APPLICATION_ROLES.filter((role) => selected.has(role))
}

function sameRoles(actual: readonly string[], expected: readonly ApplicationRole[]): boolean {
  const actualRoles = actual.filter(isApplicationRole)
  if (new Set(actualRoles).size !== actualRoles.length) return false
  return sameRoleValues(observedRoles(actualRoles), expected)
}

function observedRoles(values: readonly string[]): ApplicationRole[] {
  const selected = new Set(values.filter(isApplicationRole))
  return APPLICATION_ROLES.filter((role) => selected.has(role))
}

function sameRoleValues(left: readonly ApplicationRole[], right: readonly ApplicationRole[]): boolean {
  return left.length === right.length && left.every((role, index) => role === right[index])
}

function normalizeMutationError(
  error: unknown,
  fallback: Exclude<SecurityMutationResult, "success">
): ApplicationRoleMutationError {
  return error instanceof ApplicationRoleMutationError
    ? error
    : new ApplicationRoleMutationError(error instanceof Error ? error.message : "Role mutation failed", fallback)
}
