import type { CloudFormationCustomResourceEvent } from "aws-lambda"
import {
  CreateIndexCommand,
  CreateVectorBucketCommand,
  DeleteIndexCommand,
  DeleteVectorBucketCommand,
  GetIndexCommand,
  GetVectorBucketCommand,
  S3VectorsClient
} from "@aws-sdk/client-s3vectors"

const client = new S3VectorsClient({})

type Props = {
  vectorBucketName: string
  indexName: string
  dimension: number | string
  distanceMetric?: "cosine" | "euclidean"
}

export const handler = async (event: CloudFormationCustomResourceEvent) => {
  const props = event.ResourceProperties as unknown as Props
  const vectorBucketName = props.vectorBucketName
  const indexName = props.indexName
  const dimension = Number(props.dimension)
  const distanceMetric = props.distanceMetric ?? "cosine"
  const physicalResourceId = `${vectorBucketName}/${indexName}`

  if (event.RequestType === "Delete") {
    await ignoreNotFound(() => client.send(new DeleteIndexCommand({ vectorBucketName, indexName })))
    await ignoreNotFound(() => client.send(new DeleteVectorBucketCommand({ vectorBucketName })))
    return { PhysicalResourceId: event.PhysicalResourceId ?? physicalResourceId }
  }

  await ensureVectorBucket(vectorBucketName)
  await ensureIndex(vectorBucketName, indexName, dimension, distanceMetric)

  return {
    PhysicalResourceId: physicalResourceId,
    Data: {
      vectorBucketName,
      indexName
    }
  }
}

async function ensureVectorBucket(vectorBucketName: string) {
  const exists = await existsCall(() => client.send(new GetVectorBucketCommand({ vectorBucketName })))
  if (!exists) {
    await ignoreConflict(() => client.send(new CreateVectorBucketCommand({ vectorBucketName })))
  }
}

async function ensureIndex(vectorBucketName: string, indexName: string, dimension: number, distanceMetric: "cosine" | "euclidean") {
  const exists = await existsCall(() => client.send(new GetIndexCommand({ vectorBucketName, indexName })))
  if (!exists) {
    await ignoreConflict(() =>
      client.send(
        new CreateIndexCommand({
          vectorBucketName,
          indexName,
          dataType: "float32",
          dimension,
          distanceMetric,
          metadataConfiguration: {
            nonFilterableMetadataKeys: ["text"]
          }
        })
      )
    )
  }
}

async function existsCall(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn()
    return true
  } catch (err) {
    if (isNamedError(err, "NotFoundException")) return false
    throw err
  }
}

async function ignoreNotFound(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn()
  } catch (err) {
    if (!isNamedError(err, "NotFoundException")) throw err
  }
}

async function ignoreConflict(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn()
  } catch (err) {
    if (!isNamedError(err, "ConflictException")) throw err
  }
}

function isNamedError(err: unknown, name: string): boolean {
  return typeof err === "object" && err !== null && "name" in err && (err as { name?: string }).name === name
}
