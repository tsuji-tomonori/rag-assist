import {
  DeleteVectorsCommand,
  PutVectorsCommand,
  QueryVectorsCommand,
  type QueryVectorsCommandInput,
  S3VectorsClient
} from "@aws-sdk/client-s3vectors"
import { config } from "../config.js"
import type { RetrievedVector, VectorRecord } from "../types.js"
import type { VectorFilter, VectorStore } from "./vector-store.js"

export class S3VectorsStore implements VectorStore {
  private readonly client = new S3VectorsClient({ region: config.region })

  constructor(
    private readonly vectorBucketName: string,
    private readonly indexName: string
  ) {}

  async put(records: VectorRecord[]): Promise<void> {
    for (const batch of chunk(records, 100)) {
      if (batch.length === 0) continue
      await this.client.send(
        new PutVectorsCommand({
          vectorBucketName: this.vectorBucketName,
          indexName: this.indexName,
          vectors: batch.map((record) => ({
            key: record.key,
            data: { float32: record.vector.map((value) => Math.fround(value)) },
            metadata: record.metadata
          }))
        })
      )
    }
  }

  async query(vector: number[], topK: number, filter: VectorFilter = {}): Promise<RetrievedVector[]> {
    const s3Filter = toS3Filter(filter)
    const response = await this.client.send(
      new QueryVectorsCommand({
        vectorBucketName: this.vectorBucketName,
        indexName: this.indexName,
        queryVector: { float32: vector.map((value) => Math.fround(value)) },
        topK,
        returnDistance: true,
        returnMetadata: true,
        filter: s3Filter
      })
    )

    return (response.vectors ?? []).map((item) => {
      const distance = item.distance === undefined ? undefined : Number(item.distance)
      return {
        key: item.key ?? "",
        distance,
        score: distance === undefined ? 0 : 1 - distance,
        metadata: item.metadata as RetrievedVector["metadata"]
      }
    })
  }

  async delete(keys: string[]): Promise<void> {
    for (const batch of chunk(keys, 100)) {
      if (batch.length === 0) continue
      await this.client.send(
        new DeleteVectorsCommand({
          vectorBucketName: this.vectorBucketName,
          indexName: this.indexName,
          keys: batch
        })
      )
    }
  }
}

function toS3Filter(filter: VectorFilter): QueryVectorsCommandInput["filter"] {
  const clauses: NonNullable<QueryVectorsCommandInput["filter"]>[] = []
  if (filter.kind) clauses.push({ kind: { $eq: filter.kind } })
  if (filter.documentId) clauses.push({ documentId: { $eq: filter.documentId } })
  if (filter.tenantId) clauses.push({ tenantId: { $eq: filter.tenantId } } as NonNullable<QueryVectorsCommandInput["filter"]>)
  if (filter.department) clauses.push({ department: { $eq: filter.department } } as NonNullable<QueryVectorsCommandInput["filter"]>)
  if (filter.source) clauses.push({ source: { $eq: filter.source } } as NonNullable<QueryVectorsCommandInput["filter"]>)
  if (filter.docType) clauses.push({ docType: { $eq: filter.docType } } as NonNullable<QueryVectorsCommandInput["filter"]>)
  if (filter.lifecycleStatus) clauses.push({ lifecycleStatus: { $eq: filter.lifecycleStatus } } as NonNullable<QueryVectorsCommandInput["filter"]>)
  if (filter.allowedGroups && filter.allowedGroups.length > 0) {
    clauses.push({ aclGroup: { $in: filter.allowedGroups } } as NonNullable<QueryVectorsCommandInput["filter"]>)
  }
  if (clauses.length === 0) return undefined
  if (clauses.length === 1) return clauses[0]
  return { $and: clauses }
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size))
  return batches
}
