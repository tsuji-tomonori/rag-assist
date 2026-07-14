import type { ResourcePermissionLevel } from "./resource-operation-authorization.js"

export const RESOURCE_PERMISSION_DECISION_POLICY_VERSION = "resource-permission-decision-v1" as const

export type ResourcePermissionDecisionReasonCode =
  | "allowed"
  | "account_not_active"
  | "actor_tenant_unresolved"
  | "administrative_principal"
  | "identity_unverified"
  | "no_matching_allow"
  | "ordinary_policy_denied"
  | "ordinary_policy_unavailable"
  | "resource_integrity_unverified"
  | "resource_not_active"
  | "resource_tenant_unresolved"
  | "tenant_mismatch"

export type ResourcePermissionContribution = Readonly<{
  sourceType:
    | "mandatoryDeny"
    | "administrativePrincipal"
    | "directDocumentPolicy"
    | "folderPolicy"
    | "inheritedFolderPolicy"
    | "legacyPolicy"
  sourceId: string
  policyVersion: string
  effect: "allow" | "deny" | "unavailable" | "notApplicable"
  permission: ResourcePermissionLevel
  reasonCode: ResourcePermissionDecisionReasonCode
}>

export type ResourcePermissionDecision = Readonly<{
  policyVersion: typeof RESOURCE_PERMISSION_DECISION_POLICY_VERSION
  resourceType: "document" | "folder"
  resourceId: string
  actorId: string
  permission: ResourcePermissionLevel
  granted: boolean
  reasonCode: ResourcePermissionDecisionReasonCode
  contributions: readonly ResourcePermissionContribution[]
}>

export function createResourcePermissionDecision(input: Omit<ResourcePermissionDecision, "policyVersion" | "granted">): ResourcePermissionDecision {
  return Object.freeze({
    ...input,
    policyVersion: RESOURCE_PERMISSION_DECISION_POLICY_VERSION,
    granted: input.permission !== "none",
    contributions: Object.freeze(input.contributions.map((contribution) => Object.freeze({ ...contribution })))
  })
}
