import { describe, expect, it } from "vitest"
import type { ConversationHistoryItem } from "../types.js"
import { searchConversationHistory } from "./conversationHistorySearch.js"

describe("searchConversationHistory", () => {
  it("matches Japanese phrase variants with n-grams", () => {
    const history = [
      item("split", "経費 精算", "経費 精算 の期限を教えて"),
      item("particle", "申請", "経費の精算はいつまでですか"),
      item("phrase", "経費精算の期限", "経費精算の期限は翌月5営業日です"),
      item("other", "休暇", "PTO の申請方法")
    ]

    const results = searchConversationHistory(history, "経費精算")

    expect(results.map((result) => result.item.id)).toEqual(["phrase", "split", "particle"])
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0)
  })

  it("does not match long Japanese queries on only one weak n-gram", () => {
    const history = [
      item("one", "分類一", "分類一について"),
      item("two", "分類二", "分類二について")
    ]

    expect(searchConversationHistory(history, "分類一").map((result) => result.item.id)).toEqual(["one"])
  })

  it("normalizes case and full-width ASCII", () => {
    const history = [
      item("pto", "休暇", "ＰＴＯ の申請期限"),
      item("other", "経費", "approval workflow")
    ]

    expect(searchConversationHistory(history, "pto").map((result) => result.item.id)).toEqual(["pto"])
    expect(searchConversationHistory(history, "ＰＴＯ").map((result) => result.item.id)).toEqual(["pto"])
  })

  it("uses ASCII prefix and typo matching without fuzzy matching very short terms", () => {
    const history = [
      item("approval", "承認", "approval workflow"),
      item("short", "短語", "ac workflow")
    ]

    expect(searchConversationHistory(history, "app").map((result) => result.item.id)).toEqual(["approval"])
    expect(searchConversationHistory(history, "approvl").map((result) => result.item.id)).toEqual(["approval"])
    expect(searchConversationHistory(history, "ab")).toEqual([])
  })

  it("keeps exact and user-message matches ahead of fuzzy matches", () => {
    const history = [
      item("fuzzy", "承認", "aproval workflow"),
      item("exact", "approval", "承認フロー"),
      item("user", "申請", "approval は必要ですか")
    ]

    const results = searchConversationHistory(history, "approval")

    expect(results.map((result) => result.item.id).slice(0, 2)).toEqual(["exact", "user"])
    expect(results[0]?.score).toBeGreaterThan(searchConversationHistory(history, "approvl")[0]?.score ?? 0)
  })

  it("uses favorites and recency as tie-breakers for close matches", () => {
    const history = [
      item("old", "承認", "approval", { updatedAt: "2026-05-01T00:00:00.000Z" }),
      item("new", "承認", "approval", { updatedAt: "2026-05-03T00:00:00.000Z" }),
      item("favorite", "承認", "approval", { updatedAt: "2026-05-02T00:00:00.000Z", isFavorite: true })
    ]

    expect(searchConversationHistory(history, "approval").map((result) => result.item.id)).toEqual(["favorite", "new", "old"])
  })

  it("searches allowed conversation fields but not retrieved full text or private ticket metadata", () => {
    const history: ConversationHistoryItem[] = [
      item("ticket", "担当者確認", "確認を依頼", {
        questionTicket: {
          questionId: "q-1",
          title: "経費精算の期限",
          question: "経費精算の締切を確認したい",
          requesterName: "Requester",
          requesterDepartment: "Sales",
          assigneeDepartment: "HR",
          category: "policy",
          priority: "normal",
          status: "open",
          internalMemo: "internal-secret",
          createdAt: "2026-05-01T00:00:00.000Z",
          updatedAt: "2026-05-01T00:00:00.000Z"
        }
      }),
      item("file", "引用", "参照ファイル", {
        citationFileName: "approval-guide.pdf",
        retrievedText: "retrieved-secret"
      })
    ]

    expect(searchConversationHistory(history, "締切").map((result) => result.item.id)).toEqual(["ticket"])
    expect(searchConversationHistory(history, "approval-guide").map((result) => result.item.id)).toEqual(["file"])
    expect(searchConversationHistory(history, "retrieved-secret")).toEqual([])
    expect(searchConversationHistory(history, "internal-secret")).toEqual([])
  })
})

function item(
  id: string,
  title: string,
  text: string,
  options: {
    updatedAt?: string
    isFavorite?: boolean
    questionTicket?: ConversationHistoryItem["messages"][number]["questionTicket"]
    citationFileName?: string
    retrievedText?: string
  } = {}
): ConversationHistoryItem {
  return {
    schemaVersion: 1,
    id,
    title,
    updatedAt: options.updatedAt ?? "2026-05-02T00:00:00.000Z",
    isFavorite: options.isFavorite ?? false,
    messages: [
      {
        role: "user",
        text,
        createdAt: "2026-05-02T00:00:00.000Z",
        questionTicket: options.questionTicket,
        result: options.citationFileName || options.retrievedText
          ? {
              answer: "回答",
              isAnswerable: true,
              citations: options.citationFileName
                ? [{ documentId: "doc-1", fileName: options.citationFileName, chunkId: "chunk-1", score: 1, text: "引用本文" }]
                : [],
              retrieved: options.retrievedText
                ? [{ documentId: "doc-2", fileName: "retrieved.pdf", chunkId: "chunk-2", score: 1, text: options.retrievedText }]
                : []
            }
          : undefined
      }
    ]
  }
}
