import assert from "node:assert/strict"
import test from "node:test"
import type { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import {
  signBenchmarkArtifact,
  type BenchmarkArtifactPresigner
} from "./benchmark-artifact-signer.js"

test("signBenchmarkArtifact maps exact S3 object, attachment metadata, and TTL", async () => {
  const commands: GetObjectCommand[] = []
  const expirationOptions: Array<{ expiresIn: number }> = []
  const client = {} as S3Client
  const presigner: BenchmarkArtifactPresigner = async (receivedClient, command, options) => {
    assert.equal(receivedClient, client)
    commands.push(command)
    expirationOptions.push(options)
    return "https://signed.invalid/report"
  }

  const url = await signBenchmarkArtifact({
    bucketName: "benchmark-bucket",
    objectKey: "runs/run-1/report.md",
    contentDisposition: 'attachment; filename="benchmark-report-run-1.md"',
    expiresInSeconds: 900
  }, client, presigner)

  assert.equal(url, "https://signed.invalid/report")
  assert.equal(commands.length, 1)
  assert.deepEqual(commands[0]?.input, {
    Bucket: "benchmark-bucket",
    Key: "runs/run-1/report.md",
    ResponseContentDisposition: 'attachment; filename="benchmark-report-run-1.md"'
  })
  assert.deepEqual(expirationOptions, [{ expiresIn: 900 }])
})
