import { config } from "./config.js"
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
import { DynamoDbChatRunStore } from "./adapters/dynamodb-chat-run-store.js"
import { LocalChatRunStore } from "./adapters/local-chat-run-store.js"
import type { ChatRunStore } from "./adapters/chat-run-store.js"
import { DynamoDbChatRunEventStore } from "./adapters/dynamodb-chat-run-event-store.js"
import { LocalChatRunEventStore } from "./adapters/local-chat-run-event-store.js"
import type { ChatRunEventStore } from "./adapters/chat-run-event-store.js"
import { DynamoDbDocumentIngestRunStore } from "./adapters/dynamodb-document-ingest-run-store.js"
import { LocalDocumentIngestRunStore } from "./adapters/local-document-ingest-run-store.js"
import type { DocumentIngestRunStore } from "./adapters/document-ingest-run-store.js"
import { DynamoDbDocumentIngestRunEventStore } from "./adapters/dynamodb-document-ingest-run-event-store.js"
import { LocalDocumentIngestRunEventStore } from "./adapters/local-document-ingest-run-event-store.js"
import type { DocumentIngestRunEventStore } from "./adapters/document-ingest-run-event-store.js"
import { DynamoDbDocumentGroupStore } from "./adapters/dynamodb-document-group-store.js"
import { LocalDocumentGroupStore } from "./adapters/local-document-group-store.js"
import type { DocumentGroupStore } from "./adapters/document-group-store.js"
import { CognitoUserDirectory, type UserDirectory } from "./adapters/user-directory.js"
import { AwsCodeBuildLogReader, type CodeBuildLogReader } from "./adapters/codebuild-log-reader.js"

export type Dependencies = {
  objectStore: ObjectStore
  memoryVectorStore: VectorStore
  evidenceVectorStore: VectorStore
  textModel: TextModel
  questionStore: QuestionStore
  conversationHistoryStore: ConversationHistoryStore
  benchmarkRunStore: BenchmarkRunStore
  chatRunStore: ChatRunStore
  chatRunEventStore: ChatRunEventStore
  documentIngestRunStore: DocumentIngestRunStore
  documentIngestRunEventStore: DocumentIngestRunEventStore
  documentGroupStore: DocumentGroupStore
  codeBuildLogReader?: CodeBuildLogReader
  userDirectory?: UserDirectory
}

let cached: Dependencies | undefined

export function createDependencies(): Dependencies {
  if (cached) return cached

  const objectStore = config.useLocalVectorStore
    ? new LocalObjectStore(config.localDataDir)
    : new S3ObjectStore(config.docsBucketName)

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
  const chatRunStore = config.useLocalChatRunStore
    ? new LocalChatRunStore(config.localDataDir)
    : new DynamoDbChatRunStore(config.chatRunsTableName)
  const chatRunEventStore = config.useLocalChatRunStore
    ? new LocalChatRunEventStore(config.localDataDir)
    : new DynamoDbChatRunEventStore(config.chatRunEventsTableName)
  const documentIngestRunStore = config.useLocalDocumentIngestRunStore
    ? new LocalDocumentIngestRunStore(config.localDataDir)
    : new DynamoDbDocumentIngestRunStore(config.documentIngestRunsTableName)
  const documentIngestRunEventStore = config.useLocalDocumentIngestRunStore
    ? new LocalDocumentIngestRunEventStore(config.localDataDir)
    : new DynamoDbDocumentIngestRunEventStore(config.documentIngestRunEventsTableName)
  const documentGroupStore = config.useLocalDocumentGroupStore
    ? new LocalDocumentGroupStore(config.localDataDir)
    : new DynamoDbDocumentGroupStore(config.documentGroupsTableName)
  const codeBuildLogReader = new AwsCodeBuildLogReader()
  const userDirectory = config.authEnabled && config.cognitoUserPoolId ? new CognitoUserDirectory() : undefined

  cached = { objectStore, memoryVectorStore, evidenceVectorStore, textModel, questionStore, conversationHistoryStore, benchmarkRunStore, chatRunStore, chatRunEventStore, documentIngestRunStore, documentIngestRunEventStore, documentGroupStore, codeBuildLogReader, userDirectory }
  return cached
}
