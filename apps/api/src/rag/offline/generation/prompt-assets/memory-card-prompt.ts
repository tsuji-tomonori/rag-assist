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
