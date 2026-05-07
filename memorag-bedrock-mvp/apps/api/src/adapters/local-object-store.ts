import { promises as fs } from "node:fs"
import path from "node:path"
import type { ObjectStore } from "./object-store.js"

export class LocalObjectStore implements ObjectStore {
  private readonly objectRoot: string

  constructor(private readonly baseDir: string) {
    this.objectRoot = path.join(baseDir, "objects")
  }

  async putText(key: string, text: string): Promise<void> {
    const filePath = this.pathFor(key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, text, "utf-8")
  }

  async putBytes(key: string, bytes: Uint8Array): Promise<void> {
    const filePath = this.pathFor(key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, bytes)
  }

  async getText(key: string): Promise<string> {
    return fs.readFile(this.pathFor(key), "utf-8")
  }

  async getBytes(key: string): Promise<Buffer> {
    return fs.readFile(this.pathFor(key))
  }

  async getObjectSize(key: string): Promise<number> {
    const stats = await fs.stat(this.pathFor(key))
    return stats.size
  }

  async deleteObject(key: string): Promise<void> {
    await fs.rm(this.pathFor(key), { force: true })
  }

  async listKeys(prefix: string): Promise<string[]> {
    const dir = this.pathFor(prefix)
    try {
      const entries = await walk(dir)
      return entries.map((entry) => path.relative(this.objectRoot, entry).split(path.sep).join("/"))
    } catch {
      return []
    }
  }

  private pathFor(key: string): string {
    const safe = key.replace(/^\/+/, "")
    return path.join(this.objectRoot, safe)
  }
}

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name)
      return entry.isDirectory() ? walk(full) : Promise.resolve([full])
    })
  )
  return files.flat()
}
