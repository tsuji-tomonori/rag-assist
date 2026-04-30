import { promises as fs } from "node:fs"
import path from "node:path"
import type { RetrievedVector, VectorRecord } from "../types.js"
import type { VectorFilter, VectorStore } from "./vector-store.js"

type Persisted = {
  records: VectorRecord[]
}

export class LocalVectorStore implements VectorStore {
  private readonly filePath: string

  constructor(baseDir: string) {
    this.filePath = path.join(baseDir, "vectors.json")
  }

  async put(records: VectorRecord[]): Promise<void> {
    if (records.length === 0) return
    const db = await this.load()
    const byKey = new Map(db.records.map((record) => [record.key, record]))
    for (const record of records) byKey.set(record.key, record)
    await this.save({ records: [...byKey.values()] })
  }

  async query(vector: number[], topK: number, filter: VectorFilter = {}): Promise<RetrievedVector[]> {
    const db = await this.load()
    return db.records
      .filter((record) => (filter.kind ? record.metadata.kind === filter.kind : true))
      .filter((record) => (filter.documentId ? record.metadata.documentId === filter.documentId : true))
      .map((record) => ({
        key: record.key,
        score: cosineSimilarity(vector, record.vector),
        metadata: record.metadata
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  async delete(keys: string[]): Promise<void> {
    if (keys.length === 0) return
    const set = new Set(keys)
    const db = await this.load()
    await this.save({ records: db.records.filter((record) => !set.has(record.key)) })
  }

  private async load(): Promise<Persisted> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8")
      return JSON.parse(raw) as Persisted
    } catch {
      return { records: [] }
    }
  }

  private async save(db: Persisted): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    await fs.writeFile(this.filePath, JSON.stringify(db, null, 2), "utf-8")
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    dot += av * bv
    normA += av * av
    normB += bv * bv
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
