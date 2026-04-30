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

export type ChatResponse = {
  answer: string
  isAnswerable: boolean
  citations: Citation[]
  retrieved: Citation[]
  debug?: Record<string, unknown>
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
