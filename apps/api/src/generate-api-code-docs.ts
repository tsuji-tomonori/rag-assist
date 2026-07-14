import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { analyzeApiCode } from "./api-code-docs/analyzer.js"
import { renderApiCodeDocs } from "./api-code-docs/render.js"
import type { ApiCodeAnalysisResult, RenderedApiCodeDocs } from "./api-code-docs/model.js"
import { loadRuntimeOpenApiDocument } from "./generate-openapi-docs.js"

export const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url))
export const apiSourceRoot = fileURLToPath(new URL("./", import.meta.url))
export const apiTsconfigPath = fileURLToPath(new URL("../tsconfig.json", import.meta.url))
export const apiCodeDocsOutputDir = fileURLToPath(new URL("../../../docs/generated/api-code/", import.meta.url))

export async function buildApiCodeAnalysis(): Promise<ApiCodeAnalysisResult> {
  const api = await loadRuntimeOpenApiDocument()
  return analyzeApiCode({
    api,
    repoRoot: repositoryRoot,
    sourceRoot: apiSourceRoot,
    tsconfigPath: apiTsconfigPath
  })
}

export async function buildApiCodeDocs(): Promise<RenderedApiCodeDocs> {
  return renderApiCodeDocs(await buildApiCodeAnalysis())
}

export async function writeApiCodeDocs(rendered: RenderedApiCodeDocs, outputDir = apiCodeDocsOutputDir): Promise<void> {
  await rm(outputDir, { force: true, recursive: true })
  await mkdir(outputDir, { recursive: true })
  for (const [relativePath, content] of rendered.files) {
    const outputPath = join(outputDir, relativePath)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, content, "utf8")
  }
}

export async function validateApiCodeDocsFreshness(rendered: RenderedApiCodeDocs, outputDir = apiCodeDocsOutputDir): Promise<string[]> {
  const errors: string[] = []
  for (const [relativePath, expected] of rendered.files) {
    const outputPath = join(outputDir, relativePath)
    let actual: string
    try {
      actual = await readFile(outputPath, "utf8")
    } catch {
      errors.push(`${relativePath}: generated document が存在しません。npm run docs:api-code を実行してください`)
      continue
    }
    if (actual !== expected) errors.push(`${relativePath}: 実装コードから再生成した内容と差分があります。npm run docs:api-code を実行してください`)
  }

  const expectedPaths = new Set(rendered.files.keys())
  for (const relativePath of await listFiles(outputDir)) {
    if (!expectedPaths.has(relativePath)) errors.push(`${relativePath}: 現在の API 実装に対応しない stale generated document です`)
  }
  return errors
}

async function listFiles(root: string): Promise<string[]> {
  try {
    await access(root)
  } catch {
    return []
  }
  const result: string[] = []
  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) result.push(relative(root, path).split("\\").join("/"))
    }
  }
  await visit(root)
  return result
}

async function main(): Promise<void> {
  const check = process.argv.slice(2).includes("--check")
  const rendered = await buildApiCodeDocs()
  if (check) {
    const errors = await validateApiCodeDocsFreshness(rendered)
    if (errors.length > 0) {
      console.error("API code document freshness check failed:")
      for (const error of errors) console.error(`- ${error}`)
      process.exitCode = 1
      return
    }
    console.log(`API code document freshness check passed (${rendered.operationCount} APIs, ${rendered.documentCount} API documents)`)
    return
  }

  await writeApiCodeDocs(rendered)
  console.log(`Generated ${rendered.documentCount} API documents for ${rendered.operationCount} APIs in ${apiCodeDocsOutputDir}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
