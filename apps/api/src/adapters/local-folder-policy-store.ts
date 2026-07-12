import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { FolderPolicy } from "../types.js"
import { tenantPartitionId } from "../security/tenant-partition.js"
import {
  folderPolicyConflictError,
  folderPolicyStateVersion,
  type FolderPolicyStore,
  type VersionedFolderPolicyState
} from "./folder-policy-store.js"

type FolderPolicyDb = {
  schemaVersion: 1
  policies: FolderPolicy[]
}

const folderPolicyWriteQueues = new Map<string, Promise<void>>()

export class LocalFolderPolicyStore implements FolderPolicyStore {
  constructor(private readonly baseDir: string) {}

  async list(tenantId: string): Promise<FolderPolicy[]> {
    return (await this.read(tenantId)).policies
  }

  async get(tenantId: string, policyId: string): Promise<FolderPolicy | undefined> {
    return (await this.read(tenantId)).policies.find((policy) => policy.policyId === policyId)
  }

  async findByFolderId(tenantId: string, folderId: string): Promise<FolderPolicy | undefined> {
    return uniquePolicyForFolder((await this.read(tenantId)).policies, folderId)
  }

  async save(policy: FolderPolicy): Promise<FolderPolicy> {
    return runFolderPolicyWrite(this.filePath(policy.tenantId), async () => {
      const db = await this.read(policy.tenantId)
      const next = { ...policy, itemType: "folderPolicy" as const }
      uniquePolicyForFolder(db.policies, next.folderId)
      db.policies = [
        ...db.policies.filter((item) => item.folderId !== next.folderId && item.policyId !== next.policyId),
        next
      ]
      await this.write(policy.tenantId, db)
      return next
    })
  }

  async delete(tenantId: string, policyId: string): Promise<void> {
    await runFolderPolicyWrite(this.filePath(tenantId), async () => {
      const db = await this.read(tenantId)
      db.policies = db.policies.filter((policy) => policy.policyId !== policyId)
      await this.write(tenantId, db)
    })
  }

  async getVersionedByFolderId(tenantId: string, folderId: string): Promise<VersionedFolderPolicyState> {
    const policy = uniquePolicyForFolder((await this.read(tenantId)).policies, folderId)
    return { policy, version: folderPolicyStateVersion(policy) }
  }

  async replaceForFolder(policy: FolderPolicy, expectedVersion: string): Promise<VersionedFolderPolicyState> {
    return runFolderPolicyWrite(this.filePath(policy.tenantId), async () => {
      const db = await this.read(policy.tenantId)
      const current = uniquePolicyForFolder(db.policies, policy.folderId)
      if (folderPolicyStateVersion(current) !== expectedVersion) throw folderPolicyConflictError(policy.folderId)
      const next = { ...policy, itemType: "folderPolicy" as const }
      db.policies = [...db.policies.filter((candidate) => candidate.folderId !== policy.folderId), next]
      await this.write(policy.tenantId, db)
      return { policy: next, version: folderPolicyStateVersion(next) }
    })
  }

  private async read(tenantId: string): Promise<FolderPolicyDb> {
    try {
      const raw = JSON.parse(await readFile(this.filePath(tenantId), "utf-8")) as Partial<FolderPolicyDb>
      const db: FolderPolicyDb = {
        schemaVersion: 1,
        policies: Array.isArray(raw.policies) ? raw.policies : []
      }
      if (db.policies.some((policy) => policy.tenantId !== tenantId)) throw new Error("Folder policy tenant partition is invalid")
      return db
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        await this.assertNoLegacyStore()
        return { schemaVersion: 1, policies: [] }
      }
      throw err
    }
  }

  private async write(tenantId: string, db: FolderPolicyDb): Promise<void> {
    const targetPath = this.filePath(tenantId)
    const targetDir = path.dirname(targetPath)
    const tempPath = path.join(targetDir, `.folder-policies.${randomUUID()}.tmp`)
    await mkdir(targetDir, { recursive: true })
    await writeFile(tempPath, JSON.stringify({ schemaVersion: 1, policies: db.policies }, null, 2))
    await rename(tempPath, targetPath)
  }

  private filePath(tenantId: string): string {
    return path.join(this.baseDir, "folder-policies", tenantPartitionId(tenantId), "items.json")
  }

  private async assertNoLegacyStore(): Promise<void> {
    try {
      await readFile(path.join(this.baseDir, "folder-policies.json"), "utf-8")
      throw new Error("Legacy unscoped folder policies require tenant migration")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return
      throw error
    }
  }
}

function uniquePolicyForFolder(policies: readonly FolderPolicy[], folderId: string): FolderPolicy | undefined {
  const matches = policies.filter((policy) => policy.folderId === folderId)
  if (matches.length > 1) throw new Error(`Multiple folder policies exist for ${folderId}`)
  return matches[0]
}

async function runFolderPolicyWrite<T>(filePath: string, task: () => Promise<T>): Promise<T> {
  const previous = folderPolicyWriteQueues.get(filePath) ?? Promise.resolve()
  let release: () => void = () => undefined
  const current = new Promise<void>((resolve) => { release = resolve })
  const queued = previous.then(() => current, () => current)
  folderPolicyWriteQueues.set(filePath, queued)
  await previous.catch(() => undefined)
  try {
    return await task()
  } finally {
    release()
    if (folderPolicyWriteQueues.get(filePath) === queued) folderPolicyWriteQueues.delete(filePath)
  }
}
