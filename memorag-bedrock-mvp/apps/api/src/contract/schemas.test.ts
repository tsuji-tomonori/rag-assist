import assert from "node:assert/strict"
import test from "node:test"
import { DocumentUploadRequestSchema, SearchResponseSchema } from "../schemas.js"

test("document metadata schema accepts recursive JSON alias metadata", () => {
  const result = DocumentUploadRequestSchema.safeParse({
    fileName: "policy.md",
    text: "Vacation requests require manager approval.",
    metadata: {
      tenantId: "tenant-a",
      source: "notion",
      docType: "policy",
      searchAliases: {
        pto: ["paid time off", "vacation"],
        vacation: {
          type: "oneWay",
          to: ["annual leave"]
        }
      }
    }
  })

  assert.equal(result.success, true)
})

test("search response diagnostics includes index and alias versions", () => {
  const result = SearchResponseSchema.safeParse({
    query: "pto",
    results: [],
    diagnostics: {
      indexVersion: "lexical:00000000",
      aliasVersion: "alias:00000000",
      lexicalCount: 0,
      semanticCount: 0,
      fusedCount: 0,
      latencyMs: 1
    }
  })

  assert.equal(result.success, true)
})
