import type { ApplicationPermission } from "@memorag-mvp/contract/access-control"
import type { VerifiedIdentityProvider } from "../adapters/verified-identity-provider.js"
import type { AppUser } from "../auth.js"
import { hasPermission } from "../authorization.js"
import type { WorkerTargetType } from "../types.js"

export const CURRENT_WORKER_AUTHORIZATION_POLICY_VERSION = "current-worker-authorization-v1" as const

export type WorkerAuthorizationBoundary =
  | "start"
  | "protected_read"
  | "external_side_effect"
  | "durable_commit"

export type CurrentWorkerAuthorizationRequest = Readonly<{
  runId: string
  targetType: WorkerTargetType
  subject: string
  tenantId: string
  requiredPermissions: readonly ApplicationPermission[]
  authorizeResource: (user: AppUser, boundary: WorkerAuthorizationBoundary) => boolean | Promise<boolean>
}>

/**
 * A deliberately non-disclosing worker failure. Internal denial details must
 * not be persisted into user-visible run/event records.
 */
export class PermissionRevokedError extends Error {
  readonly code = "permission_revoked" as const

  constructor(readonly denialReason: string) {
    super("permission_revoked")
    this.name = "PermissionRevokedError"
  }
}

/** Reconstructs account, tenant and role context from the authoritative source on every call. */
export class CurrentWorkerAuthorization {
  constructor(private readonly identityProvider: VerifiedIdentityProvider) {}

  async assertAuthorized(
    request: CurrentWorkerAuthorizationRequest,
    boundary: WorkerAuthorizationBoundary
  ): Promise<AppUser> {
    if (!canonical(request.runId) || !canonical(request.subject) || !canonical(request.tenantId)) {
      throw new PermissionRevokedError("worker_identity_not_canonical")
    }

    let identity
    try {
      identity = await this.identityProvider.getCurrentIdentityBySubject(request.subject)
    } catch {
      throw new PermissionRevokedError("authoritative_identity_unavailable")
    }
    if (!identity) throw new PermissionRevokedError("account_deleted")
    if (identity.userId !== request.subject) throw new PermissionRevokedError("subject_mismatch")
    if (identity.accountStatus !== "active") throw new PermissionRevokedError("account_inactive")
    if (identity.tenantId !== request.tenantId) throw new PermissionRevokedError("tenant_membership_revoked")

    const user: AppUser = {
      userId: identity.userId,
      identityUsername: identity.username,
      email: identity.email,
      cognitoGroups: [...identity.cognitoGroups],
      accountStatus: identity.accountStatus,
      tenantId: identity.tenantId
    }
    if (!request.requiredPermissions.every((permission) => hasPermission(user, permission))) {
      throw new PermissionRevokedError("role_permission_revoked")
    }

    let resourceAllowed: boolean
    try {
      resourceAllowed = await request.authorizeResource(user, boundary)
    } catch {
      resourceAllowed = false
    }
    if (!resourceAllowed) throw new PermissionRevokedError("resource_policy_revoked")
    return user
  }
}

export async function runCurrentAuthorizedWorkerPhases<TRead, TEffect, TResult>(input: {
  authorize: (boundary: WorkerAuthorizationBoundary) => Promise<AppUser>
  protectedRead: (user: AppUser) => Promise<TRead>
  externalSideEffect: (read: TRead, user: AppUser) => Promise<TEffect>
  durableCommit: (effect: TEffect, user: AppUser) => Promise<TResult>
}): Promise<TResult> {
  await input.authorize("start")
  const readUser = await input.authorize("protected_read")
  const read = await input.protectedRead(readUser)
  const sideEffectUser = await input.authorize("external_side_effect")
  const effect = await input.externalSideEffect(read, sideEffectUser)
  const commitUser = await input.authorize("durable_commit")
  return input.durableCommit(effect, commitUser)
}

export function isPermissionRevokedError(error: unknown): error is PermissionRevokedError {
  return error instanceof PermissionRevokedError
}

function canonical(value: string): boolean {
  return value.length > 0 && value.trim() === value
}
