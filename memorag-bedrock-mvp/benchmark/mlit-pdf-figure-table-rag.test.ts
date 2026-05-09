import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { parseSourceDocs, prepareMlitPdfFigureTableRagBenchmark } from "./mlit-pdf-figure-table-rag.js"

const pdfBody = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])

test("parseSourceDocs maps MLIT source docs CSV rows", () => {
  const rows = parseSourceDocs("source_doc_id,title_ja,publisher,source_url,topic,benchmark_use,notes\nMLIT-1,資料,国交省,https://example.go.jp/a.pdf,topic,use,note\n")

  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.source_doc_id, "MLIT-1")
  assert.equal(rows[0]?.source_url, "https://example.go.jp/a.pdf")
})

test("prepareMlitPdfFigureTableRagBenchmark copies dataset and downloads PDFs from source_docs", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mlit-pdf-rag-"))
  const datasetSource = path.join(tempDir, "qa.jsonl")
  const sourceDocsPath = path.join(tempDir, "source_docs.csv")
  const datasetOutput = path.join(tempDir, "out", "dataset.jsonl")
  const corpusDir = path.join(tempDir, "corpus")
  const requestedUrls: string[] = []

  await writeFile(datasetSource, "{\"id\":\"q1\"}\n", "utf-8")
  await writeFile(
    sourceDocsPath,
    [
      "source_doc_id,title_ja,publisher,source_url,topic,benchmark_use,notes",
      "MLIT-A,資料A,国交省,https://example.go.jp/a.pdf,topic,use,note",
      "MLIT-B,資料B,国交省,https://example.go.jp/b.pdf,topic,use,note"
    ].join("\n") + "\n",
    "utf-8"
  )

  const fetchImpl = (async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : input.toString()
    requestedUrls.push(url)
    return new Response(pdfBody, { status: 200 })
  }) as typeof fetch

  try {
    const prepared = await prepareMlitPdfFigureTableRagBenchmark({
      MLIT_PDF_RAG_DATASET_SOURCE: datasetSource,
      MLIT_PDF_RAG_SOURCE_DOCS_PATH: sourceDocsPath,
      MLIT_PDF_RAG_DATASET_OUTPUT: datasetOutput,
      MLIT_PDF_RAG_CORPUS_DIR: corpusDir
    }, fetchImpl)

    assert.deepEqual(requestedUrls, ["https://example.go.jp/a.pdf", "https://example.go.jp/b.pdf"])
    assert.equal(await readFile(datasetOutput, "utf-8"), "{\"id\":\"q1\"}\n")
    assert.deepEqual(await readFile(path.join(corpusDir, "MLIT-A.pdf")), Buffer.from(pdfBody))
    assert.deepEqual(await readFile(path.join(corpusDir, "MLIT-B.pdf")), Buffer.from(pdfBody))
    assert.equal(prepared.documents.length, 2)
    assert.equal(prepared.documents.every((doc) => !doc.skipped), true)
  } finally {
    await rm(tempDir, { force: true, recursive: true })
  }
})

test("prepareMlitPdfFigureTableRagBenchmark skips existing PDFs unless force is enabled", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mlit-pdf-rag-"))
  const datasetSource = path.join(tempDir, "qa.jsonl")
  const sourceDocsPath = path.join(tempDir, "source_docs.csv")
  const datasetOutput = path.join(tempDir, "out", "dataset.jsonl")
  const corpusDir = path.join(tempDir, "corpus")
  const requestedUrls: string[] = []

  await writeFile(datasetSource, "{\"id\":\"q1\"}\n", "utf-8")
  await writeFile(sourceDocsPath, "source_doc_id,title_ja,publisher,source_url,topic,benchmark_use,notes\nMLIT-A,資料A,国交省,https://example.go.jp/a.pdf,topic,use,note\n", "utf-8")
  await mkdir(corpusDir, { recursive: true })
  await writeFile(path.join(corpusDir, "MLIT-A.pdf"), Buffer.from(pdfBody))

  const fetchImpl = (async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : input.toString()
    requestedUrls.push(url)
    return new Response(pdfBody, { status: 200 })
  }) as typeof fetch

  try {
    const skipped = await prepareMlitPdfFigureTableRagBenchmark({
      MLIT_PDF_RAG_DATASET_SOURCE: datasetSource,
      MLIT_PDF_RAG_SOURCE_DOCS_PATH: sourceDocsPath,
      MLIT_PDF_RAG_DATASET_OUTPUT: datasetOutput,
      MLIT_PDF_RAG_CORPUS_DIR: corpusDir
    }, fetchImpl)
    assert.deepEqual(requestedUrls, [])
    assert.equal(skipped.documents[0]?.skipped, true)

    const forced = await prepareMlitPdfFigureTableRagBenchmark({
      MLIT_PDF_RAG_DATASET_SOURCE: datasetSource,
      MLIT_PDF_RAG_SOURCE_DOCS_PATH: sourceDocsPath,
      MLIT_PDF_RAG_DATASET_OUTPUT: datasetOutput,
      MLIT_PDF_RAG_CORPUS_DIR: corpusDir,
      MLIT_PDF_RAG_FORCE_DOWNLOAD: "1"
    }, fetchImpl)
    assert.deepEqual(requestedUrls, ["https://example.go.jp/a.pdf"])
    assert.equal(forced.documents[0]?.skipped, false)
  } finally {
    await rm(tempDir, { force: true, recursive: true })
  }
})

test("prepareMlitPdfFigureTableRagBenchmark rejects non-PDF responses", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "mlit-pdf-rag-"))
  const datasetSource = path.join(tempDir, "qa.jsonl")
  const sourceDocsPath = path.join(tempDir, "source_docs.csv")

  await writeFile(datasetSource, "{\"id\":\"q1\"}\n", "utf-8")
  await writeFile(sourceDocsPath, "source_doc_id,title_ja,publisher,source_url,topic,benchmark_use,notes\nMLIT-A,資料A,国交省,https://example.go.jp/a.pdf,topic,use,note\n", "utf-8")

  const fetchImpl = (async () => new Response("html", { status: 200 })) as typeof fetch

  try {
    await assert.rejects(
      () => prepareMlitPdfFigureTableRagBenchmark({
        MLIT_PDF_RAG_DATASET_SOURCE: datasetSource,
        MLIT_PDF_RAG_SOURCE_DOCS_PATH: sourceDocsPath,
        MLIT_PDF_RAG_DATASET_OUTPUT: path.join(tempDir, "out", "dataset.jsonl"),
        MLIT_PDF_RAG_CORPUS_DIR: path.join(tempDir, "corpus")
      }, fetchImpl),
      /not a PDF/
    )
  } finally {
    await rm(tempDir, { force: true, recursive: true })
  }
})
