import assert from "node:assert/strict"
import test from "node:test"
import { resolveRetrievalProfileId } from "./profiles.js"

test("retrieval profile resolver selects default unless adaptive flag is enabled", () => {
  assert.equal(resolveRetrievalProfileId(undefined), "default")
  assert.equal(resolveRetrievalProfileId("default"), "default")
  assert.equal(resolveRetrievalProfileId(undefined, true), "adaptive-retrieval")
  assert.equal(resolveRetrievalProfileId("default", true), "adaptive-retrieval")
})

test("retrieval profile resolver selects adaptive profile by id", () => {
  assert.equal(resolveRetrievalProfileId("adaptive-retrieval"), "adaptive-retrieval")
})

test("retrieval profile resolver rejects unknown ids", () => {
  assert.throws(() => resolveRetrievalProfileId("custom-profile"), /Unknown RAG_PROFILE_ID: custom-profile/)
})
