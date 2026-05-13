import assert from "node:assert/strict"
import test from "node:test"
import { S3ObjectStore } from "./s3-object-store.js"

test("S3 upload URLs do not require a max-size Content-Length header", async () => {
  const previousAccessKeyId = process.env.AWS_ACCESS_KEY_ID
  const previousSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  process.env.AWS_ACCESS_KEY_ID = "test-access-key"
  process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key"

  try {
    const store = new S3ObjectStore("test-bucket")
    const upload = await store.createUploadUrl("uploads/source.pdf", {
      contentType: "application/pdf",
      expiresInSeconds: 60,
      maxBytes: 20 * 1024 * 1024
    })

    assert.equal(upload.headers["Content-Type"], "application/pdf")
    assert.equal(upload.headers["Content-Length"], undefined)
    assert.equal(new URL(upload.url).searchParams.get("X-Amz-SignedHeaders"), "host")
  } finally {
    restoreEnv("AWS_ACCESS_KEY_ID", previousAccessKeyId)
    restoreEnv("AWS_SECRET_ACCESS_KEY", previousSecretAccessKey)
  }
})

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name]
    return
  }
  process.env[name] = value
}
