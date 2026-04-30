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
      (chunk) => `<chunk id="${chunk.metadata.chunkId ?? chunk.key}" score="${chunk.score.toFixed(4)}" file="${escapeXml(chunk.metadata.fileName)}">
${chunk.metadata.text ?? ""}
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
- usedChunkIds には根拠に使ったchunk idを入れる。
- 出力はJSONのみ。Markdownやコードフェンスは禁止。

JSON schema:
{
  "isAnswerable": true,
  "answer": "資料だけに基づく回答",
  "usedChunkIds": ["chunk-0000"]
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
