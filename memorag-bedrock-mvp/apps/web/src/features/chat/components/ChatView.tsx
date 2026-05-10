import type { FormEvent, RefObject } from "react"
import type { SubmitShortcut } from "../../../app/types.js"
import type { createQuestion } from "../../questions/api/questionsApi.js"
import type { DebugTrace } from "../../debug/types.js"
import type { DocumentGroup } from "../../documents/types.js"
import type { HumanQuestion } from "../../questions/types.js"
import { DebugPanel } from "../../debug/components/DebugPanel.js"
import type { Message } from "../types.js"
import { ChatComposer } from "./ChatComposer.js"
import { ChatRunIdBar } from "./ChatRunIdBar.js"
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
  modelId,
  file,
  selectedGroupId,
  documentGroups,
  conversationKey,
  submitShortcut,
  question,
  debugMode,
  canReadDebugRuns,
  selectedTrace,
  selectedRunValue,
  pendingDebugQuestion,
  allExpanded,
  expandedStepId,
  onAsk,
  onSubmitClarificationOption,
  onStartClarificationFreeform,
  onSetQuestion,
  onModelChange,
  onSetFile,
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
  modelId: string
  file: File | null
  selectedGroupId: string
  documentGroups: DocumentGroup[]
  conversationKey: number
  submitShortcut: SubmitShortcut
  question: string
  debugMode: boolean
  canReadDebugRuns: boolean
  selectedTrace?: DebugTrace
  selectedRunValue: string
  pendingDebugQuestion: string | null
  allExpanded: boolean
  expandedStepId: number | null
  onAsk: (event: FormEvent) => Promise<void>
  onSubmitClarificationOption: Parameters<typeof MessageList>[0]["onSubmitClarificationOption"]
  onStartClarificationFreeform: Parameters<typeof MessageList>[0]["onStartClarificationFreeform"]
  onSetQuestion: (value: string) => void
  onModelChange: (modelId: string) => void
  onSetFile: (file: File | null) => void
  onCreateQuestion: (messageIndex: number, message: Message, input: Parameters<typeof createQuestion>[0]) => Promise<void>
  onResolveQuestion: (questionId: string) => Promise<void>
  onToggleAllDebugSteps: () => void
  onToggleDebugStep: (stepId: number) => void
}) {
  const canShowDebugPanel = debugMode && canReadDebugRuns

  return (
    <section className={`split-workspace ${canShowDebugPanel ? "" : "debug-off"}`}>
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
          modelId={modelId}
          file={file}
          selectedGroupId={selectedGroupId}
          documentGroups={documentGroups}
          canWriteDocuments={canWriteDocuments}
          conversationKey={conversationKey}
          canAsk={canAsk}
          loading={loading}
          onSetQuestion={onSetQuestion}
          onModelChange={onModelChange}
          onSetFile={onSetFile}
        />
        <ChatRunIdBar
          runId={pendingDebugQuestion ? null : selectedTrace?.runId ?? (selectedRunValue && selectedRunValue !== "__processing__" ? selectedRunValue : null)}
          pending={pendingDebugQuestion !== null}
        />
        <p className="composer-note">本サービスの回答は社内ドキュメントをもとに生成されます。内容の正確性をご確認のうえご利用ください。</p>
      </section>

      {canShowDebugPanel && (
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
