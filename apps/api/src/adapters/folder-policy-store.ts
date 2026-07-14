import { createHash } from "node:crypto"
import type { FolderPolicy } from "../types.js"

export type VersionedFolderPolicyState = {
  policy?: FolderPolicy
  version: string
}

export interface FolderPolicyStore {
  list(tenantId: string): Promise<FolderPolicy[]>
  get(tenantId: string, policyId: string): Promise<FolderPolicy | undefined>
  findByFolderId(tenantId: string, folderId: string): Promise<FolderPolicy | undefined>
  save(policy: FolderPolicy): Promise<FolderPolicy>
  delete(tenantId: string, policyId: string): Promise<void>
  getVersionedByFolderId(tenantId: string, folderId: string): Promise<VersionedFolderPolicyState>
  replaceForFolder(policy: FolderPolicy, expectedVersion: string): Promise<VersionedFolderPolicyState>
}

export function folderPolicyStateVersion(policy: FolderPolicy | undefined): string {
  const canonical = policy
    ? {
      policyId: policy.policyId,
      tenantId: policy.tenantId,
      folderId: policy.folderId,
      entries: [...policy.entries]
        .map((entry) => ({
          principalType: entry.principalType,
          principalId: entry.principalId,
          permissionLevel: entry.permissionLevel
        }))
        .sort((left, right) => (
          `${left.principalType}\u0000${left.principalId}\u0000${left.permissionLevel}`
            .localeCompare(`${right.principalType}\u0000${right.principalId}\u0000${right.permissionLevel}`)
        )),
      createdBy: policy.createdBy,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt
    }
    : null
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex")
}

export function folderPolicyConflictError(folderId: string): Error {
  const error = new Error(`Folder policy state changed for ${folderId}`)
  Object.assign(error, { code: "PRECONDITION_FAILED" })
  return error
}
