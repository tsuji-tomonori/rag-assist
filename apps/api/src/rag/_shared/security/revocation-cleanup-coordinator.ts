import { createHash, randomUUID } from "node:crypto"
import type { ObjectStore } from "../../../adapters/object-store.js"
import { ObjectStoreRevocationCleanupTenantRegistry } from "./revocation-cleanup-tenant-registry.js"

export const REVOCATION_CLEANUP_POLICY_VERSION = "revocation-cleanup-v1" as const

export const REVOCATION_CLEANUP_SCOPES = [
  "source",
  "chunk",
  "memory",
  "active_index",
  "staged_index",
  "old_index",
  "cache",
  "grant",
  "session",
  "queued_run",
  "evaluation_artifact"
] as const

export type RevocationCleanupScope = (typeof REVOCATION_CLEANUP_SCOPES)[number]

export const REVOCATION_TRIGGERS = [
  "share_revoked",
  "account_revoked",
  "role_revoked",
  "group_revoked",
  "classification_restricted",
  "usage_restricted",
  "quality_restricted",
  "expired",
  "archived",
  "deleted",
  "index_rollback",
  "temporary_scope_mismatch"
] as const

export type RevocationTrigger = (typeof REVOCATION_TRIGGERS)[number]

export type RevocationCleanupTargetReference = Readonly<{
  scope: RevocationCleanupScope
  reference: string
}>

export type RevocationCleanupTarget = RevocationCleanupTargetReference & Readonly<{
  targetId: string
  status: "pending" | "cleaned"
  attempts: number
  lastAttemptAt?: string
  cleanedAt?: string
  lastFailureCode?: string
}>

export type RevocationCleanupScopeState = Readonly<{
  scope: RevocationCleanupScope
  status: "pending" | "verified"
  discoveredAt?: string
  verifiedAt?: string
  lastFailureCode?: string
}>

export type RevocationCleanupManifest = Readonly<{
  schemaVersion: 1
  policyVersion: typeof REVOCATION_CLEANUP_POLICY_VERSION
  operationId: string
  tenantId: string
  resourceType: "document" | "temporary_attachment" | "folder" | "resource_group" | "benchmark_run" | "account" | "group"
  resourceId: string
  trigger: RevocationTrigger
  deniedPurposes: readonly string[]
  authoritativeDeny: Readonly<{
    status: "effective"
    version: string
    confirmedAt: string
  }>
  status: "cleanup_pending" | "reconciliation_required" | "completed" | "superseded"
  scopes: readonly RevocationCleanupScopeState[]
  targets: readonly RevocationCleanupTarget[]
  attempts: number
  lastFailureCode?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}>

export type RegisterRevocationCleanupInput = Readonly<{
  operationId?: string
  tenantId: string
  resourceType: RevocationCleanupManifest["resourceType"]
  resourceId: string
  trigger: RevocationTrigger
  deniedPurposes?: readonly string[]
  authoritativeDenyVersion: string
  authoritativeDenyConfirmedAt: string
  knownTargets?: readonly RevocationCleanupTargetReference[]
}>

export interface RevocationCleanupDriver {
  isAuthoritativeDenyCurrent(manifest: RevocationCleanupManifest): Promise<boolean>
  discover(manifest: RevocationCleanupManifest, scope: RevocationCleanupScope): Promise<readonly RevocationCleanupTargetReference[]>
  cleanup(manifest: RevocationCleanupManifest, target: RevocationCleanupTarget): Promise<void>
  findResiduals(manifest: RevocationCleanupManifest, scope: RevocationCleanupScope): Promise<readonly RevocationCleanupTargetReference[]>
}

export class RevocationCleanupValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RevocationCleanupValidationError"
  }
}

export class RevocationCleanupConflictError extends Error {
  constructor(message = "Revocation cleanup manifest changed concurrently") {
    super(message)
    this.name = "RevocationCleanupConflictError"
  }
}

/**
 * Durable deny-first cleanup ledger. Registration is only accepted with an
 * already-effective authoritative deny. Physical cleanup can fail or race;
 * the manifest remains retryable and never contains an operation that clears
 * the deny or republishes a previous ACL/index version.
 */
export class ObjectStoreRevocationCleanupCoordinator {
  private readonly now: () => Date

  constructor(
    private readonly objectStore: ObjectStore,
    now: () => Date = () => new Date()
  ) {
    this.now = now
  }

  async register(input: RegisterRevocationCleanupInput): Promise<RevocationCleanupManifest> {
    const normalized = normalizeRegistration(input)
    await new ObjectStoreRevocationCleanupTenantRegistry(this.objectStore, this.now).register(normalized.tenantId)
    const operationId = normalized.operationId ?? `revoke_${randomUUID()}`
    const key = cleanupManifestKey(normalized.tenantId, operationId)
    const existing = await readManifest(this.objectStore, key)
    if (existing) {
      assertSameRegistration(existing.manifest, { ...normalized, operationId })
      return existing.manifest
    }

    const now = this.now().toISOString()
    const manifest: RevocationCleanupManifest = {
      schemaVersion: 1,
      policyVersion: REVOCATION_CLEANUP_POLICY_VERSION,
      operationId,
      tenantId: normalized.tenantId,
      resourceType: normalized.resourceType,
      resourceId: normalized.resourceId,
      trigger: normalized.trigger,
      deniedPurposes: normalized.deniedPurposes,
      authoritativeDeny: {
        status: "effective",
        version: normalized.authoritativeDenyVersion,
        confirmedAt: normalized.authoritativeDenyConfirmedAt
      },
      status: "cleanup_pending",
      scopes: REVOCATION_CLEANUP_SCOPES.map((scope) => ({ scope, status: "pending" })),
      targets: mergeTargets([], normalized.knownTargets),
      attempts: 0,
      createdAt: now,
      updatedAt: now
    }
    try {
      await this.objectStore.putTextIfVersion(key, JSON.stringify(manifest, null, 2), undefined, "application/json")
    } catch (error) {
      if (!isConditionalWriteError(error)) throw error
      const winner = await readManifest(this.objectStore, key)
      if (!winner) throw new RevocationCleanupConflictError()
      assertSameRegistration(winner.manifest, { ...normalized, operationId })
      return winner.manifest
    }
    return (await this.get(normalized.tenantId, operationId)) ?? manifest
  }

  async get(tenantId: string, operationId: string): Promise<RevocationCleanupManifest | undefined> {
    assertIdentifier(tenantId, "tenantId")
    assertIdentifier(operationId, "operationId")
    return (await readManifest(this.objectStore, cleanupManifestKey(tenantId, operationId)))?.manifest
  }

  async listPending(tenantId: string, limit = 100): Promise<RevocationCleanupManifest[]> {
    assertIdentifier(tenantId, "tenantId")
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
      throw new RevocationCleanupValidationError("Revocation cleanup list limit is invalid")
    }
    const prefix = cleanupManifestPrefix(tenantId)
    const keys = await this.objectStore.listKeys(prefix)
    const manifests: RevocationCleanupManifest[] = []
    for (const key of keys.sort()) {
      if (!key.startsWith(prefix) || !key.endsWith(".json")) {
        throw new RevocationCleanupValidationError("Revocation cleanup manifest listing escaped its tenant partition")
      }
      const stored = await readManifest(this.objectStore, key)
      if (!stored) throw new RevocationCleanupValidationError("Listed revocation cleanup manifest disappeared")
      validateManifest(stored.manifest, tenantId, stored.manifest.operationId)
      if (key !== cleanupManifestKey(tenantId, stored.manifest.operationId)) {
        throw new RevocationCleanupValidationError("Revocation cleanup manifest key is not canonical")
      }
      if (stored.manifest.status === "cleanup_pending" || stored.manifest.status === "reconciliation_required") {
        manifests.push(stored.manifest)
      }
    }
    return manifests
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt) || left.operationId.localeCompare(right.operationId))
      .slice(0, limit)
  }

  async reconcile(
    tenantId: string,
    operationId: string,
    driver: RevocationCleanupDriver
  ): Promise<RevocationCleanupManifest> {
    const key = cleanupManifestKey(tenantId, operationId)
    const stored = await readManifest(this.objectStore, key)
    if (!stored) throw new RevocationCleanupValidationError("Revocation cleanup manifest was not found")
    validateManifest(stored.manifest, tenantId, operationId)
    if (stored.manifest.status === "completed" || stored.manifest.status === "superseded") return stored.manifest

    const attemptAt = this.now().toISOString()
    try {
      if (!await driver.isAuthoritativeDenyCurrent(stored.manifest)) {
        const superseded: RevocationCleanupManifest = {
          ...stored.manifest,
          status: "superseded",
          attempts: stored.manifest.attempts + 1,
          lastFailureCode: "authoritative_deny_superseded",
          updatedAt: attemptAt,
          completedAt: attemptAt
        }
        await this.persist(key, superseded, stored.version)
        return (await this.get(tenantId, operationId)) ?? superseded
      }
    } catch (error) {
      const pending: RevocationCleanupManifest = {
        ...stored.manifest,
        status: "reconciliation_required",
        attempts: stored.manifest.attempts + 1,
        lastFailureCode: `deny_check:${failureCode(error)}`,
        updatedAt: attemptAt
      }
      await this.persist(key, pending, stored.version)
      return (await this.get(tenantId, operationId)) ?? pending
    }
    let targets = [...stored.manifest.targets]
    let scopes = [...stored.manifest.scopes]
    const failures: string[] = []

    for (const scope of REVOCATION_CLEANUP_SCOPES) {
      try {
        const discovered = normalizeTargetReferences(await driver.discover(stored.manifest, scope), scope)
        targets = mergeTargets(targets, discovered)
        scopes = updateScope(scopes, scope, {
          status: "pending",
          discoveredAt: attemptAt,
          verifiedAt: undefined,
          lastFailureCode: undefined
        })
      } catch (error) {
        const code = failureCode(error)
        failures.push(`${scope}:discover:${code}`)
        scopes = updateScope(scopes, scope, { status: "pending", lastFailureCode: code })
      }
    }

    // Checkpoint every discovered physical target before the first destructive
    // operation. A timeout after deleting a source/manifest can then retry from
    // the durable target set even when discovery metadata is already gone.
    const discoveryCheckpoint: RevocationCleanupManifest = {
      ...stored.manifest,
      status: failures.length > 0 ? "reconciliation_required" : "cleanup_pending",
      scopes,
      targets,
      lastFailureCode: failures[0],
      updatedAt: attemptAt,
      completedAt: undefined
    }
    await this.persist(key, discoveryCheckpoint, stored.version)
    let checkpoint = await readManifest(this.objectStore, key)
    if (!checkpoint) throw new RevocationCleanupValidationError("Revocation cleanup checkpoint disappeared")
    validateManifest(checkpoint.manifest, tenantId, operationId)
    targets = [...checkpoint.manifest.targets]
    scopes = [...checkpoint.manifest.scopes]

    let denySuperseded = false
    let denyRecheckFailed = false
    for (const target of targets) {
      if (target.status === "cleaned") continue
      try {
        if (!await driver.isAuthoritativeDenyCurrent(withReconciliationState(checkpoint.manifest, targets, scopes))) {
          denySuperseded = true
          break
        }
      } catch (error) {
        failures.push(`deny_recheck:${failureCode(error)}`)
        denyRecheckFailed = true
        break
      }
      try {
        await driver.cleanup(withReconciliationState(checkpoint.manifest, targets, scopes), target)
        targets = replaceTarget(targets, target.targetId, {
          ...target,
          status: "cleaned",
          attempts: target.attempts + 1,
          lastAttemptAt: attemptAt,
          cleanedAt: attemptAt,
          lastFailureCode: undefined
        })
      } catch (error) {
        const code = failureCode(error)
        failures.push(`${target.scope}:cleanup:${code}`)
        targets = replaceTarget(targets, target.targetId, {
          ...target,
          attempts: target.attempts + 1,
          lastAttemptAt: attemptAt,
          lastFailureCode: code
        })
      }
      const progress: RevocationCleanupManifest = {
        ...checkpoint.manifest,
        status: "cleanup_pending",
        scopes,
        targets,
        lastFailureCode: failures[0],
        updatedAt: attemptAt,
        completedAt: undefined
      }
      await this.persist(key, progress, checkpoint.version)
      const persistedProgress = await readManifest(this.objectStore, key)
      if (!persistedProgress) throw new RevocationCleanupValidationError("Revocation cleanup progress checkpoint disappeared")
      validateManifest(persistedProgress.manifest, tenantId, operationId)
      checkpoint = persistedProgress
    }

    if (denySuperseded) {
      const superseded: RevocationCleanupManifest = {
        ...checkpoint.manifest,
        status: "superseded",
        scopes,
        targets,
        attempts: stored.manifest.attempts + 1,
        lastFailureCode: "authoritative_deny_superseded",
        updatedAt: attemptAt,
        completedAt: attemptAt
      }
      await this.persist(key, superseded, checkpoint.version)
      return (await this.get(tenantId, operationId)) ?? superseded
    }

    for (const scope of denyRecheckFailed ? [] : REVOCATION_CLEANUP_SCOPES) {
      if (failures.some((failure) => failure.startsWith(`${scope}:discover:`))) continue
      try {
        const residuals = normalizeTargetReferences(
          await driver.findResiduals(withReconciliationState(checkpoint.manifest, targets, scopes), scope),
          scope
        )
        if (residuals.length > 0) {
          targets = mergeResidualTargets(targets, residuals)
          const code = "residual_artifact_detected"
          failures.push(`${scope}:verify:${code}`)
          scopes = updateScope(scopes, scope, { status: "pending", lastFailureCode: code })
        } else if (!targets.some((target) => target.scope === scope && target.status !== "cleaned")) {
          scopes = updateScope(scopes, scope, {
            status: "verified",
            verifiedAt: attemptAt,
            lastFailureCode: undefined
          })
        }
      } catch (error) {
        const code = failureCode(error)
        failures.push(`${scope}:verify:${code}`)
        scopes = updateScope(scopes, scope, { status: "pending", lastFailureCode: code })
      }
    }

    let completed = failures.length === 0
      && targets.every((target) => target.status === "cleaned")
      && scopes.every((scope) => scope.status === "verified")
    if (completed) {
      try {
        if (!await driver.isAuthoritativeDenyCurrent(withReconciliationState(checkpoint.manifest, targets, scopes))) {
          const superseded: RevocationCleanupManifest = {
            ...checkpoint.manifest,
            status: "superseded",
            scopes,
            targets,
            attempts: stored.manifest.attempts + 1,
            lastFailureCode: "authoritative_deny_superseded",
            updatedAt: attemptAt,
            completedAt: attemptAt
          }
          await this.persist(key, superseded, checkpoint.version)
          return (await this.get(tenantId, operationId)) ?? superseded
        }
      } catch (error) {
        failures.push(`deny_final_check:${failureCode(error)}`)
        completed = false
      }
    }
    const next: RevocationCleanupManifest = {
      ...checkpoint.manifest,
      status: completed ? "completed" : "reconciliation_required",
      scopes,
      targets,
      attempts: stored.manifest.attempts + 1,
      lastFailureCode: completed ? undefined : failures[0] ?? "cleanup_incomplete",
      updatedAt: attemptAt,
      completedAt: completed ? attemptAt : undefined
    }

    await this.persist(key, next, checkpoint.version)
    return (await this.get(tenantId, operationId)) ?? next
  }

  private async persist(key: string, manifest: RevocationCleanupManifest, expectedVersion: string): Promise<void> {
    try {
      await this.objectStore.putTextIfVersion(key, JSON.stringify(manifest, null, 2), expectedVersion, "application/json")
    } catch (error) {
      if (isConditionalWriteError(error)) throw new RevocationCleanupConflictError()
      throw error
    }
  }
}

/**
 * Builds an unpersisted manifest-shaped deny probe for repair-outbox recovery.
 * The production verifier uses the same authoritative checks as reconciliation
 * before a missing cleanup manifest is regenerated.
 */
export function buildRevocationCleanupDenyProbe(
  input: RegisterRevocationCleanupInput & { operationId: string }
): RevocationCleanupManifest {
  const normalized = normalizeRegistration(input)
  const now = normalized.authoritativeDenyConfirmedAt
  return {
    schemaVersion: 1,
    policyVersion: REVOCATION_CLEANUP_POLICY_VERSION,
    operationId: input.operationId,
    tenantId: normalized.tenantId,
    resourceType: normalized.resourceType,
    resourceId: normalized.resourceId,
    trigger: normalized.trigger,
    deniedPurposes: normalized.deniedPurposes,
    authoritativeDeny: {
      status: "effective",
      version: normalized.authoritativeDenyVersion,
      confirmedAt: normalized.authoritativeDenyConfirmedAt
    },
    status: "cleanup_pending",
    scopes: REVOCATION_CLEANUP_SCOPES.map((scope) => ({ scope, status: "pending" })),
    targets: mergeTargets([], normalized.knownTargets),
    attempts: 0,
    createdAt: now,
    updatedAt: now
  }
}

function normalizeRegistration(input: RegisterRevocationCleanupInput): RegisterRevocationCleanupInput & {
  tenantId: string
  resourceId: string
  authoritativeDenyVersion: string
  authoritativeDenyConfirmedAt: string
  deniedPurposes: readonly string[]
  knownTargets: readonly RevocationCleanupTargetReference[]
} {
  const tenantId = canonicalIdentifier(input.tenantId, "tenantId")
  const resourceId = canonicalIdentifier(input.resourceId, "resourceId")
  const authoritativeDenyVersion = canonicalIdentifier(input.authoritativeDenyVersion, "authoritativeDenyVersion")
  const authoritativeDenyConfirmedAt = canonicalTimestamp(input.authoritativeDenyConfirmedAt, "authoritativeDenyConfirmedAt")
  if (input.operationId !== undefined) assertIdentifier(input.operationId, "operationId")
  if (!REVOCATION_TRIGGERS.includes(input.trigger)) throw new RevocationCleanupValidationError("Unsupported revocation trigger")
  const deniedPurposes = [...new Set((input.deniedPurposes ?? []).map((value) => canonicalIdentifier(value, "deniedPurpose")))].sort()
  const knownTargets = normalizeTargetReferences(input.knownTargets ?? [])
  return { ...input, tenantId, resourceId, authoritativeDenyVersion, authoritativeDenyConfirmedAt, deniedPurposes, knownTargets }
}

function validateManifest(manifest: RevocationCleanupManifest, tenantId: string, operationId: string): void {
  if (
    manifest.schemaVersion !== 1
    || manifest.policyVersion !== REVOCATION_CLEANUP_POLICY_VERSION
    || manifest.tenantId !== tenantId
    || manifest.operationId !== operationId
    || canonicalIdentifier(manifest.tenantId, "tenantId") !== manifest.tenantId
    || canonicalIdentifier(manifest.operationId, "operationId") !== manifest.operationId
    || canonicalIdentifier(manifest.resourceId, "resourceId") !== manifest.resourceId
    || !["document", "temporary_attachment", "folder", "resource_group", "benchmark_run", "account", "group"].includes(manifest.resourceType)
    || !REVOCATION_TRIGGERS.includes(manifest.trigger)
    || manifest.authoritativeDeny?.status !== "effective"
    || canonicalIdentifier(manifest.authoritativeDeny.version, "authoritativeDenyVersion") !== manifest.authoritativeDeny.version
    || canonicalTimestamp(manifest.authoritativeDeny.confirmedAt, "authoritativeDenyConfirmedAt") !== manifest.authoritativeDeny.confirmedAt
    || !["cleanup_pending", "reconciliation_required", "completed", "superseded"].includes(manifest.status)
    || !Array.isArray(manifest.deniedPurposes)
    || manifest.deniedPurposes.some((purpose) => canonicalIdentifier(purpose, "deniedPurpose") !== purpose)
    || !Number.isSafeInteger(manifest.attempts)
    || manifest.attempts < 0
    || canonicalTimestamp(manifest.createdAt, "createdAt") !== manifest.createdAt
    || canonicalTimestamp(manifest.updatedAt, "updatedAt") !== manifest.updatedAt
    || !Array.isArray(manifest.scopes)
    || !Array.isArray(manifest.targets)
    || manifest.scopes.length !== REVOCATION_CLEANUP_SCOPES.length
    || !REVOCATION_CLEANUP_SCOPES.every((scope) => manifest.scopes.filter((entry) => entry.scope === scope).length === 1)
  ) throw new RevocationCleanupValidationError("Revocation cleanup manifest is invalid")
  for (const scope of manifest.scopes) {
    if (!REVOCATION_CLEANUP_SCOPES.includes(scope.scope) || !["pending", "verified"].includes(scope.status)) {
      throw new RevocationCleanupValidationError("Revocation cleanup scope state is invalid")
    }
    for (const timestamp of [scope.discoveredAt, scope.verifiedAt]) {
      if (timestamp !== undefined && canonicalTimestamp(timestamp, "scopeTimestamp") !== timestamp) {
        throw new RevocationCleanupValidationError("Revocation cleanup scope timestamp is invalid")
      }
    }
  }
  const targetIds = new Set<string>()
  for (const target of manifest.targets) {
    if (
      !REVOCATION_CLEANUP_SCOPES.includes(target.scope)
      || canonicalIdentifier(target.reference, "cleanupTargetReference") !== target.reference
      || target.targetId !== cleanupTargetId(target)
      || !["pending", "cleaned"].includes(target.status)
      || !Number.isSafeInteger(target.attempts)
      || target.attempts < 0
      || targetIds.has(target.targetId)
    ) throw new RevocationCleanupValidationError("Revocation cleanup target state is invalid")
    targetIds.add(target.targetId)
    for (const timestamp of [target.lastAttemptAt, target.cleanedAt]) {
      if (timestamp !== undefined && canonicalTimestamp(timestamp, "targetTimestamp") !== timestamp) {
        throw new RevocationCleanupValidationError("Revocation cleanup target timestamp is invalid")
      }
    }
  }
}

function assertSameRegistration(
  manifest: RevocationCleanupManifest,
  input: ReturnType<typeof normalizeRegistration> & { operationId: string }
): void {
  validateManifest(manifest, input.tenantId, input.operationId)
  if (
    manifest.resourceType !== input.resourceType
    || manifest.resourceId !== input.resourceId
    || manifest.trigger !== input.trigger
    || manifest.authoritativeDeny.version !== input.authoritativeDenyVersion
    || manifest.authoritativeDeny.confirmedAt !== input.authoritativeDenyConfirmedAt
    || JSON.stringify(manifest.deniedPurposes) !== JSON.stringify(input.deniedPurposes)
  ) throw new RevocationCleanupConflictError("Revocation cleanup idempotency key was reused with different input")
  const existingTargetIds = new Set(manifest.targets.map((target) => target.targetId))
  if (input.knownTargets.some((target) => !existingTargetIds.has(cleanupTargetId(target)))) {
    throw new RevocationCleanupConflictError("Revocation cleanup idempotency key was reused with different targets")
  }
}

function normalizeTargetReferences(
  targets: readonly RevocationCleanupTargetReference[],
  requiredScope?: RevocationCleanupScope
): RevocationCleanupTargetReference[] {
  return targets.map((target) => {
    if (!REVOCATION_CLEANUP_SCOPES.includes(target.scope)) throw new RevocationCleanupValidationError("Unsupported cleanup scope")
    if (requiredScope && target.scope !== requiredScope) throw new RevocationCleanupValidationError("Cleanup discovery returned the wrong scope")
    return { scope: target.scope, reference: canonicalIdentifier(target.reference, "cleanupTargetReference") }
  })
}

function mergeTargets(
  current: readonly RevocationCleanupTarget[],
  additions: readonly RevocationCleanupTargetReference[]
): RevocationCleanupTarget[] {
  const merged = new Map(current.map((target) => [target.targetId, target]))
  for (const target of additions) {
    const targetId = cleanupTargetId(target)
    if (!merged.has(targetId)) {
      merged.set(targetId, { ...target, targetId, status: "pending", attempts: 0 })
    }
  }
  return [...merged.values()].sort((left, right) => left.targetId.localeCompare(right.targetId))
}

function mergeResidualTargets(
  current: readonly RevocationCleanupTarget[],
  residuals: readonly RevocationCleanupTargetReference[]
): RevocationCleanupTarget[] {
  const residualIds = new Set(residuals.map(cleanupTargetId))
  const reopened = current.map((target) => residualIds.has(target.targetId)
    ? { ...target, status: "pending" as const, cleanedAt: undefined, lastFailureCode: "residual_artifact_detected" }
    : target)
  return mergeTargets(reopened, residuals)
}

function withReconciliationState(
  manifest: RevocationCleanupManifest,
  targets: readonly RevocationCleanupTarget[],
  scopes: readonly RevocationCleanupScopeState[]
): RevocationCleanupManifest {
  return { ...manifest, targets: [...targets], scopes: [...scopes] }
}

function replaceTarget(
  targets: readonly RevocationCleanupTarget[],
  targetId: string,
  replacement: RevocationCleanupTarget
): RevocationCleanupTarget[] {
  return targets.map((target) => target.targetId === targetId ? replacement : target)
}

function updateScope(
  scopes: readonly RevocationCleanupScopeState[],
  scope: RevocationCleanupScope,
  update: Omit<Partial<RevocationCleanupScopeState>, "scope">
): RevocationCleanupScopeState[] {
  return scopes.map((entry) => entry.scope === scope ? { ...entry, ...update } : entry)
}

function cleanupTargetId(target: RevocationCleanupTargetReference): string {
  return createHash("sha256").update(`${target.scope}\u0000${target.reference}`).digest("hex")
}

function cleanupManifestKey(tenantId: string, operationId: string): string {
  const tenantPartition = createHash("sha256").update(tenantId).digest("hex").slice(0, 24)
  const operationPartition = createHash("sha256").update(operationId).digest("hex").slice(0, 32)
  return `security/revocation-cleanup/${tenantPartition}/${operationPartition}.json`
}

function cleanupManifestPrefix(tenantId: string): string {
  const tenantPartition = createHash("sha256").update(tenantId).digest("hex").slice(0, 24)
  return `security/revocation-cleanup/${tenantPartition}/`
}

async function readManifest(
  objectStore: ObjectStore,
  key: string
): Promise<{ manifest: RevocationCleanupManifest; version: string } | undefined> {
  try {
    const stored = await objectStore.getTextWithVersion(key)
    return { manifest: JSON.parse(stored.text) as RevocationCleanupManifest, version: stored.version }
  } catch (error) {
    if (isMissingObjectError(error)) return undefined
    throw error
  }
}

function canonicalIdentifier(value: string, field: string): string {
  const normalized = value.trim()
  const hasControlCharacter = [...normalized].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 0x1f || codePoint === 0x7f
  })
  if (!normalized || normalized.length > 512 || hasControlCharacter) {
    throw new RevocationCleanupValidationError(`${field} is invalid`)
  }
  return normalized
}

function assertIdentifier(value: string, field: string): void {
  canonicalIdentifier(value, field)
}

function canonicalTimestamp(value: string, field: string): string {
  const normalized = canonicalIdentifier(value, field)
  if (!Number.isFinite(Date.parse(normalized))) throw new RevocationCleanupValidationError(`${field} is invalid`)
  return normalized
}

function failureCode(error: unknown): string {
  const raw = error instanceof Error ? error.name : "cleanup_failed"
  return raw.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 80) || "cleanup_failed"
}

function isConditionalWriteError(error: unknown): boolean {
  const value = error as { code?: string; name?: string }
  return value?.code === "PRECONDITION_FAILED"
    || value?.name === "PreconditionFailed"
    || value?.name === "ConditionalCheckFailedException"
}

function isMissingObjectError(error: unknown): boolean {
  const value = error as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } }
  return value?.code === "ENOENT"
    || value?.name === "NoSuchKey"
    || value?.name === "NotFound"
    || value?.$metadata?.httpStatusCode === 404
}
