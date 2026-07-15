import { describe, expect, it } from "vitest"
import type { ChatResponse } from "../types-api.js"
import { chatJourneyPresentation } from "./chatJourney.js"

const response = (overrides: Partial<ChatResponse> = {}): ChatResponse => ({
  answer: "回答",
  citations: [],
  retrieved: [],
  isAnswerable: true,
  ...overrides
})

describe("chatJourneyPresentation", () => {
  it("distinguishes answer, clarification, and refusal from the API contract", () => {
    expect(chatJourneyPresentation(response({ responseType: "answer" })).presentation.label).toBe("回答")
    expect(chatJourneyPresentation(response({ responseType: "clarification", needsClarification: true })).presentation.label).toBe("確認が必要")
    expect(chatJourneyPresentation(response({ responseType: "refusal", isAnswerable: false })).presentation.label).toBe("回答不能")
  })

  it("does not invent a citation when the API returned none", () => {
    expect(chatJourneyPresentation(response()).nextAction).toContain("提供されていません")
  })

  it("uses an explicit responseType before a contradictory legacy flag", () => {
    expect(chatJourneyPresentation(response({ responseType: "refusal", isAnswerable: true })).presentation.label).toBe("回答不能")
  })
})
