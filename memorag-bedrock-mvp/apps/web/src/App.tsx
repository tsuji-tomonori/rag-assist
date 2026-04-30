import { FormEvent, useEffect, useMemo, useState } from "react"
import { chat, deleteDocument, fileToBase64, listDocuments, uploadDocument, type ChatResponse, type DocumentManifest } from "./api.js"

type Message = {
  role: "user" | "assistant"
  text: string
  result?: ChatResponse
}

type SourceItem = {
  documentId?: string
  fileName: string
  category: string
  score: number
  updatedAt: string
}

type IconName =
  | "sparkle"
  | "chat"
  | "clock"
  | "book"
  | "settings"
  | "paperclip"
  | "calendar"
  | "wallet"
  | "home"
  | "document"
  | "keyboard"
  | "contrast"
  | "reader"
  | "external"
  | "chevron"
  | "close"
  | "logo"

const defaultModelId = "amazon.nova-lite-v1:0"
const defaultEmbeddingModelId = "amazon.titan-embed-text-v2:0"

const examples = [
  { icon: "calendar" as const, text: "休暇申請の手順を教えて" },
  { icon: "wallet" as const, text: "経費精算のルールは？" },
  { icon: "home" as const, text: "在宅勤務の申請方法は？" }
]

const fallbackSources = [
  { fileName: "休暇申請マニュアル", category: "社内規程", score: 95, updatedAt: "2025/04/15" },
  { fileName: "休暇申請フォームの使い方", category: "業務ガイド", score: 88, updatedAt: "2025/03/10" },
  { fileName: "よくある質問（休暇）", category: "FAQ", score: 76, updatedAt: "2025/02/20" }
]

export default function App() {
  const [documents, setDocuments] = useState<DocumentManifest[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [question, setQuestion] = useState("")
  const [modelId, setModelId] = useState(defaultModelId)
  const [embeddingModelId, setEmbeddingModelId] = useState(defaultEmbeddingModelId)
  const [minScore, setMinScore] = useState(0.2)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(true)

  const canAsk = useMemo(() => (question.trim().length > 0 || file !== null) && !loading, [question, file, loading])

  const sourceItems = useMemo<SourceItem[]>(() => {
    if (documents.length > 0) {
      return documents.slice(0, 3).map((document, index) => ({
        documentId: document.documentId,
        fileName: document.fileName,
        category: `${document.chunkCount} chunks / ${document.memoryCardCount} memory`,
        score: Math.max(72, 96 - index * 8),
        updatedAt: formatDate(document.createdAt)
      }))
    }
    return fallbackSources
  }, [documents])

  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant")
  const displayMessages = messages.length > 0 ? messages : getEmptyMessages()
  const displayCitations = latestAssistant?.result?.citations ?? []

  useEffect(() => {
    refreshDocuments().catch((err) => console.warn("Failed to load documents", err))
  }, [])

  async function refreshDocuments() {
    setDocuments(await listDocuments())
  }

  async function onAsk(event: FormEvent) {
    event.preventDefault()
    if (!canAsk) return

    const userQuestion = question.trim() || `${file?.name ?? "添付資料"}を取り込んでください`
    setQuestion("")
    setMessages((prev) => [...prev, { role: "user", text: userQuestion }])
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

      if (userQuestion.trim().length > 0 && question.trim().length > 0) {
        const result = await chat({
          question: userQuestion,
          modelId,
          embeddingModelId,
          clueModelId: modelId,
          topK: 6,
          minScore,
          includeDebug: true
        })
        setMessages((prev) => [...prev, { role: "assistant", text: result.answer, result }])
      } else {
        setMessages((prev) => [...prev, { role: "assistant", text: "資料を取り込みました。知りたいことを入力してください。" }])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onDelete(documentId?: string) {
    if (!documentId) return
    setLoading(true)
    setError(null)
    try {
      await deleteDocument(documentId)
      await refreshDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="主要ナビゲーション">
        <a className="brand" href="/" aria-label="RAG Assist ホーム">
          <Icon name="logo" />
          <span>RAG Assist</span>
        </a>

        <nav className="side-nav">
          <button className="nav-item active" type="button">
            <Icon name="chat" />
            <span>チャット</span>
          </button>
          <button className="nav-item" type="button">
            <Icon name="clock" />
            <span>履歴</span>
          </button>
          <button className="nav-item" type="button">
            <Icon name="book" />
            <span>ナレッジ</span>
          </button>
          <button className="nav-item" type="button" onClick={() => setSettingsOpen((open) => !open)}>
            <Icon name="settings" />
            <span>設定</span>
          </button>
        </nav>

        {settingsOpen && (
          <section className="settings-popover" aria-label="モデル設定">
            <label>
              回答モデルID
              <input value={modelId} onChange={(event) => setModelId(event.target.value)} />
            </label>
            <label>
              埋め込みモデルID
              <input value={embeddingModelId} onChange={(event) => setEmbeddingModelId(event.target.value)} />
            </label>
            <label>
              回答拒否しきい値
              <input type="number" step="0.05" min="-1" max="1" value={minScore} onChange={(event) => setMinScore(Number(event.target.value))} />
            </label>
          </section>
        )}

        <button className="profile" type="button">
          <span className="avatar" aria-hidden="true">山</span>
          <span>山田 太郎</span>
          <Icon name="chevron" />
        </button>
      </aside>

      <section className="workspace">
        <section className="content">
          <header className="page-head">
            <h1>RAG Assist へようこそ</h1>
            <p>社内のナレッジを、素早く見つけて解決しましょう。</p>
          </header>

          {error && <div className="error-banner">{error}</div>}

          <form className="question-box" onSubmit={onAsk}>
            <textarea
              aria-label="質問"
              placeholder="知りたいことを入力してください"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <div className="question-actions">
              <label className="attach-button" title="資料を添付">
                <Icon name="paperclip" />
                <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              </label>
              <button className="ask-button" disabled={!canAsk} type="submit">
                <Icon name="sparkle" />
                <span>{loading ? "処理中" : "質問する"}</span>
              </button>
            </div>
            {file && <p className="attached-file">添付中: {file.name}</p>}
          </form>

          <section className="examples" aria-label="よくある質問の例">
            <h2>よくある質問の例</h2>
            <div className="example-grid">
              {examples.map((example) => (
                <button className="example-card" type="button" key={example.text} onClick={() => setQuestion(example.text)}>
                  <Icon name={example.icon} />
                  <span>{example.text}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="conversation" aria-label="チャット">
            {displayMessages.map((message, index) => (
              <article className={`chat-row ${message.role}`} key={`${message.role}-${index}`}>
                <div className="chat-icon">
                  {message.role === "user" ? <Icon name="chat" /> : <Icon name="logo" />}
                </div>
                <div className="chat-body">
                  <div className="message-meta">
                    <strong>{message.role === "user" ? "あなた" : "RAG Assist"}</strong>
                    <span>10:30</span>
                  </div>
                  {message.role === "assistant" ? <AssistantAnswer message={message} /> : <p>{message.text}</p>}
                </div>
              </article>
            ))}
          </section>

          {displayCitations.length > 0 && (
            <section className="citation-cards" aria-label="回答に使った参照ソース">
              <h2>参考ソース（{displayCitations.length}件）</h2>
              <div className="source-card-grid">
                {displayCitations.slice(0, 3).map((citation, index) => (
                  <article className="mini-source" key={`${citation.documentId}-${index}`}>
                    <Icon name="document" />
                    <div>
                      <strong>{citation.fileName}</strong>
                      <span>{citation.chunkId ?? "引用"}</span>
                      <small>関連度 {Math.round(citation.score * 100)}%</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {noticeOpen && (
            <aside className="help-notice">
              <Icon name="sparkle" />
              <span><strong>はじめての方へ：</strong>まずは知りたいことを入力して、質問してみましょう。</span>
              <button type="button" aria-label="閉じる" onClick={() => setNoticeOpen(false)}>
                <Icon name="close" />
              </button>
            </aside>
          )}
        </section>

        <aside className="sources-panel" aria-label="参照ソース">
          <header>
            <h2>参照ソース</h2>
            <Icon name="chevron" />
          </header>
          <p>{sourceItems.length}件の情報源を使用</p>
          <div className="source-list">
            {sourceItems.map((source) => (
              <article className="source-item" key={source.fileName}>
                <Icon name="document" />
                <div>
                  <strong>{source.fileName}</strong>
                  <span>{source.category}</span>
                  <small>関連度 {source.score}%</small>
                </div>
                {source.documentId && (
                  <button type="button" aria-label={`${source.fileName}を削除`} onClick={() => onDelete(source.documentId)} disabled={loading}>
                    <Icon name="close" />
                  </button>
                )}
              </article>
            ))}
          </div>
          <button className="all-source-button" type="button">すべてのソースを見る</button>
        </aside>
      </section>

      <footer className="accessibility-bar">
        <div>
          <Icon name="keyboard" />
          <span><b>キーボード操作に対応</b><small>Tab や Enter で快適に操作できます</small></span>
        </div>
        <div>
          <Icon name="contrast" />
          <span><b>高コントラスト</b><small>文字や色のコントラストを最適化</small></span>
        </div>
        <div>
          <Icon name="reader" />
          <span><b>スクリーンリーダー対応</b><small>読み上げに配慮したラベル設計</small></span>
        </div>
        <a href="/" aria-label="アクセシビリティについて">
          アクセシビリティについて
          <Icon name="external" />
        </a>
      </footer>
    </main>
  )
}

function AssistantAnswer({ message }: { message: Message }) {
  if (message.result) {
    return (
      <>
        <p className="answer-lead">{message.text}</p>
        {message.result.citations.length > 0 && (
          <details className="details-panel">
            <summary>引用・検索結果</summary>
            {message.result.citations.map((citation, citationIndex) => (
              <blockquote key={citationIndex}>
                <strong>{citation.fileName}</strong>
                <span>{citation.text}</span>
              </blockquote>
            ))}
          </details>
        )}
      </>
    )
  }

  return (
    <div className="answer-preview">
      <p className="answer-title">休暇申請は、以下の3ステップで行います。</p>
      <ol>
        <li><strong>申請</strong><span>申請フォームに必要事項を入力し、提出します。</span></li>
        <li><strong>承認</strong><span>直属の上長が内容を確認し、承認または差戻しを行います。</span></li>
        <li><strong>通知</strong><span>承認が完了すると、申請者にメールで通知されます。</span></li>
      </ol>
    </div>
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
      return (
        <>
          <path d="M12 3a9 9 0 0 0-8.8 7.1h4.1a5.2 5.2 0 0 1 4.7-3.1V3Z" />
          <path d="M20.8 10.1A9 9 0 0 0 13 3v4a5.2 5.2 0 0 1 3.6 8.9l2.8 2.8a8.9 8.9 0 0 0 1.4-8.6Z" />
          <path d="M4.6 13.1A9 9 0 0 0 17 20.5l-2.8-2.8a5.2 5.2 0 0 1-6.9-4.6H4.6Z" />
        </>
      )
    case "sparkle":
      return <path d="M12 2.8 14.1 9l6.1 2.1-6.1 2.1L12 19.2l-2.1-6.1-6.1-2.1 6.1-2.1L12 2.8Zm6.2 12.4.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
    case "chat":
      return <path d="M5 5.8A6.8 6.8 0 0 1 11.8 3h.4A6.8 6.8 0 0 1 19 9.8v.4A6.8 6.8 0 0 1 12.2 17H10l-4.8 3 .9-4.8A6.8 6.8 0 0 1 3 10.2v-.4A6.8 6.8 0 0 1 5 5.8Zm3.1 4.4h1.8v1.8H8.1v-1.8Zm4 0h1.8v1.8h-1.8v-1.8Zm4 0h1.8v1.8h-1.8v-1.8Z" />
    case "clock":
      return <path d="M12 2.8a9.2 9.2 0 1 0 0 18.4 9.2 9.2 0 0 0 0-18.4Zm1 4.4v4.3l3.2 2-.9 1.5-4.1-2.5V7.2H13Z" />
    case "book":
      return <path d="M5 4.1c2.2 0 4 .5 5.6 1.8v14c-1.6-1.2-3.4-1.8-5.6-1.8H3.5v-14H5Zm14 0h1.5v14H19c-2.2 0-4 .6-5.6 1.8v-14c1.6-1.3 3.4-1.8 5.6-1.8Z" />
    case "settings":
      return <path d="M13.2 2.8 14 5.2a7.5 7.5 0 0 1 1.5.6l2.2-1.1 1.6 1.6-1.1 2.2c.3.5.5 1 .6 1.5l2.4.8v2.4l-2.4.8c-.1.5-.4 1-.6 1.5l1.1 2.2-1.6 1.6-2.2-1.1c-.5.3-1 .5-1.5.6l-.8 2.4h-2.4l-.8-2.4a7.5 7.5 0 0 1-1.5-.6l-2.2 1.1-1.6-1.6 1.1-2.2c-.3-.5-.5-1-.6-1.5l-2.4-.8v-2.4l2.4-.8c.1-.5.4-1 .6-1.5L4.7 6.3l1.6-1.6 2.2 1.1c.5-.3 1-.5 1.5-.6l.8-2.4h2.4ZM12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" />
    case "paperclip":
      return <path d="m7.5 13.3 6.8-6.8a3.4 3.4 0 0 1 4.8 4.8l-7.8 7.8a5.2 5.2 0 0 1-7.3-7.3l8.1-8.1 1.4 1.4-8.1 8.1a3.2 3.2 0 0 0 4.5 4.5l7.8-7.8a1.4 1.4 0 0 0-2-2l-6.8 6.8a.9.9 0 0 0 1.3 1.3l5.7-5.7 1.4 1.4-5.7 5.7a2.9 2.9 0 0 1-4.1-4.1Z" />
    case "calendar":
      return <path d="M7 3h2v2h6V3h2v2h3v15H4V5h3V3Zm11 7H6v8h12v-8Zm-9 2h2v2H9v-2Zm4 0h2v2h-2v-2Z" />
    case "wallet":
      return <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H18v3h1.5A2.5 2.5 0 0 1 22 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 4 17.5v-11ZM6.5 6a.5.5 0 0 0 0 1H16V6H6.5ZM18 12h2v3h-2a1.5 1.5 0 0 1 0-3Z" />
    case "home":
      return <path d="m3 11 9-8 9 8-1.4 1.5L18 11.1V20h-5v-5h-2v5H6v-8.9l-1.6 1.4L3 11Z" />
    case "document":
      return <path d="M6 3h8l4 4v14H6V3Zm7 1.8V8h3.2L13 4.8ZM8.5 11h7v1.8h-7V11Zm0 3.5h7v1.8h-7v-1.8Z" />
    case "keyboard":
      return <path d="M3 6h18v12H3V6Zm3 3v2h2V9H6Zm3.2 0v2h2V9h-2Zm3.2 0v2h2V9h-2Zm3.2 0v2h2V9h-2ZM6 13v2h8.5v-2H6Zm10.2 0v2H18v-2h-1.8Z" />
    case "contrast":
      return <path d="M12 3a9 9 0 1 0 0 18V3Zm0 2a7 7 0 0 1 0 14V5Z" />
    case "reader":
      return <path d="M12 4a2.4 2.4 0 1 0 0 4.8A2.4 2.4 0 0 0 12 4Zm-6.5 6h13v2H14v8h-2v-5h-1v5H9v-8H5.5v-2Z" />
    case "external":
      return <path d="M14 4h6v6h-2V7.4l-7.2 7.2-1.4-1.4L16.6 6H14V4ZM5 6h6v2H7v9h9v-4h2v6H5V6Z" />
    case "chevron":
      return <path d="m7.5 9.2 1.4-1.4L12 10.9l3.1-3.1 1.4 1.4L12 13.7 7.5 9.2Z" />
    case "close":
      return <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
  }
}

function getEmptyMessages(): Message[] {
  return [
    { role: "user", text: "休暇申請の手順を教えて" },
    { role: "assistant", text: "" }
  ]
}

function formatDate(input: string): string {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return "更新日 不明"
  return `更新日 ${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`
}
