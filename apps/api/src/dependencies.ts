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
import { DynamoDbFavoriteStore } from "./adapters/dynamodb-favorite-store.js"
import type { FavoriteStore } from "./adapters/favorite-store.js"
import { LocalFavoriteStore } from "./adapters/local-favorite-store.js"
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
import { DynamoDbFolderPolicyStore } from "./adapters/dynamodb-folder-policy-store.js"
import { LocalFolderPolicyStore } from "./adapters/local-folder-policy-store.js"
import type { FolderPolicyStore } from "./adapters/folder-policy-store.js"
import { DynamoDbUserGroupStore } from "./adapters/dynamodb-user-group-store.js"
import { LocalUserGroupStore } from "./adapters/local-user-group-store.js"
import type { UserGroupStore } from "./adapters/user-group-store.js"
import { DynamoDbGroupMembershipStore } from "./adapters/dynamodb-group-membership-store.js"
import { LocalGroupMembershipStore } from "./adapters/local-group-membership-store.js"
import type { GroupMembershipStore } from "./adapters/group-membership-store.js"
import { CognitoUserDirectory, type UserDirectory } from "./adapters/user-directory.js"
import { AwsCodeBuildLogReader, type CodeBuildLogReader } from "./adapters/codebuild-log-reader.js"
import { createDefaultAsyncAgentProviderRegistry } from "./async-agent/claude-code-provider.js"
import type { AsyncAgentProviderRegistry } from "./async-agent/provider.js"

export type Dependencies = {
  objectStore: ObjectStore
  memoryVectorStore: VectorStore
  evidenceVectorStore: VectorStore
  textModel: TextModel
  questionStore: QuestionStore
  conversationHistoryStore: ConversationHistoryStore
  favoriteStore: FavoriteStore
  benchmarkRunStore: BenchmarkRunStore
  chatRunStore: ChatRunStore
  chatRunEventStore: ChatRunEventStore
  documentIngestRunStore: DocumentIngestRunStore
  documentIngestRunEventStore: DocumentIngestRunEventStore
  documentGroupStore: DocumentGroupStore
  folderPolicyStore: FolderPolicyStore
  userGroupStore: UserGroupStore
  groupMembershipStore: GroupMembershipStore
  codeBuildLogReader?: CodeBuildLogReader
  asyncAgentProviders?: AsyncAgentProviderRegistry
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
  const useLegacyLocalStoresForTests = process.env.MEMORAG_ALLOW_LEGACY_LOCAL_STORE_FOR_TESTS === "true"
  const questionStore = useLegacyLocalStoresForTests ? new LocalQuestionStore(config.localDataDir) : new DynamoDbQuestionStore(config.questionTableName)
  const conversationHistoryStore = useLegacyLocalStoresForTests ? new LocalConversationHistoryStore(config.localDataDir) : new DynamoDbConversationHistoryStore(config.conversationHistoryTableName)
  const favoriteStore = useLegacyLocalStoresForTests ? new LocalFavoriteStore(config.localDataDir) : new DynamoDbFavoriteStore(config.favoritesTableName)
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
  const folderPolicyStore = config.useLocalDocumentGroupStore
    ? new LocalFolderPolicyStore(config.localDataDir)
    : new DynamoDbFolderPolicyStore(config.documentGroupsTableName)
  const userGroupStore = config.useLocalDocumentGroupStore
    ? new LocalUserGroupStore(config.localDataDir)
    : new DynamoDbUserGroupStore(config.documentGroupsTableName)
  const groupMembershipStore = config.useLocalDocumentGroupStore
    ? new LocalGroupMembershipStore(config.localDataDir)
    : new DynamoDbGroupMembershipStore(config.documentGroupsTableName)
  const codeBuildLogReader = new AwsCodeBuildLogReader()
  const asyncAgentProviders = createDefaultAsyncAgentProviderRegistry()
  const userDirectory = config.authEnabled && config.cognitoUserPoolId ? new CognitoUserDirectory() : undefined

  cached = { objectStore, memoryVectorStore, evidenceVectorStore, textModel, questionStore, conversationHistoryStore, favoriteStore, benchmarkRunStore, chatRunStore, chatRunEventStore, documentIngestRunStore, documentIngestRunEventStore, documentGroupStore, folderPolicyStore, userGroupStore, groupMembershipStore, codeBuildLogReader, asyncAgentProviders, userDirectory }
  return cached
}

export function resetDependenciesForTest(): void {
  cached = undefined
}
