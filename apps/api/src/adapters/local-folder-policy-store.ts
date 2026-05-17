import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { FolderPolicy } from "../types.js"
import type { FolderPolicyStore } from "./folder-policy-store.js"

type FolderPolicyDb = {
  schemaVersion: 1
  policies: FolderPolicy[]
}

export class LocalFolderPolicyStore implements FolderPolicyStore {
  constructor(private readonly baseDir: string) {}

  async list(): Promise<FolderPolicy[]> {
    return (await this.read()).policies
  }

  async get(policyId: string): Promise<FolderPolicy | undefined> {
    return (await this.read()).policies.find((policy) => policy.policyId === policyId)
  }

  async findByFolderId(folderId: string): Promise<FolderPolicy | undefined> {
    return (await this.read()).policies.find((policy) => policy.folderId === folderId)
  }

  async save(policy: FolderPolicy): Promise<FolderPolicy> {
    const db = await this.read()
    const next = { ...policy, itemType: "folderPolicy" as const }
    const index = db.policies.findIndex((item) => item.policyId === next.policyId)
    if (index >= 0) db.policies[index] = next
    else db.policies.push(next)
    await this.write(db)
    return next
  }

  async delete(policyId: string): Promise<void> {
    const db = await this.read()
    db.policies = db.policies.filter((policy) => policy.policyId !== policyId)
    await this.write(db)
  }

  private async read(): Promise<FolderPolicyDb> {
    try {
      const raw = JSON.parse(await readFile(this.filePath(), "utf-8")) as Partial<FolderPolicyDb>
      return {
        schemaVersion: 1,
        policies: Array.isArray(raw.policies) ? raw.policies : []
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: 1, policies: [] }
      throw err
    }
  }

  private async write(db: FolderPolicyDb): Promise<void> {
    const targetPath = this.filePath()
    const targetDir = path.dirname(targetPath)
    const tempPath = path.join(targetDir, `.folder-policies.${randomUUID()}.tmp`)
    await mkdir(targetDir, { recursive: true })
    await writeFile(tempPath, JSON.stringify({ schemaVersion: 1, policies: db.policies }, null, 2))
    await rename(tempPath, targetPath)
  }

  private filePath(): string {
    return path.join(this.baseDir, "folder-policies.json")
  }
}
