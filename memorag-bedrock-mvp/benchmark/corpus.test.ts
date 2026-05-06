import assert from "node:assert/strict"
import test from "node:test"
import { createHash } from "node:crypto"
import { mkdtemp, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { benchmarkCorpusDirFromEnv, benchmarkCorpusSkipMemoryFromEnv, createBenchmarkIngestSignature, seedBenchmarkCorpus } from "./corpus.js"

test("benchmark corpus env helpers resolve optional corpus settings", () => {
  assert.equal(benchmarkCorpusDirFromEnv({}, "benchmark/corpus/standard-agent-v1"), "benchmark/corpus/standard-agent-v1")
  assert.equal(benchmarkCorpusDirFromEnv({ BENCHMARK_CORPUS_DIR: " custom " }), "custom")
  assert.equal(benchmarkCorpusDirFromEnv({ BENCHMARK_CORPUS_DIR: " " }), undefined)
  assert.equal(benchmarkCorpusSkipMemoryFromEnv({}), true)
  assert.equal(benchmarkCorpusSkipMemoryFromEnv({ BENCHMARK_CORPUS_SKIP_MEMORY: "false" }), false)
})

test("seedBenchmarkCorpus skips an already active matching seed document", async () => {
  const corpusDir = await mkdtemp(path.join(os.tmpdir(), "benchmark-corpus-"))
  const corpusText = "# Handbook\n\n経費精算は30日以内です。\n"
  const sourceHash = createHash("sha256").update(corpusText).digest("hex")
  const ingestSignature = createBenchmarkIngestSignature({
    sourceHash,
    suiteId: "standard-agent-v1",
    skipMemory: true
  })
  await writeFile(path.join(corpusDir, "handbook.md"), corpusText, "utf-8")
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify({
      documents: [{
        fileName: "handbook.md",
        lifecycleStatus: "active",
        chunkCount: 1,
        metadata: {
          benchmarkSeed: true,
          benchmarkSuiteId: "standard-agent-v1",
          benchmarkSourceHash: sourceHash,
          benchmarkIngestSignature: ingestSignature,
          benchmarkCorpusSkipMemory: true,
          benchmarkEmbeddingModelId: "api-default",
          aclGroups: ["BENCHMARK_RUNNER"],
          docType: "benchmark-corpus",
          source: "benchmark-runner"
        }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  }

  const [result] = await seedBenchmarkCorpus({
    apiBaseUrl: "http://localhost:8787",
    corpusDir,
    suiteId: "standard-agent-v1",
    skipMemory: true,
    fetchImpl
  })

  assert.equal(result?.fileName, "handbook.md")
  assert.equal(result?.status, "skipped")
  assert.equal(result?.ingestSignature, ingestSignature)
  assert.equal(calls.length, 1)
})

test("seedBenchmarkCorpus reuploads when seed ingest signature differs", async () => {
  const corpusDir = await mkdtemp(path.join(os.tmpdir(), "benchmark-corpus-"))
  await writeFile(path.join(corpusDir, "handbook.md"), "# Handbook\n\n経費精算は30日以内です。\n", "utf-8")
  const methods: Array<string | undefined> = []
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    methods.push(init?.method)
    if (init?.method === "GET") {
      return new Response(JSON.stringify({
        documents: [{
          fileName: "handbook.md",
          lifecycleStatus: "active",
          chunkCount: 1,
          metadata: {
            benchmarkSeed: true,
            benchmarkSuiteId: "standard-agent-v1",
            benchmarkSourceHash: "outdated",
            benchmarkIngestSignature: "outdated",
            benchmarkCorpusSkipMemory: true,
            benchmarkEmbeddingModelId: "api-default"
          }
        }]
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    }
    return new Response(JSON.stringify({ fileName: "handbook.md", lifecycleStatus: "active", chunkCount: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  }

  const [result] = await seedBenchmarkCorpus({
    apiBaseUrl: "http://localhost:8787",
    corpusDir,
    suiteId: "standard-agent-v1",
    skipMemory: true,
    embeddingModelId: "embed-model",
    fetchImpl
  })

  assert.equal(result?.status, "uploaded")
  assert.deepEqual(methods, ["GET", "POST"])
})

test("seedBenchmarkCorpus uploads markdown files with benchmark metadata", async () => {
  const corpusDir = await mkdtemp(path.join(os.tmpdir(), "benchmark-corpus-"))
  await writeFile(path.join(corpusDir, "handbook.md"), "# Handbook\n\n経費精算は30日以内です。\n", "utf-8")
  const requests: Array<{ url: string; body?: unknown; authorization?: string }> = []
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    requests.push({ url: String(url), body, authorization: (init?.headers as Record<string, string> | undefined)?.Authorization })
    if (init?.method === "GET") {
      return new Response(JSON.stringify({ documents: [] }), { status: 200, headers: { "Content-Type": "application/json" } })
    }
    return new Response(JSON.stringify({ fileName: "handbook.md", lifecycleStatus: "active", chunkCount: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  }

  const [result] = await seedBenchmarkCorpus({
    apiBaseUrl: "http://localhost:8787",
    authToken: "token",
    corpusDir,
    suiteId: "standard-agent-v1",
    skipMemory: true,
    embeddingModelId: "embed-model",
    fetchImpl
  })

  const upload = requests.at(-1)
  assert.equal(result?.status, "uploaded")
  assert.equal(result?.chunkCount, 1)
  assert.equal(upload?.authorization, "Bearer token")
  assert.equal((upload?.body as { fileName?: string }).fileName, "handbook.md")
  assert.equal((upload?.body as { mimeType?: string }).mimeType, "text/markdown")
  assert.equal((upload?.body as { embeddingModelId?: string }).embeddingModelId, "embed-model")
  assert.equal((upload?.body as { skipMemory?: boolean }).skipMemory, true)
  assert.equal((upload?.body as { metadata?: { benchmarkSuiteId?: string } }).metadata?.benchmarkSuiteId, "standard-agent-v1")
  assert.equal((upload?.body as { metadata?: { benchmarkCorpusSkipMemory?: boolean } }).metadata?.benchmarkCorpusSkipMemory, true)
  assert.equal((upload?.body as { metadata?: { benchmarkEmbeddingModelId?: string } }).metadata?.benchmarkEmbeddingModelId, "embed-model")
  assert.deepEqual((upload?.body as { metadata?: { aclGroups?: string[] } }).metadata?.aclGroups, ["BENCHMARK_RUNNER"])
  assert.equal((upload?.body as { metadata?: { docType?: string } }).metadata?.docType, "benchmark-corpus")
  assert.equal((upload?.body as { metadata?: { source?: string } }).metadata?.source, "benchmark-runner")
  assert.equal(typeof (upload?.body as { metadata?: { benchmarkIngestSignature?: string } }).metadata?.benchmarkIngestSignature, "string")
})

test("seedBenchmarkCorpus uploads PDF files as base64 content", async () => {
  const corpusDir = await mkdtemp(path.join(os.tmpdir(), "benchmark-corpus-"))
  await writeFile(path.join(corpusDir, "source.pdf"), Buffer.from("%PDF-1.4 sample"))
  const requests: Array<{ body?: unknown }> = []
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    requests.push({ body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (init?.method === "GET") {
      return new Response(JSON.stringify({ documents: [] }), { status: 200, headers: { "Content-Type": "application/json" } })
    }
    return new Response(JSON.stringify({ fileName: "source.pdf", lifecycleStatus: "active", chunkCount: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  }

  await seedBenchmarkCorpus({
    apiBaseUrl: "http://localhost:8787",
    corpusDir,
    suiteId: "allganize-rag-evaluation-ja-v1",
    skipMemory: true,
    fetchImpl
  })

  const upload = requests.at(-1)?.body as { text?: string; contentBase64?: string; mimeType?: string } | undefined
  assert.equal(upload?.text, undefined)
  assert.equal(upload?.contentBase64, Buffer.from("%PDF-1.4 sample").toString("base64"))
  assert.equal(upload?.mimeType, "application/pdf")
})
