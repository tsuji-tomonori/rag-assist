import assert from "node:assert/strict"
import test from "node:test"
import { ChatResponseSchema, DocumentUploadRequestSchema, SearchResponseSchema } from "../schemas.js"

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

test("chat response clarification schema strips internal rejected options", () => {
  const result = ChatResponseSchema.parse({
    responseType: "clarification",
    answer: "どの申請種別の期限を確認しますか？",
    isAnswerable: false,
    needsClarification: true,
    clarification: {
      needsClarification: true,
      reason: "multiple_candidate_intents",
      question: "どの申請種別の期限を確認しますか？",
      options: [],
      missingSlots: ["申請種別"],
      confidence: 0.8,
      groundedOptionCount: 2,
      rejectedOptions: ["confidential-internal-policy.txt"]
    },
    citations: [],
    retrieved: []
  })

  assert.equal(Object.hasOwn(result.clarification ?? {}, "rejectedOptions"), false)
})
