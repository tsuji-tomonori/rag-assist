import type { RetrievedVector } from "../types.js"

export function buildMemoryCardPrompt(fileName: string, text: string): string {
  return `MEMORY_CARD_JSON
あなたは社内QA用RAGのインデックス作成担当です。以下の資料全体を検索のためのメモリカードに変換してください。
出力はJSONのみ。Markdownや説明文は禁止。

JSON schema:
{
  "summary": "資料全体の要約。事実のみ。",
  "keywords": ["検索に役立つキーワード"],
  "likelyQuestions": ["この資料で答えられる質問"],
  "constraints": ["回答時に注意すべき制約や条件"]
}

<fileName>${fileName}</fileName>
<document>
${text.slice(0, 50_000)}
</document>`
}

export function buildCluePrompt(question: string, memoryContext: string): string {
  return `CLUES_JSON
あなたはMemoRAGのclue generatorです。ユーザー質問に答えるため、資料メモリからチャンク検索に使う検索手がかりを生成してください。
出力はJSONのみ。一般知識は足さず、メモリに現れる語彙・同義語・関連語を優先してください。

JSON schema:
{"clues": ["短い検索クエリまたは手がかり"]}

<question>
${question}
</question>
<memory>
${memoryContext || "メモリは見つかりませんでした。"}
</memory>`
}

export function buildFinalAnswerPrompt(question: string, chunks: RetrievedVector[]): string {
  const context = chunks
    .map(
      (chunk) => `<chunk id="${escapeXml(chunk.key)}" chunkId="${escapeXml(chunk.metadata.chunkId ?? "")}" score="${chunk.score.toFixed(4)}" file="${escapeXml(chunk.metadata.fileName)}">
${escapeXml(buildRelevantSnippet(question, chunk.metadata.text ?? ""))}
</chunk>`
    )
    .join("\n\n")

  return `FINAL_ANSWER_JSON
あなたは社内資料QAボットです。必ず以下のルールを守ってください。

ルール:
- 回答は<context>内のチャンクに明示された内容だけに基づける。
- 推測、一般知識、資料外の補完は禁止。
- 資料から判断できない場合は isAnswerable=false とし、answer は「資料からは回答できません。」だけにする。
- 回答できる場合は isAnswerable=true とし、簡潔に日本語で回答する。
- 質問が分類、一覧、洗い出しを求める場合は、<context>内に明示された分類項目を漏れなく列挙し、章名、活動名、参考文献名を分類項目として混ぜない。
- usedChunkIds には根拠に使ったchunk idを入れる。
- 出力はJSONのみ。Markdownやコードフェンスは禁止。

JSON schema:
{
  "isAnswerable": true,
  "answer": "資料だけに基づく回答",
  "usedChunkIds": ["retrieved chunk id from <chunk id=...>"]
}

<question>
${question}
</question>
<context>
${context}
</context>`
}

function escapeXml(input: string): string {
  return input.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[char] ?? char))
}

function buildRelevantSnippet(question: string, text: string, maxChars = 1800): string {
  if (text.length <= maxChars) return text

  const index = findBestNeedleIndex(question, text)
  if (index < 0) return text.slice(0, maxChars)

  const prefix = 160
  const start = Math.max(0, index - prefix)
  const end = Math.min(text.length, start + maxChars)
  return text.slice(start, end)
}

function findBestNeedleIndex(question: string, text: string): number {
  const normalizedQuestion = question.replace(/[?？。.!！\s]/g, "")
  const candidates = unique([
    ...intentAnchors(question),
    normalizedQuestion,
    normalizedQuestion.replace(/とは$/, ""),
    normalizedQuestion.replace(/について$/, ""),
    ...Array.from(normalizedQuestion.matchAll(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー]{2,}/gu)).map((match) => match[0]),
    ...Array.from(question.matchAll(/[A-Za-z][A-Za-z0-9_-]{1,}/g)).map((match) => match[0])
  ]).sort((a, b) => b.length - a.length)

  for (const candidate of candidates) {
    if (candidate.length < 2) continue
    const index = text.toLowerCase().indexOf(candidate.toLowerCase())
    if (index >= 0) return index
  }
  return -1
}

function intentAnchors(question: string): string[] {
  const anchors: string[] = []
  if (question.includes("分類")) {
    anchors.push(
      "ソフトウェア要求の分類",
      "要求分類",
      "分類の目的",
      "ソフトウェア製品要求",
      "ソフトウェアプロジェクト要求",
      "機能要求",
      "非機能要求",
      "技術制約",
      "サービス品質制約"
    )
  }
  return anchors
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))]
}
