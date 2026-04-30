import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  chat,
  deleteDocument,
  fileToBase64,
  listDebugRuns,
  listDocuments,
  uploadDocument,
  type ChatResponse,
  type DebugStep,
  type DebugTrace,
  type DocumentManifest
} from "./api.js"

type Message = {
  role: "user" | "assistant"
  text: string
  createdAt: string
  result?: ChatResponse
}

type IconName =
  | "logo"
  | "chat"
  | "clock"
  | "star"
  | "document"
  | "settings"
  | "paperclip"
  | "send"
  | "chevron"
  | "check"
  | "warning"
  | "expand"
  | "plus"
  | "download"
  | "share"
  | "thumbUp"
  | "thumbDown"
  | "trash"

const defaultModelId = "amazon.nova-lite-v1:0"
const defaultEmbeddingModelId = "amazon.titan-embed-text-v2:0"

export default function App() {
  const [documents, setDocuments] = useState<DocumentManifest[]>([])
  const [debugRuns, setDebugRuns] = useState<DebugTrace[]>([])
  const [selectedDocumentId, setSelectedDocumentId] = useState("all")
  const [selectedRunId, setSelectedRunId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [question, setQuestion] = useState("")
  const [modelId, setModelId] = useState(defaultModelId)
  const [embeddingModelId, setEmbeddingModelId] = useState(defaultEmbeddingModelId)
  const [minScore] = useState(0.2)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugMode, setDebugMode] = useState(false)
  const [expandedStepId, setExpandedStepId] = useState<number | null>(null)
  const [allExpanded, setAllExpanded] = useState(false)

  const canAsk = useMemo(() => (question.trim().length > 0 || file !== null) && !loading, [question, file, loading])
  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant")
  const latestTrace = latestAssistant?.result?.debug
  const selectedDocument = useMemo(
    () => documents.find((document) => document.documentId === selectedDocumentId),
    [documents, selectedDocumentId]
  )
  const selectedTrace = useMemo(() => {
    if (selectedRunId) return debugRuns.find((run) => run.runId === selectedRunId) ?? latestTrace
    return latestTrace ?? debugRuns[0]
  }, [debugRuns, latestTrace, selectedRunId])
  const totalLatency = selectedTrace ? formatLatency(selectedTrace.totalLatencyMs) : "-"
  const visibleMessages = messages

  useEffect(() => {
    refreshDocuments().catch((err) => console.warn("Failed to load documents", err))
    refreshDebugRuns().catch((err) => console.warn("Failed to load debug runs", err))
  }, [])

  async function refreshDocuments() {
    const nextDocuments = await listDocuments()
    setDocuments(nextDocuments)
    if (selectedDocumentId !== "all" && !nextDocuments.some((document) => document.documentId === selectedDocumentId)) {
      setSelectedDocumentId("all")
    }
  }

  async function refreshDebugRuns() {
    setDebugRuns(await listDebugRuns())
  }

  async function onAsk(event: FormEvent) {
    event.preventDefault()
    if (!canAsk) return

    const typedQuestion = question.trim()
    const userQuestion = typedQuestion || `${file?.name ?? "添付資料"}を取り込んでください`
    setQuestion("")
    setMessages((prev) => [...prev, { role: "user", text: userQuestion, createdAt: new Date().toISOString() }])
    setLoading(true)
    setError(null)

    try {
      if (file) {
        await uploadDocument({
          fileName: file.name,
          contentBase64: await fileToBase64(file),
          mimeType: file.type || undefined,
          memoryModelId: modelId,
          embeddingModelId
        })
        setFile(null)
        await refreshDocuments()
      }

      if (typedQuestion.length > 0) {
        const result = await chat({
          question: userQuestion,
          modelId,
          embeddingModelId,
          clueModelId: modelId,
          topK: 6,
          minScore,
          includeDebug: debugMode
        })
        setMessages((prev) => [...prev, { role: "assistant", text: result.answer, result, createdAt: new Date().toISOString() }])
        if (result.debug) {
          setSelectedRunId(result.debug.runId)
          setDebugRuns((prev) => [result.debug as DebugTrace, ...prev.filter((run) => run.runId !== result.debug?.runId)])
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "資料を取り込みました。知りたいことを入力してください。", createdAt: new Date().toISOString() }
        ])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onDelete(documentId?: string) {
    if (!documentId) return
    const document = documents.find((item) => item.documentId === documentId)
    const label = document?.fileName ?? documentId
    if (!window.confirm(`「${label}」を削除します。元資料、manifest、検索ベクトルが削除されます。`)) return

    setLoading(true)
    setError(null)
    try {
      await deleteDocument(documentId)
      setSelectedDocumentId("all")
      await refreshDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function newConversation() {
    setMessages([])
    setQuestion("")
    setFile(null)
    setSelectedRunId("")
    setExpandedStepId(null)
  }

  return (
    <main className="app-frame">
      <aside className="rail" aria-label="主要ナビゲーション">
        <a className="rail-logo" href="/" aria-label="ホーム">
          <Icon name="logo" />
        </a>
        <nav className="rail-nav">
          <button className="rail-item active" type="button" title="チャット">
            <Icon name="chat" />
            <span>チャット</span>
          </button>
          <button className="rail-item" type="button" title="履歴">
            <Icon name="clock" />
            <span>履歴</span>
          </button>
          <button className="rail-item" type="button" title="お気に入り">
            <Icon name="star" />
            <span>お気に入り</span>
          </button>
          <button className="rail-item" type="button" title="ドキュメント">
            <Icon name="document" />
            <span>ドキュメント</span>
          </button>
          <button className="rail-item" type="button" title="管理者設定">
            <Icon name="settings" />
            <span>管理者設定</span>
          </button>
        </nav>
        <button className="account-button" type="button" title="山田 太郎">
          <span className="account-avatar">山</span>
          <span>山田 太郎</span>
          <Icon name="chevron" />
        </button>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <h1>社内QAチャットボットエージェント</h1>
          <label className="top-control">
            <span>モデル</span>
            <select value={modelId} onChange={(event) => setModelId(event.target.value)}>
              <option value="amazon.nova-lite-v1:0">Nova Lite v1</option>
              <option value="anthropic.claude-3-5-sonnet-20240620-v1:0">Claude 3.5 Sonnet</option>
              <option value="anthropic.claude-3-haiku-20240307-v1:0">Claude 3 Haiku</option>
            </select>
          </label>
          <div className="top-control document-control">
            <label htmlFor="document-select">ドキュメント</label>
            <div className="document-select-row">
              <select id="document-select" value={selectedDocumentId} onChange={(event) => setSelectedDocumentId(event.target.value)}>
                <option value="all">すべての資料</option>
                {documents.map((document) => (
                  <option value={document.documentId} key={document.documentId}>
                    {document.fileName}
                  </option>
                ))}
              </select>
              <button
                className="delete-document-button"
                type="button"
                title={selectedDocument ? `${selectedDocument.fileName}を削除` : "削除する資料を選択"}
                disabled={!selectedDocument || loading}
                onClick={() => onDelete(selectedDocument?.documentId)}
              >
                <Icon name="trash" />
              </button>
            </div>
          </div>
          <label className="top-control run-control">
            <span>実行ID</span>
            <select value={selectedTrace?.runId ?? ""} onChange={(event) => setSelectedRunId(event.target.value)} disabled={debugRuns.length === 0 && !latestTrace}>
              {(latestTrace && !debugRuns.some((run) => run.runId === latestTrace.runId) ? [latestTrace, ...debugRuns] : debugRuns).map((run) => (
                <option value={run.runId} key={run.runId}>
                  {run.runId}
                </option>
              ))}
              {!selectedTrace && <option value="">未実行</option>}
            </select>
          </label>
          <div className="latency-block">
            <span>総レイテンシ</span>
            <strong>{totalLatency}</strong>
          </div>
          <label className="debug-toggle">
            <span>デバッグモード</span>
            <input type="checkbox" checked={debugMode} onChange={(event) => setDebugMode(event.target.checked)} />
            <i aria-hidden="true">{debugMode ? "ON" : "OFF"}</i>
          </label>
          <button className="new-chat-button" type="button" onClick={newConversation}>
            <Icon name="plus" />
            <span>新しい会話</span>
          </button>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <section className={`split-workspace ${debugMode ? "" : "debug-off"}`}>
          <section className="chat-card" aria-label="チャット">
            <div className="message-list">
              {visibleMessages.map((message, index) => (
                <article className={`message-row ${message.role}`} key={`${message.role}-${message.createdAt}-${index}`}>
                  <div className="message-avatar">{message.role === "user" ? "U" : <Icon name="logo" />}</div>
                  <div className="message-content">
                    <div className="message-meta">
                      <strong>{message.role === "user" ? "あなた" : "エージェント"}</strong>
                      <span>{formatTime(message.createdAt)}</span>
                    </div>
                    {message.role === "assistant" ? <AssistantAnswer message={message} /> : <p className="user-bubble">{message.text}</p>}
                  </div>
                </article>
              ))}
            </div>

            <form className="composer" onSubmit={onAsk}>
              <textarea
                aria-label="質問"
                placeholder="質問を入力してください...（Enterで送信 / Shift+Enterで改行）"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
              />
              <div className="composer-actions">
                {file && <span className="file-chip">{file.name}</span>}
                <label className="icon-button attach-button" title="資料を添付">
                  <Icon name="paperclip" />
                  <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                </label>
                <button className="send-button" disabled={!canAsk} type="submit" title="送信">
                  <Icon name="send" />
                </button>
              </div>
            </form>
            <p className="composer-note">本サービスの回答は社内ドキュメントをもとに生成されます。内容の正確性をご確認のうえご利用ください。</p>
          </section>

          {debugMode && (
            <DebugPanel
              trace={selectedTrace}
              allExpanded={allExpanded}
              expandedStepId={expandedStepId}
              onToggleAll={() => setAllExpanded((value) => !value)}
              onToggleStep={(stepId) => setExpandedStepId((current) => (current === stepId ? null : stepId))}
            />
          )}
        </section>
      </section>
    </main>
  )
}

function AssistantAnswer({ message }: { message: Message }) {
  const citations = message.result?.citations ?? []
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
        <button type="button" title="高評価">
          <Icon name="thumbUp" />
        </button>
        <button type="button" title="低評価">
          <Icon name="thumbDown" />
        </button>
        <button type="button" title="共有">
          <Icon name="share" />
        </button>
      </div>
    </div>
  )
}

function DebugPanel({
  trace,
  allExpanded,
  expandedStepId,
  onToggleAll,
  onToggleStep
}: {
  trace?: DebugTrace
  allExpanded: boolean
  expandedStepId: number | null
  onToggleAll: () => void
  onToggleStep: (stepId: number) => void
}) {
  const steps = trace?.steps ?? getPlaceholderSteps()
  const statusLabel = trace ? (trace.status === "success" ? "成功" : trace.status === "warning" ? "注意" : "失敗") : "未実行"

  return (
    <aside className="debug-card" aria-label="デバッグパネル">
      <header className="debug-head">
        <div>
          <h2>デバッグパネル</h2>
          <span>{steps.length} ステップ</span>
        </div>
        <div className="debug-head-actions">
          <button type="button" onClick={() => downloadDebugTrace(trace)} disabled={!trace} title="Markdownでダウンロード">
            <Icon name="download" />
            <span>MD DL</span>
          </button>
          <button type="button" onClick={onToggleAll}>{allExpanded ? "すべて閉じる" : "すべて展開"}</button>
          <button type="button" title="拡大表示">
            <Icon name="expand" />
          </button>
        </div>
      </header>

      <div className="debug-steps">
        {steps.map((step) => {
          const expanded = allExpanded || expandedStepId === step.id
          return (
            <article className={`debug-step ${step.status}`} key={step.id}>
              <div className="step-index">{step.id}</div>
              <div className="step-body">
                <button className="step-summary" type="button" onClick={() => onToggleStep(step.id)}>
                  <span className="step-state">
                    <Icon name={step.status === "warning" ? "warning" : "check"} />
                  </span>
                  <strong>{step.label}</strong>
                  <span className="step-latency">{formatLatency(step.latencyMs)}</span>
                  {step.modelId && <span className="model-chip">{step.modelId}</span>}
                  {step.hitCount !== undefined && <span className="sub-chip">ヒット数: {step.hitCount}件</span>}
                  {step.tokenCount !== undefined && <span className="sub-chip">トークン: {step.tokenCount}</span>}
                  <span className="step-description">{step.summary}</span>
                  <Icon name="chevron" />
                </button>
                {expanded && step.detail && <pre className="step-detail">{step.detail}</pre>}
              </div>
            </article>
          )
        })}
      </div>

      <footer className={`debug-footer ${trace?.status ?? "idle"}`}>
        <span className="footer-status">
          <Icon name={trace?.status === "warning" ? "warning" : "check"} />
          <strong>{statusLabel}</strong>
        </span>
        <span>{trace ? (trace.isAnswerable ? "正常に完了しました" : "回答拒否として完了しました") : "質問すると実行トレースを保存します"}</span>
        <span className="footer-latency">合計レイテンシ <strong>{trace ? formatLatency(trace.totalLatencyMs) : "-"}</strong></span>
      </footer>
    </aside>
  )
}

function Icon({ name }: { name: IconName }) {
  return (
    <svg className={`icon icon-${name}`} viewBox="0 0 24 24" aria-hidden="true">
      {getIconPath(name)}
    </svg>
  )
}

function getIconPath(name: IconName) {
  switch (name) {
    case "logo":
      return <path d="M5 4h9a5 5 0 0 1 5 5v6.5a4.5 4.5 0 0 1-4.5 4.5H10l-5 3v-3.2A5 5 0 0 1 1 15V8a4 4 0 0 1 4-4Zm2 6h7v2H7v-2Zm0 4h5v2H7v-2Zm10 3.2 3 1.8v-2.2a4 4 0 0 0 3-3.8V8.5a3.5 3.5 0 0 0-3.5-3.5h-.9A6.8 6.8 0 0 1 21 10v5a3 3 0 0 1-4 2.8v-.6Z" />
    case "chat":
      return <path d="M4 5h16v11H8l-4 3V5Zm4 4v2h8V9H8Zm0 4v2h5v-2H8Z" />
    case "clock":
      return <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm1 4v4.4l3.2 1.9-1 1.7-4.2-2.5V7h2Z" />
    case "star":
      return <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    case "document":
      return <path d="M6 3h8l4 4v14H6V3Zm7 2.5V8h2.5L13 5.5ZM8 11h8v2H8v-2Zm0 4h8v2H8v-2Z" />
    case "settings":
      return <path d="m13.3 3 .6 2a7.8 7.8 0 0 1 1.7.7l1.9-1 2 2-1 1.9c.3.5.5 1.1.7 1.7l2 .6v2.8l-2 .6a7.8 7.8 0 0 1-.7 1.7l1 1.9-2 2-1.9-1c-.5.3-1.1.5-1.7.7l-.6 2h-2.8l-.6-2a7.8 7.8 0 0 1-1.7-.7l-1.9 1-2-2 1-1.9a7.8 7.8 0 0 1-.7-1.7l-2-.6v-2.8l2-.6c.2-.6.4-1.2.7-1.7l-1-1.9 2-2 1.9 1c.5-.3 1.1-.5 1.7-.7l.6-2h2.8ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
    case "paperclip":
      return <path d="m7.4 13.6 7-7a3.3 3.3 0 0 1 4.7 4.7l-8 8a5 5 0 0 1-7.1-7.1l8.4-8.4 1.4 1.4-8.4 8.4a3 3 0 0 0 4.3 4.3l8-8a1.3 1.3 0 1 0-1.9-1.9l-7 7a.9.9 0 0 0 1.3 1.3l5.9-5.9 1.4 1.4-5.9 5.9a2.9 2.9 0 0 1-4.1-4.1Z" />
    case "send":
      return <path d="M3 20 21 12 3 4v6l10 2-10 2v6Z" />
    case "chevron":
      return <path d="m7 9 5 5 5-5 1.4 1.4L12 16.8l-6.4-6.4L7 9Z" />
    case "check":
      return <path d="M9.5 16.6 4.8 12l1.4-1.4 3.3 3.2 8.3-8.4 1.4 1.4-9.7 9.8Z" />
    case "warning":
      return <path d="M12 3 22 20H2L12 3Zm-1 6v5h2V9h-2Zm0 7v2h2v-2h-2Z" />
    case "expand":
      return <path d="M4 4h7v2H7.4l4.2 4.2-1.4 1.4L6 7.4V11H4V4Zm9 0h7v7h-2V7.4l-4.2 4.2-1.4-1.4L16.6 6H13V4ZM6 16.6l4.2-4.2 1.4 1.4L7.4 18H11v2H4v-7h2v3.6Zm7.8-4.2 4.2 4.2V13h2v7h-7v-2h3.6l-4.2-4.2 1.4-1.4Z" />
    case "plus":
      return <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
    case "download":
      return <path d="M11 3h2v9.2l3.3-3.3 1.4 1.4L12 16l-5.7-5.7 1.4-1.4 3.3 3.3V3Zm-6 15h14v3H5v-3Z" />
    case "share":
      return <path d="M18 16.1a3 3 0 0 0-2.2 1l-6.1-3.5a3.2 3.2 0 0 0 0-1.2l6-3.5A3 3 0 1 0 14.8 7l-6 3.5a3 3 0 1 0 0 5l6.1 3.6A3 3 0 1 0 18 16.1Z" />
    case "thumbUp":
      return <path d="M2 10h4v11H2V10Zm6 10h8.5a3 3 0 0 0 3-2.5l1.2-7A3 3 0 0 0 17.8 7H14l.6-3.2A2.3 2.3 0 0 0 12.3 1h-.5L8 8.2V20Z" />
    case "thumbDown":
      return <path d="M2 3h4v11H2V3Zm6 1v11.8l3.8 7.2h.5a2.3 2.3 0 0 0 2.3-2.8L14 17h3.8a3 3 0 0 0 2.9-3.5l-1.2-7a3 3 0 0 0-3-2.5H8Z" />
    case "trash":
      return <path d="M8 3h8l1 2h4v2H3V5h4l1-2Zm-2 6h12l-1 12H7L6 9Zm3 2 .5 8h2L11 11H9Zm4 0-.5 8h2l.5-8h-2Z" />
  }
}

function downloadDebugTrace(trace?: DebugTrace) {
  if (!trace) return

  const markdown = formatDebugTraceMarkdown(trace)
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `debug-trace-${sanitizeFileName(trace.runId)}.md`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function formatDebugTraceMarkdown(trace: DebugTrace): string {
  const statusLabel = trace.status === "success" ? "成功" : trace.status === "warning" ? "注意" : "失敗"
  const lines = [
    `# Debug Trace ${trace.runId}`,
    "",
    "## Summary",
    "",
    `- Run ID: ${trace.runId}`,
    `- Status: ${statusLabel}`,
    `- Question: ${trace.question}`,
    `- Answerable: ${trace.isAnswerable ? "Yes" : "No"}`,
    `- Started At: ${trace.startedAt}`,
    `- Completed At: ${trace.completedAt}`,
    `- Total Latency: ${formatLatency(trace.totalLatencyMs)}`,
    `- Model ID: ${trace.modelId}`,
    `- Embedding Model ID: ${trace.embeddingModelId}`,
    `- Clue Model ID: ${trace.clueModelId}`,
    `- Top K: ${trace.topK}`,
    `- Memory Top K: ${trace.memoryTopK}`,
    `- Min Score: ${trace.minScore}`,
    "",
    "## Answer Preview",
    "",
    trace.answerPreview || "-",
    "",
    "## Steps",
    "",
    ...trace.steps.flatMap((step) => [
      `### ${step.id}. ${step.label}`,
      "",
      `- Status: ${step.status}`,
      `- Latency: ${formatLatency(step.latencyMs)}`,
      step.modelId ? `- Model ID: ${step.modelId}` : undefined,
      step.hitCount !== undefined ? `- Hit Count: ${step.hitCount}` : undefined,
      step.tokenCount !== undefined ? `- Token Count: ${step.tokenCount}` : undefined,
      `- Started At: ${step.startedAt}`,
      `- Completed At: ${step.completedAt}`,
      "",
      step.summary,
      "",
      ...(step.detail ? ["```text", step.detail, "```", ""] : [])
    ].filter((line): line is string => line !== undefined)),
    "## Citations",
    "",
    ...formatCitationMarkdown(trace.citations),
    "## Retrieved",
    "",
    ...formatCitationMarkdown(trace.retrieved)
  ]

  return `${lines.join("\n")}\n`
}

function formatCitationMarkdown(citations: DebugTrace["citations"]): string[] {
  if (citations.length === 0) return ["なし", ""]

  return citations.flatMap((citation, index) => [
    `### ${index + 1}. ${citation.fileName}`,
    "",
    `- Document ID: ${citation.documentId}`,
    citation.chunkId ? `- Chunk ID: ${citation.chunkId}` : undefined,
    `- Score: ${citation.score}`,
    "",
    "```text",
    citation.text,
    "```",
    ""
  ].filter((line): line is string => line !== undefined))
}

function sanitizeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_")
}

function getPlaceholderSteps(): DebugStep[] {
  const now = new Date().toISOString()
  return ["入力解析", "クエリ正規化", "MemoRAGメモリ検索", "ベクトル検索", "再ランキング", "根拠チェック", "Bedrock推論", "最終回答"].map((label, index) => ({
    id: index + 1,
    label,
    status: "success" as const,
    latencyMs: 0,
    summary: "質問を送信すると、このステップの実行内容が表示されます。",
    startedAt: now,
    completedAt: now
  }))
}

function formatLatency(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(2)} 秒`
  return `${Math.round(value)} ms`
}

function formatTime(input: string): string {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return "--:--:--"
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
