type RuntimeConfig = {
  apiBaseUrl?: string
  authMode?: "cognito" | "local"
  cognitoRegion?: string
  cognitoUserPoolId?: string
  cognitoUserPoolClientId?: string
}

let runtimeConfigPromise: Promise<RuntimeConfig> | undefined
let authTokenProvider: (() => string | undefined) | undefined

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  runtimeConfigPromise ??= fetch("/config.json")
    .then(async (response) => (response.ok ? ((await response.json()) as RuntimeConfig) : {}))
    .catch(() => ({}))

  const fileConfig = await runtimeConfigPromise
  return {
    ...fileConfig,
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || fileConfig.apiBaseUrl || "http://localhost:8787",
    authMode: (import.meta.env.VITE_AUTH_MODE as RuntimeConfig["authMode"] | undefined) || fileConfig.authMode,
    cognitoRegion: import.meta.env.VITE_COGNITO_REGION || fileConfig.cognitoRegion,
    cognitoUserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || fileConfig.cognitoUserPoolId,
    cognitoUserPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || fileConfig.cognitoUserPoolClientId
  }
}

async function getApiBaseUrl(): Promise<string> {
  if (import.meta.env.VITE_API_BASE_URL) return trimSlash(import.meta.env.VITE_API_BASE_URL)
  const config = await getRuntimeConfig()
  return trimSlash(config.apiBaseUrl || "http://localhost:8787")
}

function trimSlash(input: string): string {
  return input.replace(/\/+$/, "")
}

export function setAuthTokenProvider(provider?: () => string | undefined) {
  authTokenProvider = provider
}

export function resetRuntimeConfigForTests() {
  runtimeConfigPromise = undefined
}

function createHeaders(hasJsonBody = false): HeadersInit {
  const headers: Record<string, string> = {}
  if (hasJsonBody) headers["Content-Type"] = "application/json"
  const token = authTokenProvider?.()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
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
  output?: Record<string, unknown>
  hitCount?: number
  tokenCount?: number
  startedAt: string
  completedAt: string
}

export type DebugTrace = {
  schemaVersion: 1
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

export type ConversationMessage = {
  role: "user" | "assistant"
  text: string
  createdAt: string
  sourceQuestion?: string
  result?: ChatResponse
  questionTicket?: HumanQuestion
}

export type ConversationHistoryItem = {
  schemaVersion: 1
  id: string
  title: string
  updatedAt: string
  messages: ConversationMessage[]
}

export type DocumentManifest = {
  documentId: string
  fileName: string
  chunkCount: number
  memoryCardCount: number
  createdAt: string
}

export type Permission =
  | "chat:create"
  | "chat:read:own"
  | "chat:read:shared"
  | "chat:share:own"
  | "chat:delete:own"
  | "chat:admin:read_all"
  | "answer:edit"
  | "answer:publish"
  | "rag:group:create"
  | "rag:group:assign_manager"
  | "rag:doc:read"
  | "rag:doc:write:group"
  | "rag:doc:delete:group"
  | "rag:index:rebuild:group"
  | "usage:read:own"
  | "usage:read:all_users"
  | "cost:read:own"
  | "cost:read:all"
  | "user:read"
  | "user:suspend"
  | "user:unsuspend"
  | "user:delete"
  | "access:role:create"
  | "access:role:update"
  | "access:role:assign"
  | "access:policy:read"

export type CurrentUser = {
  userId: string
  email?: string
  groups: string[]
  permissions: Permission[]
}

export async function getMe(): Promise<CurrentUser> {
  const result = await get<{ user: CurrentUser }>("/me")
  return result.user
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
  const response = await fetch(`${apiBaseUrl}/documents/${encodeURIComponent(documentId)}`, { method: "DELETE", headers: createHeaders() })
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

export async function listConversationHistory(): Promise<ConversationHistoryItem[]> {
  const result = await get<{ history?: ConversationHistoryItem[] }>("/conversation-history")
  return result.history ?? []
}

export async function saveConversationHistory(input: ConversationHistoryItem): Promise<ConversationHistoryItem> {
  return post<ConversationHistoryItem>("/conversation-history", input)
}

export async function deleteConversationHistory(id: string): Promise<void> {
  const apiBaseUrl = await getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}/conversation-history/${encodeURIComponent(id)}`, { method: "DELETE", headers: createHeaders() })
  if (!response.ok) throw new Error(await response.text())
}

async function get<T>(requestPath: string): Promise<T> {
  const apiBaseUrl = await getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}${requestPath}`, { headers: createHeaders() })
  if (!response.ok) throw new Error(await response.text())
  return response.json() as Promise<T>
}

async function post<T>(requestPath: string, body: unknown): Promise<T> {
  const apiBaseUrl = await getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}${requestPath}`, {
    method: "POST",
    headers: createHeaders(true),
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
