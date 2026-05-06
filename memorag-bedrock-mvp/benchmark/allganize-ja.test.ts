import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { convertAllganizeRows, parseCsv, prepareAllganizeJaBenchmark } from "./allganize-ja.js"

test("parseCsv handles quoted commas and newlines", () => {
  const rows = parseCsv('question,target_answer,target_file_name,target_page_no,domain,type\n"火災,保険は？","1行目\n2行目",01.pdf,4,finance,paragraph\n')

  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.question, "火災,保険は？")
  assert.equal(rows[0]?.target_answer, "1行目\n2行目")
})

test("convertAllganizeRows maps Hugging Face columns to benchmark JSONL rows", () => {
  const [row] = convertAllganizeRows([
    {
      question: "法人企業景気予測調査の化学工業は？",
      target_answer: "化学工業はプラス9.5に上昇しました。",
      target_file_name: "1c202401.pdf",
      target_page_no: "1",
      domain: "finance",
      type: "image"
    }
  ])

  assert.equal(row?.id, "allganize-ja-001")
  assert.equal(row?.answerable, true)
  assert.equal(row?.referenceAnswer, "化学工業はプラス9.5に上昇しました。")
  assert.deepEqual(row?.expectedFiles, ["1c202401.pdf"])
  assert.deepEqual(row?.expectedPages, [1])
  assert.equal(row?.complexity, "comparison")
  assert.equal(row?.expectedAnswer, undefined)
})

test("convertAllganizeRows can create strict expectedContains rows", () => {
  const [row] = convertAllganizeRows([
    {
      question: "Q",
      target_answer: "A",
      target_file_name: "doc.pdf",
      target_page_no: "2",
      domain: "it",
      type: "paragraph"
    }
  ], { expectedMode: "strict-contains" })

  assert.equal(row?.expectedAnswer, "A")
  assert.deepEqual(row?.expectedContains, ["A"])
})

test("prepareAllganizeJaBenchmark falls back to the archived FILP Report 2022 PDF", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "allganize-ja-"))
  const datasetCsvPath = path.join(tempDir, "dataset.csv")
  const documentsCsvPath = path.join(tempDir, "documents.csv")
  const datasetOutput = path.join(tempDir, "dataset.jsonl")
  const corpusDir = path.join(tempDir, "corpus")
  const staleUrl = "https://www.mof.go.jp/policy/filp/publication/filp_report/zaito2022/FILP_Report2022.pdf"
  const fallbackUrl = "https://warp.ndl.go.jp/20260305/20260303041739/https://www.mof.go.jp/policy/filp/publication/filp_report/zaito2022/FILP_Report2022.pdf"
  const requestedUrls: string[] = []
  const originalFetch = globalThis.fetch

  await writeFile(
    datasetCsvPath,
    "question,target_answer,target_file_name,target_page_no,domain,type\nQ,A,FILP_Report2022.pdf,58,finance,paragraph\n",
    "utf-8"
  )
  await writeFile(
    documentsCsvPath,
    `domain,title,page,url,file_name,publisher\nfinance,財政投融資リポート 2022,58,${staleUrl},FILP_Report2022.pdf,財務省\n`,
    "utf-8"
  )

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : input.toString()
    requestedUrls.push(url)
    if (url === staleUrl) return new Response("not found", { status: 404 })
    if (url === fallbackUrl) return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), { status: 200 })
    return new Response("unexpected", { status: 500 })
  }) as typeof fetch

  try {
    await prepareAllganizeJaBenchmark({
      ALLGANIZE_RAG_EVAL_CSV_PATH: datasetCsvPath,
      ALLGANIZE_RAG_DOCUMENTS_CSV_PATH: documentsCsvPath,
      ALLGANIZE_RAG_DATASET_OUTPUT: datasetOutput,
      ALLGANIZE_RAG_CORPUS_DIR: corpusDir
    })

    assert.deepEqual(requestedUrls, [staleUrl, fallbackUrl])
    assert.deepEqual(
      await readFile(path.join(corpusDir, "FILP_Report2022.pdf")),
      Buffer.from([0x25, 0x50, 0x44, 0x46])
    )
  } finally {
    globalThis.fetch = originalFetch
    await rm(tempDir, { force: true, recursive: true })
  }
})

test("prepareAllganizeJaBenchmark resolves the latest WARP archive for stale document URLs", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "allganize-ja-"))
  const datasetCsvPath = path.join(tempDir, "dataset.csv")
  const documentsCsvPath = path.join(tempDir, "documents.csv")
  const datasetOutput = path.join(tempDir, "dataset.jsonl")
  const corpusDir = path.join(tempDir, "corpus")
  const staleUrl = "https://example.go.jp/stale.pdf"
  const warpLookupUrl = `https://warp.ndl.go.jp/web/latest/${staleUrl}`
  const archivedPath = "/20260506/20260506000000/https://example.go.jp/stale.pdf"
  const archivedUrl = `https://warp.ndl.go.jp${archivedPath}`
  const requestedUrls: string[] = []
  const originalFetch = globalThis.fetch

  await writeFile(
    datasetCsvPath,
    "question,target_answer,target_file_name,target_page_no,domain,type\nQ,A,stale.pdf,1,public,paragraph\n",
    "utf-8"
  )
  await writeFile(
    documentsCsvPath,
    `domain,title,page,url,file_name,publisher\npublic,stale,1,${staleUrl},stale.pdf,example\n`,
    "utf-8"
  )

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : input.toString()
    requestedUrls.push(url)
    if (url === staleUrl) return new Response("not found", { status: 404 })
    if (url === warpLookupUrl) {
      return new Response(`<iframe src="${archivedPath}"></iframe>`, { status: 200 })
    }
    if (url === archivedUrl) return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), { status: 200 })
    return new Response("unexpected", { status: 500 })
  }) as typeof fetch

  try {
    await prepareAllganizeJaBenchmark({
      ALLGANIZE_RAG_EVAL_CSV_PATH: datasetCsvPath,
      ALLGANIZE_RAG_DOCUMENTS_CSV_PATH: documentsCsvPath,
      ALLGANIZE_RAG_DATASET_OUTPUT: datasetOutput,
      ALLGANIZE_RAG_CORPUS_DIR: corpusDir
    })

    assert.deepEqual(requestedUrls, [staleUrl, warpLookupUrl, archivedUrl])
    assert.deepEqual(await readFile(path.join(corpusDir, "stale.pdf")), Buffer.from([0x25, 0x50, 0x44, 0x46]))
  } finally {
    globalThis.fetch = originalFetch
    await rm(tempDir, { force: true, recursive: true })
  }
})
