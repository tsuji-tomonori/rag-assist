import type { FormEvent, RefObject } from "react"
import type { createQuestion } from "../../questions/api/questionsApi.js"
import type { DebugTrace } from "../../debug/types.js"
import type { HumanQuestion } from "../../questions/types.js"
import { DebugPanel } from "../../debug/components/DebugPanel.js"
import type { Message } from "../types.js"
import { ChatComposer } from "./ChatComposer.js"
import { MessageList } from "./MessageList.js"

export function ChatView({
  messages,
  questions,
  documentsCount,
  isProcessing,
  pendingActivity,
  latestMessageRef,
  loading,
  canAsk,
  canWriteDocuments,
  file,
  conversationKey,
  submitShortcut,
  question,
  debugMode,
  canReadDebugRuns,
  selectedTrace,
  pendingDebugQuestion,
  allExpanded,
  expandedStepId,
  onAsk,
  onSubmitClarificationOption,
  onStartClarificationFreeform,
  onSetQuestion,
  onSetFile,
  onSetSubmitShortcut,
  onCreateQuestion,
  onResolveQuestion,
  onToggleAllDebugSteps,
  onToggleDebugStep
}: {
  messages: Message[]
  questions: HumanQuestion[]
  documentsCount: number
  isProcessing: boolean
  pendingActivity: string | null
  latestMessageRef: RefObject<HTMLElement | null>
  loading: boolean
  canAsk: boolean
  canWriteDocuments: boolean
  file: File | null
  conversationKey: number
  submitShortcut: "enter" | "ctrlEnter"
  question: string
  debugMode: boolean
  canReadDebugRuns: boolean
  selectedTrace?: DebugTrace
  pendingDebugQuestion: string | null
  allExpanded: boolean
  expandedStepId: number | null
  onAsk: (event: FormEvent) => Promise<void>
  onSubmitClarificationOption: Parameters<typeof MessageList>[0]["onSubmitClarificationOption"]
  onStartClarificationFreeform: Parameters<typeof MessageList>[0]["onStartClarificationFreeform"]
  onSetQuestion: (value: string) => void
  onSetFile: (file: File | null) => void
  onSetSubmitShortcut: (value: "enter" | "ctrlEnter") => void
  onCreateQuestion: (messageIndex: number, message: Message, input: Parameters<typeof createQuestion>[0]) => Promise<void>
  onResolveQuestion: (questionId: string) => Promise<void>
  onToggleAllDebugSteps: () => void
  onToggleDebugStep: (stepId: number) => void
}) {
  return (
    <section className={`split-workspace ${debugMode ? "" : "debug-off"}`}>
      <section className="chat-card" aria-label="チャット">
        <MessageList
          messages={messages}
          questions={questions}
          documentsCount={documentsCount}
          isProcessing={isProcessing}
          pendingActivity={pendingActivity}
          latestMessageRef={latestMessageRef}
          loading={loading}
          onSelectPrompt={onSetQuestion}
          onCreateQuestion={onCreateQuestion}
          onResolveQuestion={onResolveQuestion}
          onSubmitClarificationOption={onSubmitClarificationOption}
          onStartClarificationFreeform={onStartClarificationFreeform}
        />

        <ChatComposer
          onAsk={onAsk}
          question={question}
          submitShortcut={submitShortcut}
          file={file}
          canWriteDocuments={canWriteDocuments}
          conversationKey={conversationKey}
          canAsk={canAsk}
          loading={loading}
          onSetQuestion={onSetQuestion}
          onSetFile={onSetFile}
          onSetSubmitShortcut={onSetSubmitShortcut}
        />
        <p className="composer-note">本サービスの回答は社内ドキュメントをもとに生成されます。内容の正確性をご確認のうえご利用ください。</p>
      </section>

      {debugMode && canReadDebugRuns && (
        <DebugPanel
          trace={selectedTrace}
          pending={pendingDebugQuestion !== null}
          pendingQuestion={pendingDebugQuestion ?? undefined}
          allExpanded={allExpanded}
          expandedStepId={expandedStepId}
          onToggleAll={onToggleAllDebugSteps}
          onToggleStep={onToggleDebugStep}
        />
      )}
    </section>
  )
}
