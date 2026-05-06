import assert from "node:assert/strict"
import test from "node:test"
import { convertAllganizeRows, parseCsv } from "./allganize-ja.js"

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
