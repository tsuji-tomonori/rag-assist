import { createHash } from "node:crypto"

export type SecurityResourceReferenceKind = "account" | "resource_group" | "folder" | "document"

/** Stable pseudonymous identity retained in evaluation artifacts for exact revocation cleanup. */
export function securityResourceReference(
  tenantId: string,
  kind: SecurityResourceReferenceKind,
  resourceId: string
): string {
  for (const [name, value] of [["tenantId", tenantId], ["resourceId", resourceId]] as const) {
    if (!value || value.trim() !== value) throw new Error(`Security resource ${name} is invalid`)
  }
  return `${kind}:sha256:${createHash("sha256").update(`${tenantId}\u0000${kind}\u0000${resourceId}`).digest("hex")}`
}
