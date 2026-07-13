import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { loadRuntimeOpenApiDocument } from "../generate-openapi-docs.js"
import {
  apiSourceRoot,
  buildApiCodeAnalysis,
  repositoryRoot,
  validateApiCodeDocsFreshness,
  writeApiCodeDocs
} from "../generate-api-code-docs.js"
import { API_CODE_DOCUMENT_NAMES, operationSlug, type RenderedApiCodeDocs } from "./model.js"
import { renderApiCodeDocs } from "./render.js"

type ManifestOperation = {
  method: string
  path: string
  slug: string
  openApi: boolean
}

type Manifest = {
  operationCount: number
  documentsPerOperation: string[]
  operations: ManifestOperation[]
}

const analysisPromise = buildApiCodeAnalysis()
const renderedPromise = analysisPromise.then(renderApiCodeDocs)

test("operation slugs are stable for parameters, root paths, and wildcards", () => {
  assert.equal(operationSlug("POST", "/questions/{questionId}/answer"), "post-questions-questionid-answer")
  assert.equal(operationSlug("GET", "/"), "get-root")
  assert.equal(operationSlug("ALL", "/rpc/*"), "all-rpc-wildcard")
})

test("analysis IR links route, handler, calls, branches, messages, data boundaries, and tests", async () => {
  const analysis = await analysisPromise
  const operation = analysis.operations.find((item) => item.slug === "post-questions-questionid-answer")
  assert.ok(operation)
  assert.equal(operation.hasOpenApiContract, true)
  assert.match(operation.routeLocation.path, /question-routes\.ts$/)
  assert.match(operation.handlerLocation.path, /question-routes\.ts$/)
  assert.ok(operation.functions.some((item) => item.name === "MemoRagService.answerQuestion"))
  assert.ok(operation.calls.some((item) => item.callee === "service.answerQuestion" && item.category === "service"))
  assert.ok(operation.branches.some((item) => item.condition.includes("Question not found")))
  assert.ok(operation.messages.some((item) => item.text === "Question not found" && item.status === "404"))
  assert.ok(operation.dataAccess.some((item) => item.target === "this.deps.questionStore" && item.operation === "answer"))
  assert.ok(operation.tests.some((item) => item.name === "questionRoute_answerAllowsAssignedUser" && item.relation === "route"))
})

test("source discovery generates exactly six documents for every runtime and code-only API", async () => {
  const [rendered, runtimeApi] = await Promise.all([renderedPromise, loadRuntimeOpenApiDocument()])
  const manifest = parseManifest(rendered)
  const runtimeOperationCount = Object.values(runtimeApi.paths ?? {}).reduce((count, pathItem) => (
    count + Object.keys(pathItem).filter((method) => isHttpMethod(method)).length
  ), 0)

  assert.equal(manifest.operationCount, runtimeOperationCount + 2)
  assert.equal(rendered.operationCount, manifest.operationCount)
  assert.equal(rendered.documentCount, manifest.operationCount * API_CODE_DOCUMENT_NAMES.length)
  assert.equal(rendered.files.size, rendered.documentCount + 2)
  assert.deepEqual(manifest.documentsPerOperation, API_CODE_DOCUMENT_NAMES)
  assert.equal(new Set(manifest.operations.map((operation) => operation.slug)).size, manifest.operations.length)

  for (const operation of manifest.operations) {
    for (const documentName of API_CODE_DOCUMENT_NAMES) {
      assert.ok(rendered.files.has(`${operation.slug}/${documentName}`), `${operation.method} ${operation.path}: ${documentName}`)
    }
  }

  assert.deepEqual(
    manifest.operations.filter((operation) => !operation.openApi).map((operation) => `${operation.method} ${operation.path}`).sort(),
    ["ALL /rpc/*", "GET /openapi.json"].sort()
  )
})

test("six projections preserve representative contract, code, data, message, sequence, and test evidence", async () => {
  const rendered = await renderedPromise
  const slug = "post-questions-questionid-answer"

  assert.match(document(rendered, slug, "detail-design_gen.md"), /service\.getQuestion\(questionId\)/)
  assert.match(document(rendered, slug, "detail-design_gen.md"), /this\.deps\.questionStore.*answer/)
  assert.match(document(rendered, slug, "if_gen.md"), /必須 permission \| `answer:publish`/)
  assert.match(document(rendered, slug, "if_gen.md"), /`answerBody` \| `string` \| yes/)
  assert.match(document(rendered, slug, "messages_gen.md"), /Question not found/)
  assert.match(document(rendered, slug, "query_gen.md"), /`this\.deps\.questionStore` \| `get`/)
  assert.match(document(rendered, slug, "query_gen.md"), /`this\.deps\.questionStore` \| `answer`/)
  const sequence = document(rendered, slug, "sequence_gen.md")
  assert.match(sequence, /service の answer question 処理を呼び出す/)
  assert.ok(sequence.indexOf("service の answer question 処理を呼び出す") < sequence.indexOf("HTTP 200 で JSON response を返す"))
  assert.match(document(rendered, slug, "unit-test_gen.md"), /questionRoute_answerRejectsUnassignedAnswerEditor/)
  assert.match(document(rendered, slug, "unit-test_gen.md"), /例外発生/)

  const streamQuery = document(rendered, "get-chat-runs-runid-events", "query_gen.md")
  assert.match(streamQuery, /`deps\.chatRunStore` \| `get`/)
  assert.match(streamQuery, /`deps\.chatRunEventStore` \| `listAfter`/)

  const codeOnlyIf = document(rendered, "get-openapi-json", "if_gen.md")
  assert.match(codeOnlyIf, /OpenAPI 未登録/)
  assert.match(codeOnlyIf, /`enrichOpenApiDocument\(app\.getOpenAPIDocument/)
})

test("rendering is deterministic for one source analysis", async () => {
  const analysis = await analysisPromise
  const first = renderApiCodeDocs(analysis)
  const second = renderApiCodeDocs(analysis)
  assert.deepEqual([...first.files], [...second.files])
})

test("freshness validation catches missing, changed, and stale generated files", async () => {
  const rendered = await renderedPromise
  const outputDir = await mkdtemp(join(tmpdir(), "memorag-api-code-docs-"))
  try {
    const missing = await validateApiCodeDocsFreshness(rendered, outputDir)
    assert.equal(missing.length, rendered.files.size)

    await writeApiCodeDocs(rendered, outputDir)
    assert.deepEqual(await validateApiCodeDocsFreshness(rendered, outputDir), [])

    const indexPath = join(outputDir, "index.md")
    await writeFile(indexPath, `${await readFile(indexPath, "utf8")}changed\n`, "utf8")
    assert.match((await validateApiCodeDocsFreshness(rendered, outputDir)).join("\n"), /index\.md: 実装コードから再生成した内容と差分/)

    await writeApiCodeDocs(rendered, outputDir)
    await mkdir(join(outputDir, "removed-api"), { recursive: true })
    await writeFile(join(outputDir, "removed-api", "detail-design_gen.md"), "stale\n", "utf8")
    assert.match((await validateApiCodeDocsFreshness(rendered, outputDir)).join("\n"), /removed-api\/detail-design_gen\.md:.*stale/)
  } finally {
    await rm(outputDir, { force: true, recursive: true })
  }
})

test("production API implementation contains no document-generation metadata", async () => {
  const routeFiles = await listTypeScriptFiles(join(apiSourceRoot, "routes"))
  const productionFiles = [
    join(apiSourceRoot, "app.ts"),
    join(apiSourceRoot, "rag", "memorag-service.ts"),
    ...routeFiles.filter((path) => !path.endsWith(".test.ts"))
  ]
  const forbidden = /api-code-doc|detail-design_gen|if_gen\.md|messages_gen|query_gen|sequence_gen|unit-test_gen/

  for (const path of productionFiles) {
    const source = await readFile(path, "utf8")
    assert.doesNotMatch(source, forbidden, path.replace(`${repositoryRoot}/`, ""))
  }
})

function parseManifest(rendered: RenderedApiCodeDocs): Manifest {
  const value = rendered.files.get("manifest.json")
  assert.ok(value)
  return JSON.parse(value) as Manifest
}

function document(rendered: RenderedApiCodeDocs, slug: string, name: string): string {
  const value = rendered.files.get(`${slug}/${name}`)
  assert.ok(value, `${slug}/${name}`)
  return value
}

function isHttpMethod(value: string): boolean {
  return ["get", "post", "put", "patch", "delete", "options", "head", "trace"].includes(value.toLowerCase())
}

async function listTypeScriptFiles(root: string): Promise<string[]> {
  const result: string[] = []
  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) result.push(...await listTypeScriptFiles(path))
    else if (entry.isFile() && entry.name.endsWith(".ts")) result.push(path)
  }
  return result
}
