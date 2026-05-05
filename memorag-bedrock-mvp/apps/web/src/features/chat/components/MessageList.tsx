import type { RefObject } from "react"
import type { createQuestion } from "../../questions/api/questionsApi.js"
import type { HumanQuestion } from "../../questions/types.js"
import type { Message } from "../types.js"
import type { ClarificationOption } from "../types-api.js"
import { getLinkedQuestion } from "../utils/getLinkedQuestion.js"
import { ChatEmptyState } from "./ChatEmptyState.js"
import { MessageItem } from "./MessageItem.js"
import { ProcessingAnswer } from "./ProcessingAnswer.js"

export function MessageList({
  messages,
  questions,
  documentsCount,
  isProcessing,
  pendingActivity,
  latestMessageRef,
  loading,
  onSelectPrompt,
  onCreateQuestion,
  onResolveQuestion,
  onSubmitClarificationOption,
  onStartClarificationFreeform
}: {
  messages: Message[]
  questions: HumanQuestion[]
  documentsCount: number
  isProcessing: boolean
  pendingActivity: string | null
  latestMessageRef: RefObject<HTMLElement | null>
  loading: boolean
  onSelectPrompt: (value: string) => void
  onCreateQuestion: (messageIndex: number, message: Message, input: Parameters<typeof createQuestion>[0]) => Promise<void>
  onResolveQuestion: (questionId: string) => Promise<void>
  onSubmitClarificationOption: (option: ClarificationOption, originalQuestion: string) => Promise<void>
  onStartClarificationFreeform: (originalQuestion: string, seedText: string) => void
}) {
  return (
    <div className="message-list">
      {messages.length === 0 && !isProcessing && <ChatEmptyState documentsCount={documentsCount} onSelectPrompt={onSelectPrompt} />}
      {messages.map((message, index) => (
        <MessageItem
          key={`${message.role}-${message.createdAt}-${index}`}
          message={message}
          messageIndex={index}
          latestMessageRef={index === messages.length - 1 && !pendingActivity ? latestMessageRef : undefined}
          linkedQuestion={getLinkedQuestion(message, questions)}
          loading={loading}
          onCreateQuestion={onCreateQuestion}
          onResolveQuestion={onResolveQuestion}
          onAdditionalQuestion={onSelectPrompt}
          onSubmitClarificationOption={onSubmitClarificationOption}
          onStartClarificationFreeform={onStartClarificationFreeform}
        />
      ))}
      {pendingActivity && (
        <article className="message-row assistant processing-row" aria-live="polite" ref={latestMessageRef}>
          <div className="message-avatar">
            <span className="loading-spinner" aria-hidden="true" />
          </div>
          <div className="message-content">
            <div className="message-meta">
              <strong>エージェント</strong>
              <span>{pendingActivity}</span>
            </div>
            <ProcessingAnswer label={pendingActivity} />
          </div>
        </article>
      )}
    </div>
  )
}
