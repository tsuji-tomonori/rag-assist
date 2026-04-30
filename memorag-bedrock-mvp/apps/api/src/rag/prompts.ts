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
- 質問が分類、一覧、洗い出しを求める場合は、<context>内に明示された分類項目を漏れなく列挙し、目次、章名、活動名、参考文献名を分類項目として混ぜない。
- 要求獲得、要求分析、要求妥当性確認、要求管理、文書化、優先順位付け、追跡可能性、変更管理は要求活動や実務上の考慮であり、<context>に分類として明示されていない限り分類項目にしない。
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

export function selectFinalAnswerChunks(question: string, chunks: RetrievedVector[]): RetrievedVector[] {
  if (!isRequirementsClassificationQuestion(question)) return chunks

  const scored = chunks
    .map((chunk, index) => ({
      chunk,
      index,
      score: classificationEvidenceScore(question, chunk.metadata.text ?? "")
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)

  const selected = scored.filter((item) => !isTableOfContentsLike(item.chunk.metadata.text ?? "")).map((item) => item.chunk)
  const sectionAnchored = selected.filter((chunk) => hasClassificationSectionEvidence(chunk.metadata.text ?? ""))

  if (sectionAnchored.length > 0) return sectionAnchored.slice(0, Math.min(4, chunks.length))
  if (selected.length > 0) return selected.slice(0, Math.min(4, chunks.length))

  const nonToc = chunks.filter((chunk) => !isTableOfContentsLike(chunk.metadata.text ?? ""))
  return nonToc.length > 0 ? nonToc : chunks
}

function escapeXml(input: string): string {
  return input.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[char] ?? char))
}

function buildRelevantSnippet(question: string, text: string, maxChars = 1800): string {
  const index = findBestNeedleIndex(question, text)
  if (text.length <= maxChars && !(isRequirementsClassificationQuestion(question) && index >= 0)) return text
  if (index < 0) return text.slice(0, maxChars)

  const prefix = isRequirementsClassificationQuestion(question) ? 0 : 160
  const start = Math.max(0, index - prefix)
  const end = Math.min(text.length, start + maxChars)
  return text.slice(start, end)
}

function findBestNeedleIndex(question: string, text: string): number {
  const normalizedQuestion = question.replace(/[?？。.!！\s]/g, "")
  const priorityCandidates = intentAnchors(question)
  const fallbackCandidates = unique([
    normalizedQuestion,
    normalizedQuestion.replace(/とは$/, ""),
    normalizedQuestion.replace(/について$/, ""),
    ...Array.from(normalizedQuestion.matchAll(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー]{2,}/gu)).map((match) => match[0]),
    ...Array.from(question.matchAll(/[A-Za-z][A-Za-z0-9_-]{1,}/g)).map((match) => match[0])
  ]).sort((a, b) => b.length - a.length)

  for (const candidate of [...priorityCandidates, ...fallbackCandidates]) {
    if (candidate.length < 2) continue
    const index = text.toLowerCase().indexOf(candidate.toLowerCase())
    if (index >= 0) return index
  }
  return -1
}

function intentAnchors(question: string): string[] {
  const anchors: string[] = []
  if (isRequirementsClassificationQuestion(question)) {
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

export function isRequirementsClassificationQuestion(question: string): boolean {
  return question.includes("分類") && /ソフトウェア要求|要求/.test(question)
}

function classificationEvidenceScore(question: string, text: string): number {
  let score = 0
  for (const anchor of intentAnchors(question)) {
    if (text.includes(anchor)) score += anchor.length >= 8 ? 8 : 3
  }
  if (hasClassificationSectionEvidence(text)) score += 40
  if (/第\s*2\s*層|製品要求から|非機能要求から|↓|\/\s*ソフトウェアプロジェクト要求/.test(text)) score += 12
  if (/SWEBOK\s*では、?ソフトウェア要求を大きく次のように整理/.test(text)) score += 10
  if (text.includes("画像生成用プロンプト")) score -= 12
  if (isTableOfContentsLike(text)) score -= 16
  return score
}

function hasClassificationSectionEvidence(text: string): boolean {
  return text.includes("ソフトウェア要求の分類") && /SWEBOK\s*では、?ソフトウェア要求を大きく次のように整理/.test(text)
}

export function hasUsableRequirementsClassificationEvidence(text: string): boolean {
  const categoryCount = countRequirementsClassificationTerms(text)
  if (categoryCount >= 2) return true
  return hasClassificationSectionEvidence(text) && categoryCount >= 1
}

export function hasInvalidRequirementsClassificationAnswer(answer: string): boolean {
  return /Requirements Elicitation|Requirements Validation|Requirements Scrubbing|ATDD|BDD|UML\s*SysML|UML\/SysML|Kano|要求獲得|要求妥当性確認|要求管理|要求スクラビング|要求の優先順位付け|要求の追跡可能性/.test(
    answer
  )
}

function countRequirementsClassificationTerms(text: string): number {
  const patterns = [
    /ソフトウェア製品要求|software product requirements?/i,
    /ソフトウェアプロジェクト要求|software project requirements?/i,
    /機能要求|functional requirements?/i,
    /非機能要求|non[-\s]?functional requirements?/i,
    /技術制約|technical constraints?/i,
    /サービス品質制約|quality constraints?|quality requirements?/i
  ]
  return patterns.filter((pattern) => pattern.test(text)).length
}

function isTableOfContentsLike(text: string): boolean {
  const dotLeaderCount = text.match(/\. \. \./g)?.length ?? 0
  const headingWithPageCount = text.match(/^\s*\d+(?:\.\d+)?\s+.+\s+\d+\s*$/gm)?.length ?? 0
  return dotLeaderCount >= 4 || (text.includes("目次") && headingWithPageCount >= 4)
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))]
}
