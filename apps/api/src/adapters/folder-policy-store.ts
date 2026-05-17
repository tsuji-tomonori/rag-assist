import type { FolderPolicy } from "../types.js"

export interface FolderPolicyStore {
  list(): Promise<FolderPolicy[]>
  get(policyId: string): Promise<FolderPolicy | undefined>
  findByFolderId(folderId: string): Promise<FolderPolicy | undefined>
  save(policy: FolderPolicy): Promise<FolderPolicy>
  delete(policyId: string): Promise<void>
}
