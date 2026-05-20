import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("RAG placeholder contracts are not exported from the package root", () => {
  const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8")

  assert.doesNotMatch(source, /from ["']\.\/rag\/index\.js["']/)
})

test("RAG contracts are not presented as package-root API while they are id/version shells", () => {
  const files = [
    "rag/online/rag-query-run.contract.ts",
    "rag/online/rag-answer.contract.ts",
    "rag/online/retrieved-evidence.contract.ts",
    "rag/online/citation.contract.ts"
  ]

  const packageRoot = readFileSync(new URL("./index.ts", import.meta.url), "utf8")
  if (!/from ["']\.\/rag\/index\.js["']/.test(packageRoot)) {
    assert.ok(true)
    return
  }

  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8")
    assert.doesNotMatch(
      source,
      /{\s*id:\s*string\s*version:\s*string\s*}/s,
      `${file} is still a placeholder contract`
    )
  }
})
