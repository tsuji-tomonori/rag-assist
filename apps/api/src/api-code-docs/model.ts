import type { OpenApiDocument, OperationObject } from "../openapi-doc-quality.js"

export const API_CODE_DOCUMENT_NAMES = [
  "detail-design_gen.md",
  "if_gen.md",
  "messages_gen.md",
  "query_gen.md",
  "sequence_gen.md",
  "unit-test_gen.md"
] as const

export type ApiCodeDocumentName = typeof API_CODE_DOCUMENT_NAMES[number]

export type SourceLocation = {
  path: string
  line: number
  symbol?: string
}

export type FunctionReference = {
  name: string
  summary: string
  location: SourceLocation
  depth: number
}

export type CallCategory =
  | "authorization"
  | "validation"
  | "response"
  | "service"
  | "data"
  | "external"
  | "utility"

export type CallSite = {
  caller: string
  callee: string
  expression: string
  arguments: string[]
  category: CallCategory
  description: string
  location: SourceLocation
  declaration?: SourceLocation
  depth: number
}

export type FlowStepKind =
  | "authorization"
  | "validation"
  | "branch"
  | "call"
  | "response"
  | "exception"
  | "loop"
  | "state"

export type FlowStep = {
  order: number
  depth: number
  kind: FlowStepKind
  description: string
  evidence: string
  location: SourceLocation
}

export type BranchFactor = {
  kind: "if" | "conditional" | "catch" | "loop" | "switch"
  functionName: string
  depth: number
  condition: string
  description: string
  location: SourceLocation
}

export type MessageKind = "http-response" | "exception" | "log" | "event" | "contract"

export type MessageSpec = {
  kind: MessageKind
  text: string
  status?: string
  trigger: string
  location?: SourceLocation
}

export type DataAccessKind = "read" | "create" | "update" | "delete" | "execute"

export type DataAccess = {
  kind: DataAccessKind
  boundary: "store" | "external"
  target: string
  operation: string
  purpose: string
  expression: string
  location: SourceLocation
  caller: string
}

export type RelatedTest = {
  name: string
  relation: "route" | "implementation"
  location: SourceLocation
}

export type DiscoveredRoute = {
  method: string
  path: string
  slug: string
  routeLocation: SourceLocation
  handlerLocation: SourceLocation
  handlerName: string
  hasOpenApiContract: boolean
}

export type ApiCodeAnalysis = DiscoveredRoute & {
  summary: string
  description: string
  operation?: OperationObject
  functions: FunctionReference[]
  calls: CallSite[]
  flow: FlowStep[]
  branches: BranchFactor[]
  messages: MessageSpec[]
  dataAccess: DataAccess[]
  tests: RelatedTest[]
  warnings: string[]
}

export type ApiCodeAnalysisResult = {
  api: OpenApiDocument
  operations: ApiCodeAnalysis[]
  sourceRoot: string
  testFiles: string[]
}

export type RenderedApiCodeDocs = {
  files: Map<string, string>
  operationCount: number
  documentCount: number
}

export function operationSlug(method: string, path: string): string {
  const pathSlug = path
    .replaceAll("{", "")
    .replaceAll("}", "")
    .replaceAll("*", "wildcard")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
  return `${method.toLowerCase()}-${pathSlug || "root"}`
}
