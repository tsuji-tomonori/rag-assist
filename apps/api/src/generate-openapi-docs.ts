import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import {
  contentRows,
  enrichOpenApiDocument,
  isHttpMethod,
  operationKey,
  parameterRows,
  parametersByGroup,
  responseRows,
  validateOpenApiDocument,
  type FieldRow,
  type OpenApiDocument,
  type OperationObject,
  type RouteAuthorizationMetadataObject
} from "./openapi-doc-quality.js"

process.env.MOCK_BEDROCK ??= "true"
process.env.USE_LOCAL_VECTOR_STORE ??= "true"
process.env.USE_LOCAL_QUESTION_STORE ??= "true"
process.env.USE_LOCAL_CONVERSATION_HISTORY_STORE ??= "true"
process.env.USE_LOCAL_BENCHMARK_RUN_STORE ??= "true"
process.env.USE_LOCAL_CHAT_RUN_STORE ??= "true"
process.env.USE_LOCAL_DOCUMENT_INGEST_RUN_STORE ??= "true"
process.env.LOCAL_DATA_DIR ??= ".local-data"

export const outputDir = fileURLToPath(new URL("../../../docs/generated/", import.meta.url))
const openApiOutputPath = join(outputDir, "openapi.json")
const markdownOutputPath = join(outputDir, "openapi.md")
const operationOutputDir = join(outputDir, "openapi")

export type OpenApiMarkdownArtifact = {
  relativePath: string
  content: string
}

function escapeMarkdown(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ").trim()
}

function operationRows(api: OpenApiDocument): string[] {
  const rows = ["| Method | Path | Summary | Detail |", "| --- | --- | --- | --- |"]
  for (const item of operationEntries(api)) {
    rows.push(`| \`${item.method.toUpperCase()}\` | \`${item.path}\` | ${escapeMarkdown(item.operation.summary ?? "-")} | [詳細](${item.filePath}) |`)
  }
  return rows
}

function operationEntries(api: OpenApiDocument): Array<{
  method: string
  path: string
  operation: OperationObject
  fileName: string
  filePath: string
}> {
  const entries: Array<{
    method: string
    path: string
    operation: OperationObject
    fileName: string
    filePath: string
  }> = []
  for (const [path, pathItem] of Object.entries(api.paths ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isHttpMethod(method)) continue
      const fileName = `${operationSlug(method, path)}.md`
      entries.push({
        method,
        path,
        operation,
        fileName,
        filePath: `openapi/${fileName}`
      })
    }
  }
  return entries
}

function operationSlug(method: string, path: string): string {
  const pathSlug = path
    .replaceAll("{", "")
    .replaceAll("}", "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
  return `${method.toLowerCase()}-${pathSlug || "root"}`
}

function fieldTable(rows: FieldRow[], emptyText = "_なし_"): string[] {
  if (rows.length === 0) return [emptyText]
  return [
    "| 項目 | 型 | 必須 | 説明 | 制約 |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| \`${escapeMarkdown(row.name)}\` | \`${escapeMarkdown(row.type)}\` | ${row.required ? "yes" : "no"} | ${escapeMarkdown(row.description)} | ${row.constraints} |`)
  ]
}

function inlineList(values: string[] | undefined, emptyText = "-"): string {
  if (!values || values.length === 0) return emptyText
  return values.map((value) => `\`${escapeMarkdown(value)}\``).join(", ")
}

function renderAuthorization(operation: OperationObject): string[] {
  const auth = operation["x-memorag-authorization"] as RouteAuthorizationMetadataObject | undefined
  if (!auth) return ["_なし_"]
  const requiredPermissions = auth.requiredPermissions ?? []
  const conditionalPermissions = auth.conditionalPermissions ?? []
  const lines: string[] = [
    "| 項目 | 内容 |",
    "| --- | --- |",
    `| 認可モード | \`${escapeMarkdown(auth.mode ?? "-")}\` |`,
    `| 必須 permission | ${inlineList(requiredPermissions)} |`,
    `| 条件付き permission | ${inlineList(conditionalPermissions)} |`,
    `| 実行可能 role | ${inlineList(auth.allowedRoles)} |`,
    `| エラーになる role | ${inlineList(auth.deniedRoles, "なし")} |`,
    `| 条件付きでエラーになる role | ${inlineList(auth.conditionalDeniedRoles, "なし")} |`
  ]
  if (auth.notes && auth.notes.length > 0) {
    lines.push("")
    lines.push("補足:")
    for (const note of auth.notes) lines.push(`- ${escapeMarkdown(note)}`)
  }
  if (auth.errors && auth.errors.length > 0) {
    lines.push("")
    lines.push("認証・認可エラー:")
    lines.push("")
    lines.push("| Status | 発生条件 | Body |")
    lines.push("| --- | --- | --- |")
    for (const error of auth.errors) {
      lines.push(`| \`${error.status ?? "-"}\` | ${escapeMarkdown(error.when ?? "-")} | \`${escapeMarkdown(JSON.stringify(error.body ?? {}))}\` |`)
    }
  }
  return lines
}

function renderLifecycle(operation: OperationObject): string[] {
  const lifecycle = operation["x-memorag-lifecycle"]
  if (!lifecycle) return ["_なし_"]
  const lines = [
    "| 項目 | 内容 |",
    "| --- | --- |",
    `| stage | \`${escapeMarkdown(lifecycle.stage ?? "-")}\` |`,
    `| replacement | ${lifecycle.replacement ? `\`${escapeMarkdown(lifecycle.replacement)}\`` : "-"} |`,
    `| migrationNote | ${escapeMarkdown(lifecycle.migrationNote ?? "-")} |`,
    `| removalPolicy | ${escapeMarkdown(lifecycle.removalPolicy ?? "-")} |`
  ]
  if (lifecycle.notes && lifecycle.notes.length > 0) {
    lines.push("")
    lines.push("補足:")
    for (const note of lifecycle.notes) lines.push(`- ${escapeMarkdown(note)}`)
  }
  return lines
}

function renderRequestData(api: OpenApiDocument, operation: OperationObject): string[] {
  const body = operation.requestBody
  if (!body || typeof body !== "object" || !("content" in body)) return ["_なし_"]
  const content = contentRows(api, body.content)
  if (content.length === 0) return ["_なし_"]
  const lines: string[] = []
  for (const item of content) {
    lines.push(`Media type: \`${item.mediaType}\``)
    lines.push("")
    lines.push(...fieldTable(item.rows))
    lines.push("")
  }
  return lines
}

function renderResponses(api: OpenApiDocument, operation: OperationObject): string[] {
  const responses = responseRows(api, operation.responses)
  if (responses.length === 0) return ["_なし_"]
  const lines: string[] = []
  lines.push("| Status | 説明 | Media type | Body |")
  lines.push("| --- | --- | --- | --- |")
  for (const response of responses) {
    const body = response.mediaType === "-" ? "なし" : response.rows.length > 0 ? `${response.rows.length} field(s)` : "項目なし"
    lines.push(`| \`${response.status}\` | ${escapeMarkdown(response.description)} | \`${escapeMarkdown(response.mediaType)}\` | ${escapeMarkdown(body)} |`)
  }
  lines.push("")
  for (const response of responses) {
    lines.push(`##### \`${response.status}\` ${response.description}`)
    lines.push("")
    lines.push(`Media type: \`${response.mediaType}\``)
    lines.push("")
    lines.push(...fieldTable(response.rows, response.mediaType === "-" ? "_body なし_" : "_項目なし_"))
    lines.push("")
  }
  return lines
}

function renderOperationDetail(api: OpenApiDocument, method: string, path: string, operation: OperationObject): string {
  const lines: string[] = []
  lines.push(`# ${operationKey(method, path)}`)
  lines.push("")
  lines.push("<!-- This file is generated by npm run docs:openapi. Do not edit manually. -->")
  lines.push("")
  lines.push("[API 一覧へ戻る](../openapi.md)")
  lines.push("")
  lines.push(`Summary: ${operation.summary ?? "-"}`)
  lines.push("")
  lines.push(operation.description ?? "-")
  lines.push("")
  lines.push("## Headers")
  lines.push("")
  lines.push(...fieldTable(parameterRows(parametersByGroup(operation, "header"))))
  lines.push("")
  lines.push("## Path Parameters")
  lines.push("")
  lines.push(...fieldTable(parameterRows(parametersByGroup(operation, "path"))))
  lines.push("")
  lines.push("## Query Parameters")
  lines.push("")
  lines.push(...fieldTable(parameterRows(parametersByGroup(operation, "query"))))
  lines.push("")
  lines.push("## Data")
  lines.push("")
  lines.push(...renderRequestData(api, operation))
  lines.push("")
  lines.push("## Authorization")
  lines.push("")
  lines.push(...renderAuthorization(operation))
  lines.push("")
  lines.push("## Lifecycle")
  lines.push("")
  lines.push(...renderLifecycle(operation))
  lines.push("")
  lines.push("## Responses")
  lines.push("")
  lines.push(...renderResponses(api, operation))
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`
}

export function renderMarkdown(api: OpenApiDocument): string {
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
    ...operationRows(api)
  ]
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`
}

export async function loadRuntimeOpenApiDocument(): Promise<OpenApiDocument> {
  const { default: app } = await import("./app.js")
  const response = await app.request("/openapi.json")
  if (!response.ok) {
    throw new Error(`Failed to load OpenAPI document from runtime route: ${response.status}`)
  }

  const api = enrichOpenApiDocument((await response.json()) as OpenApiDocument)
  return api
}

export function renderMarkdownArtifacts(api: OpenApiDocument): OpenApiMarkdownArtifact[] {
  return [
    { relativePath: "openapi.md", content: renderMarkdown(api) },
    ...operationEntries(api).map((entry) => ({
      relativePath: `openapi/${entry.fileName}`,
      content: renderOperationDetail(api, entry.method, entry.path, entry.operation)
    }))
  ]
}

export async function validateGeneratedMarkdownFreshness(api: OpenApiDocument): Promise<string[]> {
  const errors: string[] = []
  const artifacts = renderMarkdownArtifacts(api)
  const expectedPaths = new Set(artifacts.map((artifact) => artifact.relativePath))

  try {
    await access(openApiOutputPath)
    errors.push("docs/generated/openapi.json は commit しません。runtime の GET /openapi.json を source of truth にしてください")
  } catch {
    // Expected: JSON contract is served by the runtime route, not checked in as a generated artifact.
  }

  for (const artifact of artifacts) {
    const filePath = join(outputDir, artifact.relativePath)
    let current: string
    try {
      current = await readFile(filePath, "utf8")
    } catch {
      errors.push(`${artifact.relativePath}: generated Markdown が存在しません。npm run docs:openapi を実行してください`)
      continue
    }
    if (current !== artifact.content) {
      errors.push(`${artifact.relativePath}: runtime OpenAPI から生成した Markdown と差分があります。npm run docs:openapi を実行してください`)
    }
  }

  let generatedOperationFiles: string[] = []
  try {
    generatedOperationFiles = (await readdir(operationOutputDir))
      .filter((fileName) => fileName.endsWith(".md"))
      .map((fileName) => `openapi/${fileName}`)
  } catch {
    errors.push("openapi/: generated operation Markdown directory が存在しません。npm run docs:openapi を実行してください")
  }
  for (const relativePath of generatedOperationFiles) {
    if (!expectedPaths.has(relativePath)) {
      errors.push(`${relativePath}: runtime OpenAPI に存在しない stale generated Markdown です。npm run docs:openapi を実行してください`)
    }
  }

  return errors
}

export async function writeOpenApiMarkdownArtifacts(api: OpenApiDocument): Promise<void> {
  await mkdir(outputDir, { recursive: true })
  await rm(openApiOutputPath, { force: true })
  await rm(operationOutputDir, { force: true, recursive: true })
  await mkdir(operationOutputDir, { recursive: true })
  for (const artifact of renderMarkdownArtifacts(api)) {
    await writeFile(join(outputDir, artifact.relativePath), artifact.content)
  }
}

async function main(): Promise<void> {
  const api = await loadRuntimeOpenApiDocument()
  const errors = validateOpenApiDocument(api)
  if (errors.length > 0) {
    throw new Error(`OpenAPI document quality check failed:\n${errors.map((error) => `- ${error}`).join("\n")}`)
  }

  await writeOpenApiMarkdownArtifacts(api)

  console.log(`Generated ${markdownOutputPath}`)
  console.log(`Generated ${operationOutputDir}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
