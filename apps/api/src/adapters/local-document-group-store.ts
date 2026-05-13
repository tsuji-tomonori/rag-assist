import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { DocumentGroup } from "../types.js"
import type { CreateDocumentGroupInput, DocumentGroupStore, UpdateDocumentGroupInput } from "./document-group-store.js"

type DocumentGroupDb = {
  schemaVersion: 1
  groups: DocumentGroup[]
}

export class LocalDocumentGroupStore implements DocumentGroupStore {
  constructor(private readonly baseDir: string) {}

  async list(): Promise<DocumentGroup[]> {
    return (await this.read()).groups
  }

  async get(groupId: string): Promise<DocumentGroup | undefined> {
    return (await this.read()).groups.find((group) => group.groupId === groupId)
  }

  async create(input: CreateDocumentGroupInput): Promise<DocumentGroup> {
    const db = await this.read()
    if (db.groups.some((group) => group.groupId === input.groupId)) throw new Error("Document group already exists")
    db.groups.push(input)
    await this.write(db)
    return input
  }

  async update(groupId: string, input: UpdateDocumentGroupInput): Promise<DocumentGroup> {
    const db = await this.read()
    const index = db.groups.findIndex((group) => group.groupId === groupId)
    if (index < 0) throw new Error("Document group not found")
    const current = db.groups[index] as DocumentGroup
    const next: DocumentGroup = { ...current, ...input, updatedAt: input.updatedAt ?? new Date().toISOString() }
    db.groups[index] = next
    await this.write(db)
    return next
  }

  private async read(): Promise<DocumentGroupDb> {
    try {
      const raw = JSON.parse(await readFile(this.filePath(), "utf-8")) as DocumentGroupDb
      return {
        schemaVersion: 1,
        groups: Array.isArray(raw.groups) ? raw.groups : []
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: 1, groups: [] }
      throw err
    }
  }

  private async write(db: DocumentGroupDb): Promise<void> {
    const targetPath = this.filePath()
    const targetDir = path.dirname(targetPath)
    const tempPath = path.join(targetDir, `.document-groups.${randomUUID()}.tmp`)
    await mkdir(targetDir, { recursive: true })
    await writeFile(tempPath, JSON.stringify({ schemaVersion: 1, groups: db.groups }, null, 2))
    await rename(tempPath, targetPath)
  }

  private filePath(): string {
    return path.join(this.baseDir, "document-groups.json")
  }
}
