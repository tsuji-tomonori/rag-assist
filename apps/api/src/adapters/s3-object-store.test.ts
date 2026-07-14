import assert from "node:assert/strict"
import test from "node:test"
import { S3Client } from "@aws-sdk/client-s3"
import { S3ObjectStore } from "./s3-object-store.js"

type SentCommand = { constructor: { name: string }; input: Record<string, unknown> }

test("S3ObjectStore maps object reads, writes, versions, sizes, deletes, and paginated keys", async () => {
  const store = new S3ObjectStore("docs-bucket")
  const sent: SentCommand[] = []
  const responses = [
    {},
    {},
    {},
    { Body: { transformToString: async () => "text-body" } },
    { Body: { transformToString: async () => "versioned" }, ETag: "etag-1" },
    { Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } },
    { ContentLength: 123 },
    {},
    { Contents: [{ Key: "prefix/a" }, {}, { Key: "" }], NextContinuationToken: "page-2" },
    { Contents: [{ Key: "prefix/b" }] }
  ]
  Object.assign(store, {
    client: {
      send: async (command: SentCommand) => {
        sent.push(command)
        return responses.shift()
      }
    }
  })

  await store.putText("a.txt", "hello", "text/custom")
  await store.putTextIfVersion("b.txt", "next", undefined)
  await store.putBytes("c.bin", new Uint8Array([9]))
  assert.equal(await store.getText("a.txt"), "text-body")
  assert.deepEqual(await store.getTextWithVersion("b.txt"), { text: "versioned", version: "etag-1" })
  assert.deepEqual(await store.getBytes("c.bin"), Buffer.from([1, 2, 3]))
  assert.equal(await store.getObjectSize("c.bin"), 123)
  await store.deleteObject("c.bin")
  assert.deepEqual(await store.listKeys("prefix/"), ["prefix/a", "prefix/b"])

  assert.equal(sent[0]?.constructor.name, "PutObjectCommand")
  assert.equal(sent[0]?.input.ContentType, "text/custom")
  assert.equal(sent[1]?.input.IfNoneMatch, "*")
  assert.equal(sent[1]?.input.IfMatch, undefined)
  assert.equal(sent[8]?.input.ContinuationToken, undefined)
  assert.equal(sent[9]?.input.ContinuationToken, "page-2")
})

test("S3ObjectStore handles empty bodies and creates an offline signed upload URL", async () => {
  assert.throws(() => new S3ObjectStore(""), /DOCS_BUCKET_NAME/)
  const store = new S3ObjectStore("docs-bucket")
  const responses = [{}, {}, {}]
  Object.assign(store, { client: { send: async () => responses.shift() } })
  assert.equal(await store.getText("empty"), "")
  assert.deepEqual(await store.getTextWithVersion("empty"), { text: "", version: "" })
  assert.deepEqual(await store.getBytes("empty"), Buffer.alloc(0))

  Object.assign(store, {
    client: new S3Client({
      region: "us-east-1",
      credentials: { accessKeyId: "test-access-key", secretAccessKey: "test-secret-key" }
    })
  })
  const upload = await store.createUploadUrl("folder/file.txt", {
    contentType: "text/plain",
    expiresInSeconds: 60,
    maxBytes: 100
  })
  assert.match(upload.url, /^https:\/\/docs-bucket\.s3\.us-east-1\.amazonaws\.com\/folder\/file\.txt\?/)
  assert.deepEqual(upload.headers, { "Content-Type": "text/plain" })
})
