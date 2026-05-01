type RuntimeConfig = {
  apiBaseUrl?: string
}

let apiBaseUrlPromise: Promise<string> | undefined

async function getApiBaseUrl(): Promise<string> {
  const envUrl = import.meta.env.VITE_API_BASE_URL
  if (envUrl) return trimSlash(envUrl)

  apiBaseUrlPromise ??= fetch("/config.json")
    .then(async (response) => (response.ok ? ((await response.json()) as RuntimeConfig) : {}))
    .then((config) => trimSlash(config.apiBaseUrl || "http://localhost:8787"))
    .catch(() => "http://localhost:8787")

  return apiBaseUrlPromise
}

function trimSlash(input: string): string {
  return input.replace(/\/+$/, "")
}

export type Citation = {
  documentId: string
  fileName: string
  chunkId?: string
  score: number
  text: string
}

export type DebugStep = {
  id: number
  label: string
  status: "success" | "warning" | "error"
  latencyMs: number
  modelId?: string
  summary: string
  detail?: string
  hitCount?: number
  tokenCount?: number
  startedAt: string
  completedAt: string
}

export type DebugTrace = {
  runId: string
  question: string
  modelId: string
  embeddingModelId: string
  clueModelId: string
  topK: number
  memoryTopK: number
  minScore: number
  startedAt: string
  completedAt: string
  totalLatencyMs: number
  status: "success" | "warning" | "error"
  answerPreview: string
  isAnswerable: boolean
  citations: Citation[]
  retrieved: Citation[]
  steps: DebugStep[]
}

export type ChatResponse = {
  answer: string
  isAnswerable: boolean
  citations: Citation[]
  retrieved: Citation[]
  debug?: DebugTrace
}

export type HumanQuestion = {
  questionId: string
  title: string
  question: string
  requesterName: string
  requesterDepartment: string
  assigneeDepartment: string
  category: string
  priority: "normal" | "high" | "urgent"
  status: "open" | "answered" | "resolved"
  sourceQuestion?: string
  chatAnswer?: string
  chatRunId?: string
  references?: string
  answerTitle?: string
  answerBody?: string
  responderName?: string
  responderDepartment?: string
  internalMemo?: string
  notifyRequester?: boolean
  createdAt: string
  updatedAt: string
  answeredAt?: string
  resolvedAt?: string
}

export type DocumentManifest = {
  documentId: string
  fileName: string
  chunkCount: number
  memoryCardCount: number
  createdAt: string
}

export async function uploadDocument(input: {
  fileName: string
  text?: string
  contentBase64?: string
  mimeType?: string
  memoryModelId?: string
  embeddingModelId?: string
}): Promise<DocumentManifest> {
  return post<DocumentManifest>("/documents", input)
}

export async function listDocuments(): Promise<DocumentManifest[]> {
  const result = await get<{ documents: DocumentManifest[] }>("/documents")
  return result.documents
}

export async function listDebugRuns(): Promise<DebugTrace[]> {
  const result = await get<{ debugRuns: DebugTrace[] }>("/debug-runs")
  return result.debugRuns
}

export async function getDebugRun(runId: string): Promise<DebugTrace> {
  return get<DebugTrace>(`/debug-runs/${encodeURIComponent(runId)}`)
}

export type DebugDownloadResponse = {
  url: string
  expiresInSeconds: number
  objectKey: string
}

export async function createDebugDownload(runId: string): Promise<DebugDownloadResponse> {
  return post<DebugDownloadResponse>(`/debug-runs/${encodeURIComponent(runId)}/download`, {})
}

export async function deleteDocument(documentId: string): Promise<void> {
  const apiBaseUrl = await getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}/documents/${encodeURIComponent(documentId)}`, { method: "DELETE" })
  if (!response.ok) throw new Error(await response.text())
}

export async function chat(input: {
  question: string
  modelId: string
  embeddingModelId?: string
  clueModelId?: string
  topK?: number
  minScore?: number
  includeDebug?: boolean
}): Promise<ChatResponse> {
  return post<ChatResponse>("/chat", input)
}

export async function createQuestion(input: {
  title: string
  question: string
  requesterName?: string
  requesterDepartment?: string
  assigneeDepartment?: string
  category?: string
  priority?: HumanQuestion["priority"]
  sourceQuestion?: string
  chatAnswer?: string
  chatRunId?: string
}): Promise<HumanQuestion> {
  return post<HumanQuestion>("/questions", input)
}

export async function listQuestions(): Promise<HumanQuestion[]> {
  const result = await get<{ questions?: HumanQuestion[] }>("/questions")
  return result.questions ?? []
}

export async function answerQuestion(
  questionId: string,
  input: {
    answerTitle: string
    answerBody: string
    responderName?: string
    responderDepartment?: string
    references?: string
    internalMemo?: string
    notifyRequester?: boolean
  }
): Promise<HumanQuestion> {
  return post<HumanQuestion>(`/questions/${encodeURIComponent(questionId)}/answer`, input)
}

export async function resolveQuestion(questionId: string): Promise<HumanQuestion> {
  return post<HumanQuestion>(`/questions/${encodeURIComponent(questionId)}/resolve`, {})
}

async function get<T>(requestPath: string): Promise<T> {
  const apiBaseUrl = await getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}${requestPath}`)
  if (!response.ok) throw new Error(await response.text())
  return response.json() as Promise<T>
}

async function post<T>(requestPath: string, body: unknown): Promise<T> {
  const apiBaseUrl = await getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}${requestPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json() as Promise<T>
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = String(reader.result ?? "")
      resolve(value.includes(",") ? value.split(",")[1] ?? "" : value)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
