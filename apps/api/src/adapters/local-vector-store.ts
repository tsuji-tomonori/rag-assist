import { promises as fs } from "node:fs"
import path from "node:path"
import type { RetrievedVector, VectorRecord } from "../types.js"
import type { VectorFilter, VectorStore } from "./vector-store.js"

type Persisted = {
  records: VectorRecord[]
}

export class LocalVectorStore implements VectorStore {
  private readonly filePath: string

  constructor(baseDir: string, fileName = "vectors.json") {
    this.filePath = path.join(baseDir, fileName)
  }

  async put(records: VectorRecord[]): Promise<void> {
    if (records.length === 0) return
    const db = await this.load()
    const byKey = new Map(db.records.map((record) => [record.key, record]))
    for (const record of records) byKey.set(record.key, record)
    await this.save({ records: [...byKey.values()] })
  }

  async getByKeys(keys: string[]): Promise<VectorRecord[]> {
    if (keys.length === 0) return []
    const requested = new Set(keys)
    const db = await this.load()
    const byKey = new Map(db.records.filter((record) => requested.has(record.key)).map((record) => [record.key, record]))
    return keys.map((key) => byKey.get(key)).filter((record): record is VectorRecord => record !== undefined)
  }

  async query(vector: number[], topK: number, filter: VectorFilter = {}): Promise<RetrievedVector[]> {
    const db = await this.load()
    return db.records
      .filter((record) => (filter.kind ? record.metadata.kind === filter.kind : true))
      .filter((record) => (filter.documentId ? record.metadata.documentId === filter.documentId : true))
      .filter((record) => (filter.documentIds ? filter.documentIds.includes(record.metadata.documentId) : true))
      .filter((record) => (filter.tenantId ? record.metadata.tenantId === filter.tenantId : true))
      .filter((record) => (filter.department ? record.metadata.department === filter.department : true))
      .filter((record) => (filter.source ? record.metadata.source === filter.source : true))
      .filter((record) => (filter.docType ? record.metadata.docType === filter.docType : true))
      .filter((record) => (filter.benchmarkSuiteId ? record.metadata.benchmarkSuiteId === filter.benchmarkSuiteId : true))
      .filter((record) => (filter.lifecycleStatus ? record.metadata.lifecycleStatus === filter.lifecycleStatus : true))
      .filter((record) => (filter.ragEligibility ? record.metadata.ragEligibility === filter.ragEligibility : true))
      .filter((record) => {
        if (!filter.allowedGroups || filter.allowedGroups.length === 0) return true
        if (!record.metadata.aclGroup && !record.metadata.aclGroups) return false
        const aclGroups = record.metadata.aclGroups ?? (record.metadata.aclGroup ? [record.metadata.aclGroup] : [])
        return aclGroups.some((group) => filter.allowedGroups?.includes(group))
      })
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

  async updateMetadataForDocument(documentId: string, metadata: Partial<VectorRecord["metadata"]>): Promise<void> {
    const db = await this.load()
    await this.save({
      records: db.records.map((record) => record.metadata.documentId === documentId
        ? { ...record, metadata: { ...record.metadata, ...metadata } }
        : record)
    })
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
