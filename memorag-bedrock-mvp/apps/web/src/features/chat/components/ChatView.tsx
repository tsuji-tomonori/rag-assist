import { type FormEvent, type RefObject, useState } from "react"
import type { createQuestion, DebugTrace, HumanQuestion } from "../../../api.js"
import { DebugPanel } from "../../debug/components/DebugPanel.js"
import { Icon } from "../../../shared/components/Icon.js"
import { formatDateTime, formatTime } from "../../../shared/utils/format.js"
import type { Message } from "../types.js"

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
        <div className="message-list">
          {messages.length === 0 && !isProcessing && <ChatEmptyState documentsCount={documentsCount} onSelectPrompt={onSetQuestion} />}
          {messages.map((message, index) => (
            <article
              className={`message-row ${message.role}`}
              key={`${message.role}-${message.createdAt}-${index}`}
              ref={index === messages.length - 1 && !pendingActivity ? latestMessageRef : undefined}
            >
              <div className="message-avatar">{message.role === "user" ? "U" : <Icon name="logo" />}</div>
              <div className="message-content">
                <div className="message-meta">
                  <strong>{message.role === "user" ? "あなた" : "エージェント"}</strong>
                  <span>{formatTime(message.createdAt)}</span>
                </div>
                {message.role === "assistant" ? (
                  <AssistantAnswer
                    message={message}
                    linkedQuestion={getLinkedQuestion(message, questions)}
                    loading={loading}
                    onCreateQuestion={(input) => onCreateQuestion(index, message, input)}
                    onResolveQuestion={onResolveQuestion}
                    onAdditionalQuestion={(value) => onSetQuestion(value)}
                  />
                ) : (
                  <UserPromptBubble text={message.text} />
                )}
              </div>
            </article>
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

        <form className="composer" onSubmit={onAsk}>
          <textarea
            aria-label="質問"
            placeholder={
              submitShortcut === "enter"
                ? "質問を入力してください...（Enterで送信 / Shift+Enterで改行）"
                : "質問を入力してください...（Ctrl+Enterで送信 / Enterで改行）"
            }
            value={question}
            onChange={(event) => onSetQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return

              if (submitShortcut === "enter") {
                if (!event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
                return
              }

              if (event.ctrlKey || event.metaKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
          />
          <div className="composer-actions">
            <div className="composer-shortcut-toggle">
              <label htmlFor="submit-shortcut">送信キー</label>
              <select
                id="submit-shortcut"
                value={submitShortcut}
                onChange={(event) => onSetSubmitShortcut(event.target.value as "enter" | "ctrlEnter")}
              >
                <option value="enter">Enterで送信</option>
                <option value="ctrlEnter">Ctrl+Enterで送信</option>
              </select>
            </div>
            {file && <span className="file-chip">{file.name}</span>}
            {canWriteDocuments && (
              <label className="icon-button attach-button" title="資料を添付">
                <Icon name="paperclip" />
                <input key={conversationKey} type="file" onChange={(event) => onSetFile(event.target.files?.[0] ?? null)} />
              </label>
            )}
            <button className="send-button" disabled={!canAsk} type="submit" title="送信">
              <Icon name="send" />
            </button>
          </div>
        </form>
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

function UserPromptBubble({ text }: { text: string }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle")
  const canCopyPrompt = Boolean(text.trim())

  async function copyPrompt() {
    if (!canCopyPrompt) return
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus("copied")
      window.setTimeout(() => setCopyStatus("idle"), 1800)
    } catch (err) {
      console.warn("Failed to copy prompt", err)
      setCopyStatus("error")
      window.setTimeout(() => setCopyStatus("idle"), 1800)
    }
  }

  return (
    <div className="user-message-line">
      <p className="user-bubble">{text}</p>
      <button
        type="button"
        className={`prompt-copy-button ${copyStatus === "copied" ? "is-copied" : ""}`}
        onClick={copyPrompt}
        disabled={!canCopyPrompt}
        aria-label={copyStatus === "copied" ? "プロンプトをコピー済み" : "プロンプトをコピー"}
        title={copyStatus === "copied" ? "プロンプトをコピー済み" : "プロンプトをコピー"}
      >
        <Icon name={copyStatus === "copied" ? "check" : "copy"} />
      </button>
      {copyStatus !== "idle" && (
        <span className="sr-only" role="status" aria-live="polite">
          {copyStatus === "copied" ? "プロンプトをコピーしました" : "コピーに失敗しました"}
        </span>
      )}
    </div>
  )
}

function AssistantAnswer({
  message,
  linkedQuestion,
  loading,
  onCreateQuestion,
  onResolveQuestion,
  onAdditionalQuestion
}: {
  message: Message
  linkedQuestion?: HumanQuestion
  loading: boolean
  onCreateQuestion: (input: Parameters<typeof createQuestion>[0]) => Promise<void>
  onResolveQuestion: (questionId: string) => Promise<void>
  onAdditionalQuestion: (value: string) => void
}) {
  const citations = message.result?.citations ?? []
  const [copyStatus, setCopyStatus] = useState<"idle" | "answer" | "error">("idle")
  const canCopyAnswer = Boolean(message.text.trim())

  async function copyText(value: string) {
    if (!value.trim()) return
    try {
      await navigator.clipboard.writeText(value)
      setCopyStatus("answer")
      window.setTimeout(() => setCopyStatus("idle"), 1800)
    } catch (err) {
      console.warn("Failed to copy text", err)
      setCopyStatus("error")
      window.setTimeout(() => setCopyStatus("idle"), 1800)
    }
  }

  return (
    <div className="answer-card">
      <p className="answer-text">{message.text || "質問すると、社内ドキュメントに基づく回答と実行トレースが表示されます。"}</p>
      {citations.length > 0 && (
        <div className="answer-sources">
          <strong>根拠ドキュメント</strong>
          <ul>
            {citations.slice(0, 3).map((citation, index) => (
              <li key={`${citation.documentId}-${citation.chunkId ?? index}`}>
                <a href={`#source-${index}`}>{citation.fileName}</a>
                <span>score {citation.score}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="answer-footer">
        <span>根拠: ドキュメント {citations.length}件</span>
        <button
          type="button"
          className={`copy-action ${copyStatus === "answer" ? "is-copied" : ""}`}
          onClick={() => copyText(message.text)}
          disabled={!canCopyAnswer}
          aria-label={copyStatus === "answer" ? "回答をコピー済み" : "回答をコピー"}
          title={copyStatus === "answer" ? "回答をコピー済み" : "回答をコピー"}
        >
          <Icon name={copyStatus === "answer" ? "check" : "copy"} />
          <span>{copyStatus === "answer" ? "コピー済み" : "回答"}</span>
        </button>
      </div>
      {copyStatus !== "idle" && (
        <p className="copy-feedback" role="status" aria-live="polite">
          {copyStatus === "answer" && "回答をコピーしました"}
          {copyStatus === "error" && "コピーに失敗しました"}
        </p>
      )}
      {message.result && !message.result.isAnswerable && (
        <QuestionEscalationPanel message={message} questionTicket={linkedQuestion} loading={loading} onCreateQuestion={onCreateQuestion} />
      )}
      {linkedQuestion?.status === "answered" || linkedQuestion?.status === "resolved" ? (
        <QuestionAnswerPanel question={linkedQuestion} loading={loading} onResolveQuestion={onResolveQuestion} onAdditionalQuestion={onAdditionalQuestion} />
      ) : null}
    </div>
  )
}

function ChatEmptyState({ documentsCount, onSelectPrompt }: { documentsCount: number; onSelectPrompt: (value: string) => void }) {
  const prompts = [
    "社内規程の申請手順を確認したい",
    "この資料の重要ポイントを整理して",
    "担当部署へ確認が必要な内容を洗い出して"
  ]

  return (
    <section className="chat-empty-state" aria-label="チャット開始">
      <div className="empty-orbit" aria-hidden="true">
        <Icon name="logo" />
      </div>
      <div className="empty-copy">
        <span>{documentsCount > 0 ? `${documentsCount} 件の資料を参照できます` : "資料を添付して開始できます"}</span>
        <h2>何を確認しますか？</h2>
      </div>
      <div className="prompt-grid">
        {prompts.map((prompt) => (
          <button type="button" key={prompt} onClick={() => onSelectPrompt(prompt)}>
            {prompt}
          </button>
        ))}
      </div>
    </section>
  )
}

function ProcessingAnswer({ label }: { label: string }) {
  return (
    <div className="answer-card processing-answer">
      <span className="loading-spinner" aria-hidden="true" />
      <p>
        {label}
        <span className="animated-dots" aria-hidden="true">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </p>
    </div>
  )
}

function QuestionEscalationPanel({
  message,
  questionTicket,
  loading,
  onCreateQuestion
}: {
  message: Message
  questionTicket?: HumanQuestion
  loading: boolean
  onCreateQuestion: (input: Parameters<typeof createQuestion>[0]) => Promise<void>
}) {
  const sourceQuestion = message.sourceQuestion ?? ""
  const [title, setTitle] = useState(defaultQuestionTitle(sourceQuestion))
  const [body, setBody] = useState(defaultQuestionBody(sourceQuestion))
  const [category, setCategory] = useState("その他の質問")
  const [priority, setPriority] = useState<HumanQuestion["priority"]>("normal")
  const [assigneeDepartment, setAssigneeDepartment] = useState("総務部")

  if (questionTicket) {
    return (
      <section className="question-status-panel">
        <div>
          <strong>{questionTicket.status === "open" ? "担当者へ送信済み" : questionTicket.status === "answered" ? "担当者が回答済み" : "解決済み"}</strong>
          <span>{questionTicket.assigneeDepartment} / {formatDateTime(questionTicket.updatedAt)}</span>
        </div>
        <p>{questionTicket.title}</p>
      </section>
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    await onCreateQuestion({
      title,
      question: body,
      requesterName: "山田 太郎",
      requesterDepartment: "利用部門",
      assigneeDepartment,
      category,
      priority,
      sourceQuestion,
      chatAnswer: message.text,
      chatRunId: message.result?.debug?.runId
    })
  }

  return (
    <form className="question-escalation-panel" onSubmit={onSubmit} aria-label="担当者へ質問">
      <div className="question-panel-head">
        <div>
          <h3>担当者へ質問</h3>
          <span>自動表示</span>
        </div>
      </div>
      <label>
        <span>件名</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required />
      </label>
      <label>
        <span>質問内容</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} required />
      </label>
      <div className="question-form-grid">
        <label>
          <span>カテゴリ</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="その他の質問">その他の質問</option>
            <option value="手続き">手続き</option>
            <option value="社内制度">社内制度</option>
            <option value="資料確認">資料確認</option>
          </select>
        </label>
        <label>
          <span>優先度</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value as HumanQuestion["priority"])}>
            <option value="normal">通常</option>
            <option value="high">高</option>
            <option value="urgent">緊急</option>
          </select>
        </label>
      </div>
      <label>
        <span>担当部署</span>
        <select value={assigneeDepartment} onChange={(event) => setAssigneeDepartment(event.target.value)}>
          <option value="総務部">総務部</option>
          <option value="人事部">人事部</option>
          <option value="情報システム部">情報システム部</option>
          <option value="経理部">経理部</option>
        </select>
      </label>
      <div className="question-form-actions">
        <span>通常 1 営業日以内に回答予定</span>
        <button type="submit" disabled={loading || !title.trim() || !body.trim()}>
          担当者へ送信
        </button>
      </div>
    </form>
  )
}

function QuestionAnswerPanel({
  question,
  loading,
  onResolveQuestion,
  onAdditionalQuestion
}: {
  question: HumanQuestion
  loading: boolean
  onResolveQuestion: (questionId: string) => Promise<void>
  onAdditionalQuestion: (value: string) => void
}) {
  return (
    <section className="question-answer-panel" aria-label="担当者からの回答">
      <header>
        <span className="status-dot"><Icon name="check" /></span>
        <div>
          <strong>担当者からの回答</strong>
          <span>{question.responderName ?? "担当者"}（{question.responderDepartment ?? question.assigneeDepartment}）</span>
        </div>
      </header>
      <p>{question.answerBody}</p>
      <dl>
        <div>
          <dt>回答日時</dt>
          <dd>{formatDateTime(question.answeredAt ?? question.updatedAt)}</dd>
        </div>
        {question.references && (
          <div>
            <dt>参照情報</dt>
            <dd>{question.references}</dd>
          </div>
        )}
      </dl>
      <footer>
        <button type="button" disabled={loading || question.status === "resolved"} onClick={() => onResolveQuestion(question.questionId)}>
          解決した
        </button>
        <button type="button" onClick={() => onAdditionalQuestion(`追加確認: ${question.title}\n`)}>
          追加で質問する
        </button>
      </footer>
    </section>
  )
}

function defaultQuestionTitle(sourceQuestion: string): string {
  const compact = sourceQuestion.replace(/\s+/g, " ").trim()
  return compact ? `${compact.slice(0, 42)}について確認したい` : "資料外の内容について確認したい"
}

function defaultQuestionBody(sourceQuestion: string): string {
  const compact = sourceQuestion.trim()
  return compact
    ? `${compact}\n\n資料を確認しましたが、該当する情報が見つかりませんでした。ご教示いただけますでしょうか。`
    : "資料を確認しましたが、該当する情報が見つかりませんでした。ご教示いただけますでしょうか。"
}

function getLinkedQuestion(message: Message, questions: HumanQuestion[]): HumanQuestion | undefined {
  if (message.questionTicket) {
    return questions.find((question) => question.questionId === message.questionTicket?.questionId) ?? message.questionTicket
  }
  return questions.find((question) => question.sourceQuestion && question.sourceQuestion === message.sourceQuestion)
}
