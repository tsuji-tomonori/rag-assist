import type { SemanticPresentation } from "../../../shared/ui/displayMetadata.js"
import type { ChatResponse } from "../types-api.js"

export type ChatJourneyPresentation = Readonly<{
  presentation: SemanticPresentation
  nextAction: string
}>

export function chatJourneyPresentation(result: ChatResponse): ChatJourneyPresentation {
  const responseType = result.responseType ?? (result.needsClarification === true ? "clarification" : result.isAnswerable ? "answer" : "refusal")
  if (responseType === "clarification") {
    return {
      presentation: { label: "確認が必要", tone: "warning", description: "回答の前に質問の意図を確認します" },
      nextAction: "候補を選ぶか、自由入力で確認内容を補ってください。"
    }
  }
  if (responseType === "answer") {
    return {
      presentation: { label: "回答", tone: "success", description: "RAG 実行が回答を返しました" },
      nextAction: result.citations.length > 0
        ? "回答内容と参照元を確認してください。"
        : "回答内容を確認してください。参照元は API 応答で提供されていません。"
    }
  }
  return {
    presentation: { label: "回答不能", tone: "warning", description: "根拠不足などにより回答を確定していません" },
    nextAction: "必要に応じて質問を具体化するか、担当者へ送信してください。"
  }
}
