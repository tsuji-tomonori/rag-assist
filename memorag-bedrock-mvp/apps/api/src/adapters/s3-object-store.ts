import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { config } from "../config.js"
import type { ObjectStore } from "./object-store.js"

export class S3ObjectStore implements ObjectStore {
  private readonly client = new S3Client({ region: config.region })

  constructor(private readonly bucketName: string) {
    if (!bucketName) throw new Error("DOCS_BUCKET_NAME is required when USE_LOCAL_VECTOR_STORE=false")
  }

  async putText(key: string, text: string, contentType = "text/plain; charset=utf-8"): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: text,
        ContentType: contentType
      })
    )
  }

  async putBytes(key: string, bytes: Uint8Array, contentType = "application/octet-stream"): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: bytes,
        ContentType: contentType
      })
    )
  }

  async getText(key: string): Promise<string> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: key }))
    return response.Body?.transformToString("utf-8") ?? ""
  }

  async getBytes(key: string): Promise<Buffer> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: key }))
    const bytes = await response.Body?.transformToByteArray()
    return Buffer.from(bytes ?? [])
  }

  async getObjectSize(key: string): Promise<number> {
    const response = await this.client.send(new HeadObjectCommand({ Bucket: this.bucketName, Key: key }))
    return response.ContentLength ?? 0
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }))
  }

  async listKeys(prefix: string): Promise<string[]> {
    const keys: string[] = []
    let continuationToken: string | undefined
    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken
        })
      )
      const pageKeys = response.Contents?.map((item) => item.Key).filter((key): key is string => Boolean(key)) ?? []
      keys.push(...pageKeys)
      continuationToken = response.NextContinuationToken
    } while (continuationToken)
    return keys
  }

  async createUploadUrl(key: string, input: { contentType?: string; expiresInSeconds: number; maxBytes?: number }): Promise<{ url: string; headers: Record<string, string> }> {
    const contentType = input.contentType ?? "application/octet-stream"
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType
    })
    return {
      url: await getSignedUrl(this.client, command, { expiresIn: input.expiresInSeconds }),
      headers: {
        "Content-Type": contentType
      }
    }
  }
}
