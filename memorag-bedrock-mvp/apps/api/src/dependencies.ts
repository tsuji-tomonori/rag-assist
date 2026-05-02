import { config } from "./config.js"
import path from "node:path"
import { BedrockTextModel } from "./adapters/bedrock.js"
import { LocalObjectStore } from "./adapters/local-object-store.js"
import type { ObjectStore } from "./adapters/object-store.js"
import { S3ObjectStore } from "./adapters/s3-object-store.js"
import type { TextModel } from "./adapters/text-model.js"
import { LocalVectorStore } from "./adapters/local-vector-store.js"
import { MockBedrockTextModel } from "./adapters/mock-bedrock.js"
import { S3VectorsStore } from "./adapters/s3-vectors-store.js"
import type { VectorStore } from "./adapters/vector-store.js"
import { DynamoDbQuestionStore } from "./adapters/dynamodb-question-store.js"
import { LocalQuestionStore } from "./adapters/local-question-store.js"
import type { QuestionStore } from "./adapters/question-store.js"
import { DynamoDbConversationHistoryStore } from "./adapters/dynamodb-conversation-history-store.js"
import { LocalConversationHistoryStore } from "./adapters/local-conversation-history-store.js"
import type { ConversationHistoryStore } from "./adapters/conversation-history-store.js"
import { DynamoDbBenchmarkRunStore } from "./adapters/dynamodb-benchmark-run-store.js"
import { LocalBenchmarkRunStore } from "./adapters/local-benchmark-run-store.js"
import type { BenchmarkRunStore } from "./adapters/benchmark-run-store.js"
import { AliasStore } from "./adapters/alias-store.js"

export type Dependencies = {
  objectStore: ObjectStore
  memoryVectorStore: VectorStore
  evidenceVectorStore: VectorStore
  textModel: TextModel
  questionStore: QuestionStore
  conversationHistoryStore: ConversationHistoryStore
  benchmarkRunStore: BenchmarkRunStore
  aliasStore: AliasStore
}

let cached: Dependencies | undefined

export function createDependencies(): Dependencies {
  if (cached) return cached

  const objectStore = config.useLocalVectorStore
    ? new LocalObjectStore(config.localDataDir)
    : new S3ObjectStore(config.docsBucketName)
  const aliasAuditLogStore = config.useLocalVectorStore
    ? new LocalObjectStore(path.join(config.localDataDir, "alias-audit-log"))
    : new S3ObjectStore(config.aliasAuditLogBucketName)

  const memoryVectorStore = config.useLocalVectorStore
    ? new LocalVectorStore(config.localDataDir, "memory-vectors.json")
    : new S3VectorsStore(config.vectorBucketName, config.memoryVectorIndexName)

  const evidenceVectorStore = config.useLocalVectorStore
    ? new LocalVectorStore(config.localDataDir, "evidence-vectors.json")
    : new S3VectorsStore(config.vectorBucketName, config.evidenceVectorIndexName)

  const textModel = config.mockBedrock ? new MockBedrockTextModel() : new BedrockTextModel()
  const questionStore = config.useLocalQuestionStore
    ? new LocalQuestionStore(config.localDataDir)
    : new DynamoDbQuestionStore(config.questionTableName)
  const conversationHistoryStore = config.useLocalConversationHistoryStore
    ? new LocalConversationHistoryStore(config.localDataDir)
    : new DynamoDbConversationHistoryStore(config.conversationHistoryTableName)
  const benchmarkRunStore = config.useLocalBenchmarkRunStore
    ? new LocalBenchmarkRunStore(config.localDataDir)
    : new DynamoDbBenchmarkRunStore(config.benchmarkRunsTableName)
  const aliasStore = new AliasStore(objectStore, aliasAuditLogStore)

  cached = { objectStore, memoryVectorStore, evidenceVectorStore, textModel, questionStore, conversationHistoryStore, benchmarkRunStore, aliasStore }
  return cached
}
