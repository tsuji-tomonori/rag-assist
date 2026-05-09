import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { existsSync, mkdtempSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  createPdfFromJpegs,
  prepareJpPublicPdfQaBenchmarkWithOptions
} from "./jp-public-pdf-qa.js"

type DatasetRow = {
  id: string
  question: string
  answerable: boolean
  expectedResponseType: string
  referenceAnswer: string
  expectedAnswer: string
  expectedContains: string[]
  expectedFiles: string[]
  complexity: string
  metadata: {
    sourceDataset: string
    sourceWorkbook: string
    sourceQaId: string
    sourceDocId: string
    domain: string
    extractionClass: string
    questionType: string
    difficulty: number
    evidenceLocator: string
    sourceUrl: string
    retrievalChallenge: string
    scoringNotes: string
    document: {
      id: string
      title: string
      selection: string
      extractionClass: string
      publicationShape: string
      pageScale: string
      sourceUrl: string
    }
  }
}

type SummaryArtifact = {
  total: number
  failedHttp: number
  failures: Array<{ id?: string; reasons: string[] }>
}

const benchmarkDir = path.dirname(fileURLToPath(import.meta.url))
const datasetPath = path.join(benchmarkDir, "dataset.jp-public-pdf-qa.jsonl")

test("jp public PDF QA dataset preserves workbook rows and document provenance", () => {
  const rows = readDataset()

  assert.equal(rows.length, 24)
  assert.deepEqual(countBy(rows, (row) => row.metadata.domain), {
    "統計行政史・公的統計": 8,
    "医療・診療報酬改定": 8,
    "歴史統計・表構造": 8
  })
  assert.deepEqual(countBy(rows, (row) => row.metadata.extractionClass), {
    text_extractable: 16,
    ocr_required: 8
  })

  for (const row of rows) {
    assert.match(row.id, /^jp-public-pdf-qa-(stat|mhlw|ocr)-\d{3}$/)
    assert.equal(typeof row.question, "string")
    assert.ok(row.question.length > 0)
    assert.equal(row.answerable, true)
    assert.equal(row.expectedResponseType, "answer")
    assert.ok(row.referenceAnswer.length > 0)
    assert.ok(row.expectedAnswer.length > 0)
    assert.ok(row.expectedContains.length > 0)
    assert.ok(row.expectedFiles.length > 0)
    assert.equal(row.metadata.sourceDataset, "jp-public-pdf-qa-rag-benchmark")
    assert.equal(row.metadata.sourceWorkbook, "jp_public_pdf_qarag_benchmark.xlsx")
    assert.match(row.metadata.sourceUrl, /^https:\/\//)
    assert.match(row.metadata.document.sourceUrl, /^https:\/\//)
    assert.ok(row.metadata.evidenceLocator.length > 0)
    assert.ok(row.metadata.retrievalChallenge.length > 0)
    assert.ok(row.metadata.scoringNotes.length > 0)
  }

  const ocrRows = rows.filter((row) => row.metadata.extractionClass === "ocr_required")
  assert.equal(ocrRows.length, 8)
  assert.ok(ocrRows.every((row) => row.expectedFiles[0] === "1927-statistical-yearbook-scan.pdf"))
  assert.ok(ocrRows.every((row) => row.metadata.document.publicationShape.includes("単一PDFではなく")))
  assert.ok(ocrRows.every((row) => row.metadata.document.pageScale.includes("772ページ")))
})

test("jp public PDF QA dataset is readable by the benchmark runner", async () => {
  const rowsById = new Map(readDataset().map((row) => [row.id, row]))
  const calls: Array<{ id?: string; question?: string }> = []
  const server = createServer((req, res) => {
    void handleBenchmarkQuery(req, res, rowsById, calls)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo | null
  assert.ok(address)

  const paths = artifactPaths("jp-public-pdf-qa")
  try {
    const result = await runBenchmarkRunner({
      API_BASE_URL: `http://127.0.0.1:${address.port}`,
      DATASET: datasetPath,
      OUTPUT: paths.output,
      SUMMARY: paths.summary,
      REPORT: paths.report
    })

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(calls.length, 24)

    const summary = JSON.parse(readFileSync(paths.summary, "utf-8")) as SummaryArtifact
    assert.equal(summary.total, 24)
    assert.equal(summary.failedHttp, 0)
    assert.deepEqual(summary.failures, [])
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test("jp public PDF QA prepare script copies the dataset and builds a local OCR PDF from source images", async () => {
  const paths = artifactPaths("jp-public-pdf-qa-prepare")
  const corpusDir = path.join(paths.dir, "corpus")
  const fetchedUrls: string[] = []
  const pdfBody = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "latin1")
  const jpegBody = sampleJpeg(320, 240)

  await prepareJpPublicPdfQaBenchmarkWithOptions({
    datasetOutput: path.join(paths.dir, "dataset.jsonl"),
    corpusDir,
    forceDownload: true,
    downloadDocuments: true,
    fetchImpl: (async (url: string | URL | Request) => {
      const href = String(url)
      fetchedUrls.push(href)
      if (href.endsWith(".pdf")) return binaryResponse(pdfBody, 200)
      if (href.endsWith(".jpg")) return binaryResponse(jpegBody, 200)
      return binaryResponse(Buffer.from("not found"), 404)
    }) as typeof fetch
  })

  assert.equal(readFileSync(path.join(paths.dir, "dataset.jsonl"), "utf-8"), readFileSync(datasetPath, "utf-8"))
  assert.ok(existsSync(path.join(corpusDir, "001655176.pdf")))
  assert.ok(existsSync(path.join(corpusDir, "01zyokan_202603.pdf")))

  const ocrPdf = readFileSync(path.join(corpusDir, "1927-statistical-yearbook-scan.pdf"))
  assert.equal(ocrPdf.subarray(0, 5).toString("ascii"), "%PDF-")
  assert.match(ocrPdf.toString("latin1"), /\/Count 26/)
  assert.match(ocrPdf.toString("latin1"), /\/DCTDecode/)
  assert.equal(fetchedUrls.filter((url) => url.endsWith(".pdf")).length, 2)
  assert.equal(fetchedUrls.filter((url) => url.endsWith(".jpg")).length, 26)
})

test("jp public PDF QA prepare script reports the failed source URL", async () => {
  const paths = artifactPaths("jp-public-pdf-qa-prepare-failure")

  await assert.rejects(
    prepareJpPublicPdfQaBenchmarkWithOptions({
      datasetOutput: path.join(paths.dir, "dataset.jsonl"),
      corpusDir: path.join(paths.dir, "corpus"),
      forceDownload: true,
      downloadDocuments: true,
      fetchImpl: (async (url: string | URL | Request) => {
        const href = String(url)
        if (href.includes("mhlw.go.jp")) return binaryResponse(Buffer.from("missing"), 404)
        return binaryResponse(Buffer.from("%PDF-1.4\n%%EOF\n", "latin1"), 200)
      }) as typeof fetch
    }),
    /001655176\.pdf.*mhlw\.go\.jp.*HTTP 404/
  )
})

test("OCR JPEG PDF builder keeps the page tree object and image objects distinct", () => {
  const pdf = createPdfFromJpegs([
    { body: sampleJpeg(10, 20), width: 10, height: 20 },
    { body: sampleJpeg(30, 40), width: 30, height: 40 }
  ]).toString("latin1")

  assert.match(pdf, /1 0 obj\n<< \/Type \/Catalog \/Pages 2 0 R >>/)
  assert.match(pdf, /2 0 obj\n<< \/Type \/Pages \/Count 2 \/Kids \[5 0 R 8 0 R\] >>/)
  assert.match(pdf, /3 0 obj\n<< \/Type \/XObject \/Subtype \/Image \/Width 10 \/Height 20/)
  assert.match(pdf, /6 0 obj\n<< \/Type \/XObject \/Subtype \/Image \/Width 30 \/Height 40/)
})

function readDataset(): DatasetRow[] {
  return readFileSync(datasetPath, "utf-8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as DatasetRow)
}

function countBy(rows: DatasetRow[], keyOf: (row: DatasetRow) => string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) counts[keyOf(row)] = (counts[keyOf(row)] ?? 0) + 1
  return counts
}

function artifactPaths(name: string): { dir: string; output: string; summary: string; report: string } {
  const dir = mkdtempSync(path.join(tmpdir(), `memorag-run-${name}-`))
  return {
    dir,
    output: path.join(dir, "results.jsonl"),
    summary: path.join(dir, "summary.json"),
    report: path.join(dir, "report.md")
  }
}

function binaryResponse(body: Buffer, status: number): Response {
  const arrayBuffer = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer
  return new Response(arrayBuffer, {
    status,
    statusText: status === 200 ? "OK" : "Not Found"
  })
}

function sampleJpeg(width: number, height: number): Buffer {
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, (height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff, width & 0xff, 0x03,
    0x01, 0x11, 0x00,
    0x02, 0x11, 0x01,
    0x03, 0x11, 0x01,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    0xff, 0xd9
  ])
}

function runBenchmarkRunner(env: Record<string, string>): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "run.ts"], {
      cwd: benchmarkDir,
      env: {
        ...process.env,
        ...env
      },
      stdio: ["ignore", "pipe", "pipe"]
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)))
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)))
    child.on("error", reject)
    child.on("close", (status) => {
      resolve({
        status,
        stdout: Buffer.concat(stdout).toString("utf-8"),
        stderr: Buffer.concat(stderr).toString("utf-8")
      })
    })
  })
}

async function handleBenchmarkQuery(
  req: IncomingMessage,
  res: ServerResponse,
  rowsById: Map<string, DatasetRow>,
  calls: Array<{ id?: string; question?: string }>
): Promise<void> {
  const body = await readRequestBody(req)
  calls.push(body)
  res.setHeader("content-type", "application/json")

  if (req.method !== "POST" || req.url !== "/benchmark/query" || !body.id) {
    res.statusCode = 404
    res.end(JSON.stringify({ error: "not found" }))
    return
  }

  const row = rowsById.get(body.id)
  if (!row) {
    res.statusCode = 400
    res.end(JSON.stringify({ error: `unknown id: ${body.id}` }))
    return
  }

  const fileName = row.expectedFiles[0]
  const answer = row.expectedContains.join("。")
  res.end(JSON.stringify({
    id: row.id,
    responseType: "answer",
    isAnswerable: true,
    answer,
    citations: [{ fileName, text: answer, score: 0.95 }],
    retrieved: [{ fileName, text: answer, score: 0.95 }],
    finalEvidence: [{ fileName, text: answer, score: 0.95 }],
    answerSupport: { unsupportedSentences: [], totalSentences: 1 }
  }))
}

function readRequestBody(req: IncomingMessage): Promise<{ id?: string; question?: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
    req.on("error", reject)
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf-8")
      resolve(text ? (JSON.parse(text) as { id?: string; question?: string }) : {})
    })
  })
}
