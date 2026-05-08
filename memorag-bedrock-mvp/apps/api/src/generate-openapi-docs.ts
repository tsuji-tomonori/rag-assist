import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

process.env.MOCK_BEDROCK ??= "true"
process.env.USE_LOCAL_VECTOR_STORE ??= "true"
process.env.USE_LOCAL_QUESTION_STORE ??= "true"
process.env.USE_LOCAL_CONVERSATION_HISTORY_STORE ??= "true"
process.env.USE_LOCAL_BENCHMARK_RUN_STORE ??= "true"
process.env.USE_LOCAL_CHAT_RUN_STORE ??= "true"
process.env.USE_LOCAL_DOCUMENT_INGEST_RUN_STORE ??= "true"
process.env.LOCAL_DATA_DIR ??= ".local-data"

type JsonObject = Record<string, unknown>

type OpenApiDocument = {
  openapi?: string
  info?: {
    title?: string
    version?: string
    description?: string
  }
  paths?: Record<string, Record<string, OperationObject>>
  components?: {
    schemas?: Record<string, unknown>
    securitySchemes?: Record<string, unknown>
  }
}

type OperationObject = {
  summary?: string
  description?: string
  operationId?: string
  tags?: string[]
  security?: Array<Record<string, string[]>>
  parameters?: ParameterObject[]
  requestBody?: RequestBodyObject
  responses?: Record<string, ResponseObject>
}

type ParameterObject = {
  name?: string
  in?: string
  required?: boolean
  description?: string
  schema?: unknown
}

type RequestBodyObject = {
  required?: boolean
  description?: string
  content?: Record<string, MediaTypeObject>
}

type ResponseObject = {
  description?: string
  content?: Record<string, MediaTypeObject>
}

type MediaTypeObject = {
  schema?: unknown
}

const httpMethods = new Set(["get", "put", "post", "delete", "patch", "options", "head", "trace"])
const outputDir = fileURLToPath(new URL("../../../docs/generated/", import.meta.url))
const openApiOutputPath = join(outputDir, "openapi.json")
const markdownOutputPath = join(outputDir, "openapi.md")

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : undefined
}

function escapeMarkdown(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ").trim()
}

function headingId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9/_{} -]/g, "")
    .replace(/\s+/g, "-")
}

function formatSchema(schema: unknown): string {
  const objectSchema = asObject(schema)
  if (!objectSchema) return "-"
  if (typeof objectSchema.$ref === "string") return `\`${objectSchema.$ref.replace("#/components/schemas/", "")}\``
  if (typeof objectSchema.type === "string") {
    const format = typeof objectSchema.format === "string" ? `:${objectSchema.format}` : ""
    return `\`${objectSchema.type}${format}\``
  }
  return "inline schema"
}

function formatSchemaBlock(schema: unknown): string {
  if (!schema) return "_No schema._"
  return ["```json", JSON.stringify(schema, null, 2), "```"].join("\n")
}

function operationRows(api: OpenApiDocument): string[] {
  const rows = ["| Method | Path | Summary | Tags |", "| --- | --- | --- | --- |"]
  for (const [path, pathItem] of Object.entries(api.paths ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!httpMethods.has(method)) continue
      rows.push(`| \`${method.toUpperCase()}\` | \`${path}\` | ${escapeMarkdown(operation.summary ?? operation.operationId ?? "-")} | ${escapeMarkdown((operation.tags ?? []).join(", ") || "-")} |`)
    }
  }
  return rows
}

function renderParameters(parameters: ParameterObject[] | undefined): string[] {
  if (!parameters?.length) return ["_No parameters._"]
  const rows = ["| Name | In | Required | Schema | Description |", "| --- | --- | --- | --- | --- |"]
  for (const parameter of parameters) {
    rows.push(`| \`${parameter.name ?? "-"}\` | ${parameter.in ?? "-"} | ${parameter.required ? "yes" : "no"} | ${formatSchema(parameter.schema)} | ${escapeMarkdown(parameter.description ?? "-")} |`)
  }
  return rows
}

function renderContent(content: Record<string, MediaTypeObject> | undefined): string[] {
  if (!content || Object.keys(content).length === 0) return ["_No content schema._"]
  const lines: string[] = []
  for (const [mediaType, media] of Object.entries(content).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`Media type: \`${mediaType}\``)
    lines.push("")
    lines.push(formatSchemaBlock(media.schema))
  }
  return lines
}

function renderRequestBody(requestBody: RequestBodyObject | undefined): string[] {
  if (!requestBody) return ["_No request body._"]
  return [
    `Required: ${requestBody.required ? "yes" : "no"}`,
    requestBody.description ? `Description: ${requestBody.description}` : "",
    "",
    ...renderContent(requestBody.content)
  ].filter((line) => line !== "")
}

function renderResponses(responses: Record<string, ResponseObject> | undefined): string[] {
  if (!responses || Object.keys(responses).length === 0) return ["_No responses._"]
  const lines: string[] = []
  for (const [status, response] of Object.entries(responses).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`#### \`${status}\``)
    lines.push("")
    lines.push(response.description ?? "_No description._")
    lines.push("")
    lines.push(...renderContent(response.content))
    lines.push("")
  }
  return lines
}

function renderOperations(api: OpenApiDocument): string[] {
  const lines: string[] = []
  for (const [path, pathItem] of Object.entries(api.paths ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!httpMethods.has(method)) continue
      const title = `${method.toUpperCase()} ${path}`
      lines.push(`### ${title}`)
      lines.push("")
      if (operation.summary) lines.push(operation.summary, "")
      if (operation.description) lines.push(operation.description, "")
      lines.push(`Anchor: \`${headingId(title)}\``)
      lines.push("")
      lines.push(`Tags: ${(operation.tags ?? []).map((tag) => `\`${tag}\``).join(", ") || "-"}`)
      lines.push(`Security: ${operation.security === undefined ? "default" : JSON.stringify(operation.security)}`)
      lines.push("")
      lines.push("#### Parameters")
      lines.push("")
      lines.push(...renderParameters(operation.parameters))
      lines.push("")
      lines.push("#### Request Body")
      lines.push("")
      lines.push(...renderRequestBody(operation.requestBody))
      lines.push("")
      lines.push("#### Responses")
      lines.push("")
      lines.push(...renderResponses(operation.responses))
    }
  }
  return lines
}

function renderSchemas(api: OpenApiDocument): string[] {
  const schemas = api.components?.schemas
  if (!schemas || Object.keys(schemas).length === 0) return ["_No component schemas._"]
  const lines: string[] = []
  for (const [name, schema] of Object.entries(schemas).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`### ${name}`)
    lines.push("")
    lines.push(formatSchemaBlock(schema))
    lines.push("")
  }
  return lines
}

function renderMarkdown(api: OpenApiDocument): string {
  const title = api.info?.title ?? "OpenAPI Reference"
  const version = api.info?.version ?? "-"
  const description = api.info?.description ?? ""
  const lines = [
    `# ${title}`,
    "",
    "<!-- This file is generated by npm run docs:openapi. Do not edit manually. -->",
    "",
    `OpenAPI: \`${api.openapi ?? "-"}\``,
    `Version: \`${version}\``,
    "",
    description,
    "",
    "## Operations",
    "",
    ...operationRows(api),
    "",
    "## Operation Details",
    "",
    ...renderOperations(api),
    "## Components",
    "",
    ...renderSchemas(api)
  ]
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`
}

async function main(): Promise<void> {
  const { default: app } = await import("./app.js")
  const response = await app.request("/openapi.json")
  if (!response.ok) {
    throw new Error(`Failed to generate OpenAPI document: ${response.status}`)
  }

  const api = (await response.json()) as OpenApiDocument
  await mkdir(outputDir, { recursive: true })
  await writeFile(openApiOutputPath, `${JSON.stringify(api, null, 2)}\n`)
  await writeFile(markdownOutputPath, renderMarkdown(api))

  console.log(`Generated ${openApiOutputPath}`)
  console.log(`Generated ${markdownOutputPath}`)
}

await main()
