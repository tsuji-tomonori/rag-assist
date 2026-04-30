import { createReadStream, createWriteStream, existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import readline from "node:readline"
import { fileURLToPath } from "node:url"

type DatasetRow = {
  id?: string
  question: string
  expected?: string
  modelId?: string
  embeddingModelId?: string
}

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8787"
const defaultModelId = process.env.MODEL_ID ?? "amazon.nova-lite-v1:0"
const benchmarkDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(benchmarkDir, "..")
const datasetPath = resolveExistingPath(process.env.DATASET ?? "dataset.sample.jsonl", [process.cwd(), benchmarkDir, repoRoot])
const outputPath = resolveOutputPath(process.env.OUTPUT ?? ".local-data/benchmark-results.jsonl")

await mkdir(path.dirname(outputPath), { recursive: true })
const out = createWriteStream(outputPath, { encoding: "utf-8" })
const rl = readline.createInterface({ input: createReadStream(datasetPath, { encoding: "utf-8" }), crlfDelay: Infinity })

let count = 0
for await (const line of rl) {
  if (!line.trim()) continue
  const row = JSON.parse(line) as DatasetRow
  const startedAt = Date.now()
  const response = await fetch(`${apiBaseUrl}/benchmark/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: row.id,
      question: row.question,
      modelId: row.modelId ?? defaultModelId,
      embeddingModelId: row.embeddingModelId,
      includeDebug: true
    })
  })
  const body = await response.json()
  const result = {
    ...row,
    status: response.status,
    latencyMs: Date.now() - startedAt,
    result: body
  }
  out.write(`${JSON.stringify(result)}\n`)
  count += 1
}

out.end()
console.log(`Wrote ${count} benchmark rows to ${outputPath}`)

function resolveExistingPath(input: string, bases: string[]): string {
  if (path.isAbsolute(input)) return input
  for (const base of bases) {
    const candidate = path.resolve(base, input)
    if (existsSync(candidate)) return candidate
  }
  return path.resolve(process.cwd(), input)
}

function resolveOutputPath(input: string): string {
  if (path.isAbsolute(input)) return input
  return path.resolve(repoRoot, input)
}
