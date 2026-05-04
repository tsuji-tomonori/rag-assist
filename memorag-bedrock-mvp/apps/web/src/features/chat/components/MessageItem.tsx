import type { RefObject } from "react"
import type { createQuestion } from "../../questions/api/questionsApi.js"
import type { HumanQuestion } from "../../questions/types.js"
import { Icon } from "../../../shared/components/Icon.js"
import { formatTime } from "../../../shared/utils/format.js"
import type { Message } from "../types.js"
import { AssistantAnswer } from "./AssistantAnswer.js"
import { UserPromptBubble } from "./UserPromptBubble.js"

export function MessageItem({
  message,
  messageIndex,
  latestMessageRef,
  linkedQuestion,
  loading,
  onCreateQuestion,
  onResolveQuestion,
  onAdditionalQuestion
}: {
  message: Message
  messageIndex: number
  latestMessageRef?: RefObject<HTMLElement | null>
  linkedQuestion?: HumanQuestion
  loading: boolean
  onCreateQuestion: (messageIndex: number, message: Message, input: Parameters<typeof createQuestion>[0]) => Promise<void>
  onResolveQuestion: (questionId: string) => Promise<void>
  onAdditionalQuestion: (value: string) => void
}) {
  return (
    <article className={`message-row ${message.role}`} key={`${message.role}-${message.createdAt}-${messageIndex}`} ref={latestMessageRef}>
      <div className="message-avatar">{message.role === "user" ? "U" : <Icon name="logo" />}</div>
      <div className="message-content">
        <div className="message-meta">
          <strong>{message.role === "user" ? "あなた" : "エージェント"}</strong>
          <span>{formatTime(message.createdAt)}</span>
        </div>
        {message.role === "assistant" ? (
          <AssistantAnswer
            message={message}
            linkedQuestion={linkedQuestion}
            loading={loading}
            onCreateQuestion={(input) => onCreateQuestion(messageIndex, message, input)}
            onResolveQuestion={onResolveQuestion}
            onAdditionalQuestion={onAdditionalQuestion}
          />
        ) : (
          <UserPromptBubble text={message.text} />
        )}
      </div>
    </article>
  )
}
