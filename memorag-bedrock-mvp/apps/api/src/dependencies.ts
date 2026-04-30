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

export type Dependencies = {
  objectStore: ObjectStore
  vectorStore: VectorStore
  textModel: TextModel
}

let cached: Dependencies | undefined

export function createDependencies(): Dependencies {
  if (cached) return cached

  const objectStore = config.useLocalVectorStore
    ? new LocalObjectStore(config.localDataDir)
    : new S3ObjectStore(config.docsBucketName)

  const vectorStore = config.useLocalVectorStore
    ? new LocalVectorStore(config.localDataDir)
    : new S3VectorsStore(config.vectorBucketName, config.vectorIndexName)

  const textModel = config.mockBedrock ? new MockBedrockTextModel() : new BedrockTextModel()

  cached = { objectStore, vectorStore, textModel }
  return cached
}
