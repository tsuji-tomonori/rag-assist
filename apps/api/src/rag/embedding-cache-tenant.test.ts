import assert from "node:assert/strict"
import test from "node:test"
import { embedWithCache } from "./offline/pre-retrieval/embedding/embedding-cache.js"

test("FR-060 embedding cache keys are partitioned by authoritative tenant", async () => {
  const records = new Map<string, string>()
  let calls = 0
  const deps = {
    objectStore: {
      getText: async (key: string) => {
        const value = records.get(key)
        if (!value) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" })
        return value
      },
      putText: async (key: string, value: string) => { records.set(key, value) }
    },
    textModel: {
      embed: async () => { calls += 1; return [calls, 0.5] }
    }
  } as any
  const base = { text: "same confidential text", modelId: "embed-v1", dimensions: 2 }

  const tenantAFirst = await embedWithCache(deps, { ...base, partitionKey: "tenant-a" })
  const tenantASecond = await embedWithCache(deps, { ...base, partitionKey: "tenant-a" })
  const tenantB = await embedWithCache(deps, { ...base, partitionKey: "tenant-b" })

  assert.deepEqual(tenantAFirst, tenantASecond)
  assert.notDeepEqual(tenantAFirst, tenantB)
  assert.equal(calls, 2)
  assert.equal(records.size, 2)
  assert.equal([...records.keys()].every((key) => !key.includes("tenant-a") && !key.includes("tenant-b")), true)
})

test("FR-060 embedding cache fails closed without a partition", async () => {
  await assert.rejects(
    () => embedWithCache({} as any, { text: "x", modelId: "m", dimensions: 1, partitionKey: "" }),
    /partition is required/
  )
})
