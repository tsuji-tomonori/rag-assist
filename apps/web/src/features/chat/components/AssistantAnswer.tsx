import type { createQuestion } from "../../questions/api/questionsApi.js"
import type { HumanQuestion } from "../../questions/types.js"
import type { CurrentUser } from "../../../shared/types/common.js"
import type { Message } from "../types.js"
import type { ClarificationOption } from "../types-api.js"
import { AnswerCopyAction } from "./answer/AnswerCopyAction.js"
import { AnswerText } from "./answer/AnswerText.js"
import { CitationList } from "./answer/CitationList.js"
import { ClarificationOptions } from "./answer/ClarificationOptions.js"
import { FollowupSuggestions } from "./answer/FollowupSuggestions.js"
import { useAnswerCopy } from "./answer/useAnswerCopy.js"
import { QuestionAnswerPanel } from "./QuestionAnswerPanel.js"
import { QuestionEscalationPanel } from "./QuestionEscalationPanel.js"

export function AssistantAnswer({
  message,
  linkedQuestion,
  currentUser,
  loading,
  onCreateQuestion,
  onResolveQuestion,
  onAdditionalQuestion,
  onSubmitClarificationOption,
  onStartClarificationFreeform
}: {
  message: Message
  linkedQuestion?: HumanQuestion
  currentUser: CurrentUser | null
  loading: boolean
  onCreateQuestion: (input: Parameters<typeof createQuestion>[0]) => Promise<void>
  onResolveQuestion: (questionId: string) => Promise<void>
  onAdditionalQuestion: (value: string) => void
  onSubmitClarificationOption: (option: ClarificationOption, originalQuestion: string) => Promise<void>
  onStartClarificationFreeform: (originalQuestion: string, seedText: string) => void
}) {
  const citations = message.result?.citations ?? []
  const clarification = message.result?.clarification
  const isClarification = message.result?.responseType === "clarification" || message.result?.needsClarification === true
  const canCopyAnswer = Boolean(message.text.trim())
  const { copyStatus, copyText } = useAnswerCopy()

  return (
    <div className="answer-card">
      <AnswerText text={message.text} />
      <CitationList citations={citations} />
      {!isClarification && message.result?.isAnswerable && (
        <FollowupSuggestions disabled={loading} onAdditionalQuestion={onAdditionalQuestion} />
      )}
      <AnswerCopyAction citationsCount={citations.length} copyStatus={copyStatus} canCopy={canCopyAnswer} onCopy={() => void copyText(message.text)} />
      {isClarification && clarification && (
        <ClarificationOptions
          options={clarification.options}
          originalQuestion={message.sourceQuestion ?? message.text}
          disabled={loading}
          onSubmitClarificationOption={onSubmitClarificationOption}
          onStartClarificationFreeform={onStartClarificationFreeform}
        />
      )}
      {message.result && !message.result.isAnswerable && !isClarification && (
        <QuestionEscalationPanel message={message} questionTicket={linkedQuestion} currentUser={currentUser} loading={loading} onCreateQuestion={onCreateQuestion} />
      )}
      {linkedQuestion?.status === "answered" || linkedQuestion?.status === "resolved" ? (
        <QuestionAnswerPanel question={linkedQuestion} loading={loading} onResolveQuestion={onResolveQuestion} onAdditionalQuestion={onAdditionalQuestion} />
      ) : null}
    </div>
  )
}
