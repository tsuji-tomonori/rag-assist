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
  isFavorite?: boolean
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
  | "benchmark:read"
  | "benchmark:run"
  | "benchmark:cancel"
  | "benchmark:download"
  | "usage:read:own"
  | "usage:read:all_users"
  | "cost:read:own"
  | "cost:read:all"
  | "user:create"
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

export type ManagedUserStatus = "active" | "suspended" | "deleted"

export type ManagedUser = {
  userId: string
  email: string
  displayName?: string
  status: ManagedUserStatus
  groups: string[]
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

export type ManagedUserAuditAction = "user:create" | "role:assign" | "user:suspend" | "user:unsuspend" | "user:delete"

export type ManagedUserAuditLogEntry = {
  auditId: string
  action: ManagedUserAuditAction
  actorUserId: string
  actorEmail?: string
  targetUserId: string
  targetEmail: string
  beforeStatus?: ManagedUserStatus
  afterStatus?: ManagedUserStatus
  beforeGroups: string[]
  afterGroups: string[]
  createdAt: string
}

export type AccessRoleDefinition = {
  role: string
  permissions: Permission[]
}

export type UserUsageSummary = {
  userId: string
  email: string
  displayName?: string
  chatMessages: number
  conversationCount: number
  questionCount: number
  documentCount: number
  benchmarkRunCount: number
  debugRunCount: number
  lastActivityAt?: string
}

export type CostAuditItem = {
  service: string
  category: string
  usage: number
  unit: string
  unitCostUsd: number
  estimatedCostUsd: number
  confidence: "actual_usage" | "estimated_usage" | "manual_estimate"
}

export type UserCostSummary = {
  userId: string
  email: string
  estimatedCostUsd: number
}

export type CostAuditSummary = {
  periodStart: string
  periodEnd: string
  currency: "USD"
  totalEstimatedUsd: number
  items: CostAuditItem[]
  users: UserCostSummary[]
  pricingCatalogUpdatedAt: string
}

export async function getMe(): Promise<CurrentUser> {
  const result = await get<{ user: CurrentUser }>("/me")
  return result.user
}

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const result = await get<{ users?: ManagedUser[] }>("/admin/users")
  return result.users ?? []
}

export async function createManagedUser(input: { email: string; displayName?: string; groups?: string[] }): Promise<ManagedUser> {
  return post<ManagedUser>("/admin/users", input)
}

export async function listAdminAuditLog(): Promise<ManagedUserAuditLogEntry[]> {
  const result = await get<{ auditLog?: ManagedUserAuditLogEntry[] }>("/admin/audit-log")
  return result.auditLog ?? []
}

export async function listAccessRoles(): Promise<AccessRoleDefinition[]> {
  const result = await get<{ roles?: AccessRoleDefinition[] }>("/admin/roles")
  return result.roles ?? []
}

export async function assignUserRoles(userId: string, groups: string[]): Promise<ManagedUser> {
  return post<ManagedUser>(`/admin/users/${encodeURIComponent(userId)}/roles`, { groups })
}

export async function suspendManagedUser(userId: string): Promise<ManagedUser> {
  return post<ManagedUser>(`/admin/users/${encodeURIComponent(userId)}/suspend`, {})
}

export async function unsuspendManagedUser(userId: string): Promise<ManagedUser> {
  return post<ManagedUser>(`/admin/users/${encodeURIComponent(userId)}/unsuspend`, {})
}

export async function deleteManagedUser(userId: string): Promise<ManagedUser> {
  const apiBaseUrl = await getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE", headers: createHeaders() })
  if (!response.ok) throw new Error(await response.text())
  return response.json() as Promise<ManagedUser>
}

export async function listUsageSummaries(): Promise<UserUsageSummary[]> {
  const result = await get<{ users?: UserUsageSummary[] }>("/admin/usage")
  return result.users ?? []
}

export async function getCostAuditSummary(): Promise<CostAuditSummary> {
  return get<CostAuditSummary>("/admin/costs")
}

export type BenchmarkRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled"
export type BenchmarkMode = "agent" | "search" | "load"
export type BenchmarkRunner = "codebuild" | "lambda"

export type BenchmarkRunMetrics = {
  total: number
  succeeded: number
  failedHttp: number
  answerableAccuracy?: number | null
  abstentionRecall?: number | null
  citationHitRate?: number | null
  expectedFileHitRate?: number | null
  retrievalRecallAt20?: number | null
  p50LatencyMs?: number | null
  p95LatencyMs?: number | null
  averageLatencyMs?: number | null
  errorRate?: number | null
}

export type BenchmarkRun = {
  runId: string
  status: BenchmarkRunStatus
  mode: BenchmarkMode
  runner: BenchmarkRunner
  suiteId: string
  datasetS3Key: string
  createdBy: string
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  executionArn?: string
  codeBuildBuildId?: string
  modelId?: string
  embeddingModelId?: string
  topK?: number
  memoryTopK?: number
  minScore?: number
  concurrency?: number
  summaryS3Key?: string
  reportS3Key?: string
  resultsS3Key?: string
  metrics?: BenchmarkRunMetrics
  error?: string
}

export type BenchmarkSuite = {
  suiteId: string
  label: string
  mode: BenchmarkMode
  datasetS3Key: string
  preset: "smoke" | "standard"
  defaultConcurrency: number
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

export async function listBenchmarkSuites(): Promise<BenchmarkSuite[]> {
  const result = await get<{ suites?: BenchmarkSuite[] }>("/benchmark-suites")
  return result.suites ?? []
}

export async function listBenchmarkRuns(): Promise<BenchmarkRun[]> {
  const result = await get<{ benchmarkRuns?: BenchmarkRun[] }>("/benchmark-runs")
  return result.benchmarkRuns ?? []
}

export async function startBenchmarkRun(input: {
  suiteId: string
  mode: BenchmarkMode
  runner: BenchmarkRunner
  modelId?: string
  embeddingModelId?: string
  topK?: number
  memoryTopK?: number
  minScore?: number
  concurrency?: number
}): Promise<BenchmarkRun> {
  return post<BenchmarkRun>("/benchmark-runs", input)
}

export async function cancelBenchmarkRun(runId: string): Promise<BenchmarkRun> {
  return post<BenchmarkRun>(`/benchmark-runs/${encodeURIComponent(runId)}/cancel`, {})
}

export async function createBenchmarkDownload(runId: string, artifact: "report" | "summary" | "results" = "report"): Promise<DebugDownloadResponse> {
  return post<DebugDownloadResponse>(`/benchmark-runs/${encodeURIComponent(runId)}/download`, { artifact })
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
