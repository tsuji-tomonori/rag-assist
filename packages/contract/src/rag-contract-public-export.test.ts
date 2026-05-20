import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const contractSrcDir = path.dirname(fileURLToPath(import.meta.url))

test("RAG placeholder contracts are not exported from the package root", () => {
  const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8")

  assert.doesNotMatch(source, /from ["']\.\/rag\/index\.js["']/)
})

test("RAG placeholder contract files are not kept when RAG contract is out of scope", () => {
  const ragDir = path.join(contractSrcDir, "rag")

  assert.equal(
    existsSync(ragDir),
    false,
    "packages/contract/src/rag should be removed until real RAG contracts are implemented"
  )
})
