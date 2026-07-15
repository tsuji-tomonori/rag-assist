import { describe, expect, it } from "vitest"
import type { HumanQuestion } from "../../questions/types.js"
import type { Message } from "../types.js"
import { getLinkedQuestion } from "./getLinkedQuestion.js"

const ticket = (overrides: Partial<HumanQuestion> = {}): HumanQuestion => ({
  questionId: "q-1",
  title: "問い合わせ",
  question: "質問",
  requesterName: "利用者",
  requesterDepartment: "人事",
  assigneeDepartment: "総務",
  category: "general",
  priority: "normal",
  status: "open",
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z",
  ...overrides
})

const message = (overrides: Partial<Message> = {}): Message => ({
  messageId: "message-1",
  role: "assistant",
  text: "回答不能",
  sourceQuestion: "期限は？",
  createdAt: "2026-07-14T00:00:00.000Z",
  ...overrides
})

describe("getLinkedQuestion", () => {
  it("uses messageId before legacy source text", () => {
    const matched = ticket({ questionId: "matched", messageId: "message-1", sourceQuestion: "別の質問" })
    const legacy = ticket({ questionId: "legacy", messageId: "message-2", sourceQuestion: "期限は？" })

    expect(getLinkedQuestion(message(), [legacy, matched])?.questionId).toBe("matched")
  })

  it("does not guess when legacy source text matches multiple tickets", () => {
    const legacyMessage = message({ messageId: undefined })
    const questions = [ticket({ questionId: "a", sourceQuestion: "期限は？" }), ticket({ questionId: "b", sourceQuestion: "期限は？" })]

    expect(getLinkedQuestion(legacyMessage, questions)).toBeUndefined()
  })
})
