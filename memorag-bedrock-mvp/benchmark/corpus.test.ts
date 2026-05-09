import assert from "node:assert/strict"
import test from "node:test"
import { createHash } from "node:crypto"
import { mkdtemp, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { benchmarkCorpusDirFromEnv, benchmarkCorpusSkipMemoryFromEnv, benchmarkIngestRunPollIntervalMsFromEnv, benchmarkIngestRunTimeoutMsFromEnv, createBenchmarkIngestSignature, seedBenchmarkCorpus } from "./corpus.js"

test("benchmark corpus env helpers resolve optional corpus settings", () => {
  assert.equal(benchmarkCorpusDirFromEnv({}, "benchmark/corpus/standard-agent-v1"), "benchmark/corpus/standard-agent-v1")
  assert.equal(benchmarkCorpusDirFromEnv({ BENCHMARK_CORPUS_DIR: " custom " }), "custom")
  assert.equal(benchmarkCorpusDirFromEnv({ BENCHMARK_CORPUS_DIR: " " }), undefined)
  assert.equal(benchmarkCorpusSkipMemoryFromEnv({}), true)
  assert.equal(benchmarkCorpusSkipMemoryFromEnv({ BENCHMARK_CORPUS_SKIP_MEMORY: "false" }), false)
  assert.equal(benchmarkIngestRunPollIntervalMsFromEnv({ BENCHMARK_INGEST_RUN_POLL_INTERVAL_MS: "25" }), 25)
  assert.equal(benchmarkIngestRunTimeoutMsFromEnv({ BENCHMARK_INGEST_RUN_TIMEOUT_MS: "60000" }), 60000)
})

test("seedBenchmarkCorpus deletes an active matching seed document before upload", async () => {
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
    if (init?.method === "GET") return new Response(JSON.stringify({
      documents: [{
        documentId: "doc-existing",
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
    if (init?.method === "DELETE") return new Response(JSON.stringify({ documentId: "doc-existing", deletedVectorCount: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
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
    fetchImpl
  })

  assert.equal(result?.fileName, "handbook.md")
  assert.equal(result?.status, "uploaded")
  assert.equal(result?.ingestSignature, ingestSignature)
  assert.deepEqual(calls.map((call) => `${call.init?.method ?? "GET"} ${call.url}`), [
    "GET http://localhost:8787/documents",
    "DELETE http://localhost:8787/documents/doc-existing",
    "POST http://localhost:8787/documents"
  ])
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

test("seedBenchmarkCorpus stops when deleting stale benchmark corpus fails", async () => {
  const corpusDir = await mkdtemp(path.join(os.tmpdir(), "benchmark-corpus-"))
  await writeFile(path.join(corpusDir, "handbook.md"), "# Handbook\n\n経費精算は30日以内です。\n", "utf-8")
  const methods: Array<string | undefined> = []
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    methods.push(init?.method)
    if (init?.method === "GET") {
      return new Response(JSON.stringify({
        documents: [{
          documentId: "stale-doc",
          fileName: "handbook.md",
          lifecycleStatus: "active",
          chunkCount: 1,
          metadata: {
            benchmarkSeed: true,
            benchmarkSuiteId: "standard-agent-v1",
            benchmarkSourceHash: "old-hash",
            benchmarkIngestSignature: "old-signature",
            benchmarkCorpusSkipMemory: true,
            benchmarkEmbeddingModelId: "api-default",
            aclGroups: ["BENCHMARK_RUNNER"],
            docType: "benchmark-corpus",
            source: "benchmark-runner"
          }
        }]
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    }
    if (init?.method === "DELETE") return new Response("denied", { status: 403 })
    return new Response(JSON.stringify({ fileName: "handbook.md", lifecycleStatus: "active", chunkCount: 1 }), { status: 200 })
  }

  await assert.rejects(
    () => seedBenchmarkCorpus({
      apiBaseUrl: "http://localhost:8787",
      corpusDir,
      suiteId: "standard-agent-v1",
      skipMemory: true,
      fetchImpl
    }),
    /Failed to delete existing benchmark corpus handbook\.md: HTTP 403 denied/
  )
  assert.deepEqual(methods, ["GET", "DELETE"])
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

test("seedBenchmarkCorpus uploads PDF files through upload sessions", async () => {
  const corpusDir = await mkdtemp(path.join(os.tmpdir(), "benchmark-corpus-"))
  await writeFile(path.join(corpusDir, "source.pdf"), Buffer.from("%PDF-1.4 sample"))
  const requests: Array<{ url: string; method?: string; body?: unknown; authorization?: string; contentLength?: string; contentType?: string; host?: string; transferEncoding?: string }> = []
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const requestUrl = String(url)
    const headers = init?.headers as Record<string, string> | undefined
    const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : init?.body
    requests.push({
      url: requestUrl,
      method: init?.method,
      body,
      authorization: headers?.Authorization,
      contentLength: headers?.["Content-Length"] ?? headers?.["content-length"],
      contentType: headers?.["Content-Type"] ?? headers?.["content-type"],
      host: headers?.Host ?? headers?.host,
      transferEncoding: headers?.["Transfer-Encoding"] ?? headers?.["transfer-encoding"]
    })
    if (init?.method === "GET" && requestUrl.endsWith("/documents")) {
      return new Response(JSON.stringify({ documents: [] }), { status: 200, headers: { "Content-Type": "application/json" } })
    }
    if (requestUrl.endsWith("/documents/uploads")) {
      return new Response(JSON.stringify({
        uploadId: "upload-1",
        uploadUrl: "http://upload.local/source.pdf",
        method: "PUT",
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(20 * 1024 * 1024),
          Host: "stale.example.test",
          "Transfer-Encoding": "chunked"
        },
        requiresAuth: false
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    }
    if (requestUrl === "http://upload.local/source.pdf") {
      return new Response("", { status: 200 })
    }
    if (requestUrl.endsWith("/document-ingest-runs")) {
      return new Response(JSON.stringify({ runId: "ingest-run-1", status: "queued" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    }
    return new Response(JSON.stringify({
      runId: "ingest-run-1",
      status: "succeeded",
      manifest: { fileName: "source.pdf", lifecycleStatus: "active", chunkCount: 1 }
    }), {
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

  assert.deepEqual(requests.map((request) => `${request.method} ${request.url}`), [
    "GET http://localhost:8787/documents",
    "POST http://localhost:8787/documents/uploads",
    "PUT http://upload.local/source.pdf",
    "POST http://localhost:8787/document-ingest-runs",
    "GET http://localhost:8787/document-ingest-runs/ingest-run-1"
  ])
  assert.equal((requests[1]?.body as { purpose?: string }).purpose, "benchmarkSeed")
  assert.deepEqual(Buffer.from(requests[2]?.body as Uint8Array), Buffer.from("%PDF-1.4 sample"))
  assert.equal((requests[2]?.body as Uint8Array).byteLength, Buffer.byteLength("%PDF-1.4 sample"))
  assert.equal(requests[2]?.contentLength, undefined)
  assert.equal(requests[2]?.contentType, "application/pdf")
  assert.equal(requests[2]?.host, undefined)
  assert.equal(requests[2]?.transferEncoding, undefined)
  const ingest = requests[3]?.body as { uploadId?: string; contentBase64?: string; fileName?: string; mimeType?: string; metadata?: { benchmarkSuiteId?: string } } | undefined
  assert.equal(ingest?.uploadId, "upload-1")
  assert.equal(ingest?.contentBase64, undefined)
  assert.equal(ingest?.fileName, "source.pdf")
  assert.equal(ingest?.mimeType, "application/pdf")
  assert.equal(ingest?.metadata?.benchmarkSuiteId, "allganize-rag-evaluation-ja-v1")
})

test("seedBenchmarkCorpus skips uploaded PDFs without extractable text", async () => {
  const corpusDir = await mkdtemp(path.join(os.tmpdir(), "benchmark-corpus-"))
  await writeFile(path.join(corpusDir, "image-only.pdf"), Buffer.from("%PDF-1.4 sample"))
  const logs: string[] = []
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const requestUrl = String(url)
    if (init?.method === "GET" && requestUrl.endsWith("/documents")) {
      return new Response(JSON.stringify({ documents: [] }), { status: 200, headers: { "Content-Type": "application/json" } })
    }
    if (requestUrl.endsWith("/documents/uploads")) {
      return new Response(JSON.stringify({
        uploadId: "upload-1",
        uploadUrl: "http://upload.local/image-only.pdf",
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        requiresAuth: false
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    }
    if (requestUrl === "http://upload.local/image-only.pdf") return new Response("", { status: 200 })
    if (requestUrl.endsWith("/document-ingest-runs")) {
      return new Response(JSON.stringify({ runId: "ingest-run-1", status: "queued" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    }
    return new Response(JSON.stringify({
      runId: "ingest-run-1",
      status: "failed",
      error: "Uploaded document did not contain extractable text"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  }

  const [result] = await seedBenchmarkCorpus({
    apiBaseUrl: "http://localhost:8787",
    corpusDir,
    suiteId: "allganize-rag-evaluation-ja-v1",
    skipMemory: true,
    fetchImpl,
    ingestRunPollIntervalMs: 0,
    log: (message) => logs.push(message)
  })

  assert.equal(result?.fileName, "image-only.pdf")
  assert.equal(result?.status, "skipped_unextractable")
  assert.equal(result?.chunkCount, 0)
  assert.equal(result?.skipReason, "no_extractable_text")
  assert.equal(logs.some((message) => message.includes("Benchmark corpus skipped: image-only.pdf")), true)
})

test("seedBenchmarkCorpus skips uploaded PDFs when OCR fallback times out", async () => {
  const corpusDir = await mkdtemp(path.join(os.tmpdir(), "benchmark-corpus-"))
  await writeFile(path.join(corpusDir, "slow-ocr.pdf"), Buffer.from("%PDF-1.4 sample"))
  const logs: string[] = []
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const requestUrl = String(url)
    if (init?.method === "GET" && requestUrl.endsWith("/documents")) {
      return new Response(JSON.stringify({ documents: [] }), { status: 200, headers: { "Content-Type": "application/json" } })
    }
    if (requestUrl.endsWith("/documents/uploads")) {
      return new Response(JSON.stringify({
        uploadId: "upload-1",
        uploadUrl: "http://upload.local/slow-ocr.pdf",
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        requiresAuth: false
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    }
    if (requestUrl === "http://upload.local/slow-ocr.pdf") return new Response("", { status: 200 })
    if (requestUrl.endsWith("/document-ingest-runs")) {
      return new Response(JSON.stringify({ runId: "ingest-run-1", status: "queued" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    }
    return new Response(JSON.stringify({
      runId: "ingest-run-1",
      status: "failed",
      error: "PDF OCR fallback failed for slow-ocr.pdf: Textract job did not finish within 45000ms"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  }

  const [result] = await seedBenchmarkCorpus({
    apiBaseUrl: "http://localhost:8787",
    corpusDir,
    suiteId: "mmrag-docqa-v1",
    skipMemory: true,
    fetchImpl,
    ingestRunPollIntervalMs: 0,
    log: (message) => logs.push(message)
  })

  assert.equal(result?.fileName, "slow-ocr.pdf")
  assert.equal(result?.status, "skipped_unextractable")
  assert.equal(result?.chunkCount, 0)
  assert.equal(result?.skipReason, "ocr_timeout")
  assert.equal(logs.some((message) => message.includes("Benchmark corpus skipped: slow-ocr.pdf (ocr_timeout)")), true)
})

test("seedBenchmarkCorpus still fails on non-extractability ingest errors", async () => {
  const corpusDir = await mkdtemp(path.join(os.tmpdir(), "benchmark-corpus-"))
  await writeFile(path.join(corpusDir, "source.pdf"), Buffer.from("%PDF-1.4 sample"))
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const requestUrl = String(url)
    if (init?.method === "GET" && requestUrl.endsWith("/documents")) {
      return new Response(JSON.stringify({ documents: [] }), { status: 200, headers: { "Content-Type": "application/json" } })
    }
    if (requestUrl.endsWith("/documents/uploads")) {
      return new Response(JSON.stringify({
        uploadId: "upload-1",
        uploadUrl: "http://upload.local/source.pdf",
        method: "PUT"
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    }
    if (requestUrl === "http://upload.local/source.pdf") return new Response("", { status: 200 })
    if (requestUrl.endsWith("/document-ingest-runs")) {
      return new Response(JSON.stringify({ runId: "ingest-run-1", status: "queued" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    }
    return new Response(JSON.stringify({
      runId: "ingest-run-1",
      status: "failed",
      error: "temporary ingest failure"
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  }

  await assert.rejects(
    () => seedBenchmarkCorpus({
      apiBaseUrl: "http://localhost:8787",
      corpusDir,
      suiteId: "allganize-rag-evaluation-ja-v1",
      skipMemory: true,
      fetchImpl
    }),
    /Benchmark corpus ingest run ingest-run-1 failed for source\.pdf: temporary ingest failure/
  )
})

test("seedBenchmarkCorpus includes optional per-file search aliases in seed metadata", async () => {
  const corpusDir = await mkdtemp(path.join(os.tmpdir(), "benchmark-corpus-"))
  await writeFile(path.join(corpusDir, "handbook.md"), "# Handbook\n\n経費精算は30日以内です。\n", "utf-8")
  await writeFile(path.join(corpusDir, "handbook.md.metadata.json"), JSON.stringify({
    searchAliases: {
      "立替": ["経費精算"],
      empty: []
    }
  }), "utf-8")
  const requests: Array<{ body?: unknown }> = []
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    requests.push({ body })
    if (init?.method === "GET") {
      return new Response(JSON.stringify({ documents: [] }), { status: 200, headers: { "Content-Type": "application/json" } })
    }
    return new Response(JSON.stringify({ fileName: "handbook.md", lifecycleStatus: "active", chunkCount: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  }

  await seedBenchmarkCorpus({
    apiBaseUrl: "http://localhost:8787",
    corpusDir,
    suiteId: "standard-agent-v1",
    skipMemory: true,
    fetchImpl
  })

  const upload = requests.at(-1)?.body as { metadata?: { searchAliases?: Record<string, string[]>; benchmarkIngestSignature?: string } }
  assert.deepEqual(upload.metadata?.searchAliases, { "立替": ["経費精算"] })
  assert.equal(typeof upload.metadata?.benchmarkIngestSignature, "string")
})
