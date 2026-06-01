import { createHash } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"
import type { ObjectStore, VersionedText } from "./object-store.js"

const conditionalWriteQueues = new Map<string, Promise<void>>()

export class LocalObjectStore implements ObjectStore {
  private readonly objectRoot: string

  constructor(private readonly baseDir: string) {
    this.objectRoot = path.join(baseDir, "objects")
  }

  async putText(key: string, text: string, _contentType?: string): Promise<void> {
    const filePath = this.pathFor(key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, text, "utf-8")
  }

  async putTextIfVersion(key: string, text: string, expectedVersion: string | undefined, _contentType?: string): Promise<void> {
    const filePath = this.pathFor(key)
    await runConditionalWrite(filePath, async () => {
      const currentVersion = await this.versionForFile(filePath)
      if (currentVersion !== expectedVersion) throw conditionalWriteError(key)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, text, "utf-8")
    })
  }

  async putBytes(key: string, bytes: Uint8Array, _contentType?: string): Promise<void> {
    const filePath = this.pathFor(key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, bytes)
  }

  async getText(key: string): Promise<string> {
    return fs.readFile(this.pathFor(key), "utf-8")
  }

  async getTextWithVersion(key: string): Promise<VersionedText> {
    const filePath = this.pathFor(key)
    const text = await fs.readFile(filePath, "utf-8")
    return { text, version: versionForText(text) }
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

  private async versionForFile(filePath: string): Promise<string | undefined> {
    try {
      return versionForText(await fs.readFile(filePath, "utf-8"))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined
      throw err
    }
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

async function runConditionalWrite(filePath: string, task: () => Promise<void>): Promise<void> {
  const previous = conditionalWriteQueues.get(filePath) ?? Promise.resolve()
  let release: () => void = () => undefined
  const current = new Promise<void>((resolve) => {
    release = resolve
  })
  const queued = previous.then(() => current, () => current)
  conditionalWriteQueues.set(filePath, queued)
  await previous.catch(() => undefined)
  try {
    await task()
  } finally {
    release()
    if (conditionalWriteQueues.get(filePath) === queued) {
      conditionalWriteQueues.delete(filePath)
    }
  }
}

function versionForText(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

function conditionalWriteError(key: string): Error {
  const err = new Error(`Conditional write failed for ${key}`)
  Object.assign(err, { code: "PRECONDITION_FAILED" })
  return err
}
