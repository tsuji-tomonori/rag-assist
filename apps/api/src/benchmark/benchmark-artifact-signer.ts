import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { config } from "../config.js"
import type { BenchmarkArtifactSignInput } from "./benchmark-artifact-download-service.js"

export type BenchmarkArtifactPresigner = (
  client: S3Client,
  command: GetObjectCommand,
  options: { expiresIn: number }
) => Promise<string>

const defaultPresigner: BenchmarkArtifactPresigner = (client, command, options) => (
  getSignedUrl(client, command, options)
)

export async function signBenchmarkArtifact(
  input: BenchmarkArtifactSignInput,
  client: S3Client = new S3Client({ region: config.region }),
  presigner: BenchmarkArtifactPresigner = defaultPresigner
): Promise<string> {
  return presigner(client, new GetObjectCommand({
    Bucket: input.bucketName,
    Key: input.objectKey,
    ResponseContentDisposition: input.contentDisposition
  }), { expiresIn: input.expiresInSeconds })
}
