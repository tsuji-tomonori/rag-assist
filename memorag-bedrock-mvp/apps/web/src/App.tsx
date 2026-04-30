import { FormEvent, useEffect, useMemo, useState } from "react"
import { chat, deleteDocument, fileToBase64, listDocuments, uploadDocument, type ChatResponse, type DocumentManifest } from "./api.js"

type Message = {
  role: "user" | "assistant"
  text: string
  result?: ChatResponse
}

const defaultModelId = "amazon.nova-lite-v1:0"
const defaultEmbeddingModelId = "amazon.titan-embed-text-v2:0"

export default function App() {
  const [documents, setDocuments] = useState<DocumentManifest[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [manualText, setManualText] = useState("")
  const [question, setQuestion] = useState("")
  const [modelId, setModelId] = useState(defaultModelId)
  const [embeddingModelId, setEmbeddingModelId] = useState(defaultEmbeddingModelId)
  const [minScore, setMinScore] = useState(0.20)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canAsk = useMemo(() => question.trim().length > 0 && !loading, [question, loading])

  useEffect(() => {
    refreshDocuments().catch((err) => setError(String(err)))
  }, [])

  async function refreshDocuments() {
    setDocuments(await listDocuments())
  }

  async function onUpload(event: FormEvent) {
    event.preventDefault()
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
      } else if (manualText.trim()) {
        await uploadDocument({
          fileName: "manual-note.md",
          text: manualText,
          mimeType: "text/markdown",
          memoryModelId: modelId,
          embeddingModelId
        })
        setManualText("")
      } else {
        throw new Error("ファイルまたはテキストを入力してください。")
      }
      setFile(null)
      await refreshDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onAsk(event: FormEvent) {
    event.preventDefault()
    if (!canAsk) return
    const userQuestion = question.trim()
    setQuestion("")
    setMessages((prev) => [...prev, { role: "user", text: userQuestion }])
    setLoading(true)
    setError(null)
    try {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function onDelete(documentId: string) {
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
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">MemoRAG + Bedrock MVP</p>
          <h1>社内資料だけに基づくQAチャット</h1>
          <p>資料から判断できない質問には「資料からは回答できません。」と返します。</p>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="grid">
        <aside className="panel">
          <h2>設定</h2>
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

          <form onSubmit={onUpload} className="stack">
            <h2>資料アップロード</h2>
            <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <textarea placeholder="または、ここに資料テキストを貼り付け" value={manualText} onChange={(event) => setManualText(event.target.value)} />
            <button disabled={loading}>取り込む</button>
          </form>

          <div className="documents">
            <h2>取り込み済み資料</h2>
            {documents.length === 0 && <p className="muted">まだ資料はありません。</p>}
            {documents.map((doc) => (
              <div className="doc" key={doc.documentId}>
                <div>
                  <strong>{doc.fileName}</strong>
                  <small>{doc.chunkCount} chunks / {doc.memoryCardCount} memory</small>
                </div>
                <button className="ghost" onClick={() => onDelete(doc.documentId)} disabled={loading}>削除</button>
              </div>
            ))}
          </div>
        </aside>

        <section className="panel chat">
          <h2>チャット</h2>
          <div className="messages">
            {messages.length === 0 && <p className="muted">質問を入力してください。</p>}
            {messages.map((message, index) => (
              <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <div className="bubble">{message.text}</div>
                {message.result && (
                  <details>
                    <summary>引用・検索結果</summary>
                    <h3>引用</h3>
                    {message.result.citations.length === 0 && <p className="muted">引用なし</p>}
                    {message.result.citations.map((citation, citationIndex) => (
                      <blockquote key={citationIndex}>
                        <strong>{citation.fileName}</strong> / {citation.chunkId} / score {citation.score}
                        <p>{citation.text}</p>
                      </blockquote>
                    ))}
                    <h3>Retrieved</h3>
                    {message.result.retrieved.map((citation, citationIndex) => (
                      <blockquote key={`r-${citationIndex}`}>
                        <strong>{citation.fileName}</strong> / {citation.chunkId} / score {citation.score}
                        <p>{citation.text.slice(0, 500)}</p>
                      </blockquote>
                    ))}
                  </details>
                )}
              </article>
            ))}
          </div>
          <form onSubmit={onAsk} className="ask">
            <input placeholder="資料について質問" value={question} onChange={(event) => setQuestion(event.target.value)} />
            <button disabled={!canAsk}>{loading ? "処理中" : "送信"}</button>
          </form>
        </section>
      </section>
    </main>
  )
}
