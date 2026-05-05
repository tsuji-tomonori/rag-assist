import type { RetrievedVector } from "../types.js"
import type { ComputedFact, TemporalContext } from "../agent/state.js"
import { assembleContext, formatContextXml } from "./context-assembler.js"

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

export function buildFinalAnswerPrompt(question: string, chunks: RetrievedVector[], computedFacts: ComputedFact[] = [], temporalContext?: TemporalContext): string {
  const assembly = assembleContext({ question, chunks, tokenBudget: 3000 })
  const context = formatContextXml(assembly)
  const computedFactsJson = JSON.stringify(computedFacts, null, 2)
  const temporalContextJson = JSON.stringify(temporalContext ?? null, null, 2)

  return `FINAL_ANSWER_JSON
あなたは社内資料QAボットです。必ず以下のルールを守ってください。

ルール:
 - 回答は<context>内のチャンク、または<computedFacts>に明示された内容だけに基づける。
 - 文書由来の事実は<context>を根拠にし、計算由来の事実は<computedFacts>を根拠にする。
- 日付計算、期限切れ判定、残日数、超過日数は<computedFacts>の値をそのまま使用する。
- 金額、割合、合計、差分、閾値条件への該当可否は<computedFacts>の値をそのまま使用する。
- 自分で日数計算や数値計算を再実行してはいけない。
- computedFacts に必要な値がない場合は、推測で補完せず、計算できない理由を説明する。
- threshold_comparison がある場合は、polarity、satisfiesCondition、explanation に基づいて、質問された金額が資料内条件に該当するかを答える。polarity=not_required かつ satisfiesCondition=true の場合は「不要」として扱い、「必要」と言い換えない。
- computedFacts は system-derived evidence として扱い、文書 citation と混同しない。
- 推測、一般知識、資料外の補完は禁止。
- <context>と<computedFacts>のどちらからも判断できない場合は isAnswerable=false とし、answer は「資料からは回答できません。」だけにする。
- 回答できる場合は isAnswerable=true とし、簡潔に日本語で回答する。
- 質問が分類、一覧、洗い出しを求める場合は、<context>内に明示された分類項目を漏れなく列挙し、目次、章名、活動名、参考文献名を分類項目として混ぜない。
- 要求獲得、要求分析、要求妥当性確認、要求管理、文書化、優先順位付け、追跡可能性、変更管理は要求活動や実務上の考慮であり、<context>に分類として明示されていない限り分類項目にしない。
- usedChunkIds には根拠に使ったchunk idを入れる。
- usedComputedFactIds には根拠に使った computed fact id を入れる。
- 出力はJSONのみ。Markdownやコードフェンスは禁止。

JSON schema:
{
  "isAnswerable": true,
  "answer": "資料だけに基づく回答",
  "usedChunkIds": ["retrieved chunk id from <chunk id=...>"],
  "usedComputedFactIds": ["computed fact id from <computedFacts>"]
}

<question>
${question}
</question>
<temporalContext>
${escapeXml(temporalContextJson)}
</temporalContext>
<computedFacts>
${escapeXml(computedFactsJson)}
</computedFacts>
<context>
${context}
</context>`
}

export function buildSufficientContextPrompt(question: string, requiredFacts: string[], chunks: RetrievedVector[], computedFacts: ComputedFact[] = []): string {
  const facts = requiredFacts.length > 0 ? requiredFacts.map((fact, index) => `${index + 1}. ${fact}`).join("\n") : `1. ${question}`
  const assembly = assembleContext({ question, chunks, requiredFacts, tokenBudget: 3000 })
  const context = formatContextXml(assembly)
  const computedFactsJson = JSON.stringify(computedFacts, null, 2)

  return `SUFFICIENT_CONTEXT_JSON
あなたは社内QA用RAGの回答可否判定器です。質問に対して、<context>内のevidence chunkと<computedFacts>だけで回答してよいかを厳密に判定してください。
出力はJSONのみ。Markdownや説明文は禁止。

判定ルール:
- ANSWERABLE: 高優先度の必要事実がすべて evidence chunk または computedFacts で明示的に支持されている。
- PARTIAL: 一部の必要事実は支持されるが、回答に必要な事実が不足している。
- UNANSWERABLE: 関連チャンクがない、根拠が質問に答えていない、または矛盾がある。
- memory card、一般知識、推測は根拠にしない。
- 数値、期限、手順、条件、承認者は特に厳しく見る。
- threshold_comparison は system-derived evidence として扱い、polarity と satisfiesCondition の組み合わせで、質問金額が資料内の必要条件または不要条件に該当するかを支持できる。
- supportingChunkIds には根拠に使える <chunk id="..."> の id だけを入れる。

JSON schema:
{
  "label": "ANSWERABLE | PARTIAL | UNANSWERABLE",
  "confidence": 0.0,
  "requiredFacts": ["回答に必要な事実"],
  "supportedFacts": ["根拠付きで確認できた事実"],
  "missingFacts": ["不足している事実"],
  "conflictingFacts": ["矛盾している事実"],
  "supportingChunkIds": ["retrieved chunk id from <chunk id=...>"],
  "reason": "判定理由"
}

<question>
${question}
</question>
<requiredFacts>
${escapeXml(facts)}
</requiredFacts>
<computedFacts>
${escapeXml(computedFactsJson)}
</computedFacts>
<context>
${context || "根拠チャンクはありません。"}
</context>`
}

export function buildAnswerSupportPrompt(question: string, answer: string, chunks: RetrievedVector[], computedFacts: ComputedFact[] = []): string {
  const assembly = assembleContext({ question, chunks, tokenBudget: 2400 })
  const context = formatContextXml(assembly)
  const computedFactsJson = JSON.stringify(computedFacts, null, 2)

  return `ANSWER_SUPPORT_JSON
あなたは社内QA用RAGの回答支持検証器です。<answer>の各文が<context>内のevidence chunkまたは<computedFacts>で明示的に支持されるかを厳密に判定してください。
出力はJSONのみ。Markdownや説明文は禁止。

判定ルール:
- supportingChunkIds と contradictionChunkIds には <chunk id="..."> の id だけを入れる。
- supportingComputedFactIds には <computedFacts> の id だけを入れる。
- memory card、一般知識、推測、質問文そのものは根拠にしない。
- 数値、期限、残日数、超過日数、手順、条件、承認者、例外条件は特に厳しく見る。
- 計算結果や閾値条件への該当可否の主張は、文書チャンクではなく computedFacts に対応する値がある場合に支持されたものとして扱う。
- 引用チャンクに書かれていない断定文、範囲外の要約、過度な一般化は unsupportedSentences に入れる。
- すべての実質的な回答文が evidence chunk または computedFacts で支持される場合だけ supported=true にする。

JSON schema:
{
  "supported": true,
  "unsupportedSentences": [{"sentence": "根拠で支持されない回答文", "reason": "不支持理由"}],
  "supportingChunkIds": ["retrieved chunk id from <chunk id=...>"],
  "supportingComputedFactIds": ["computed fact id from <computedFacts>"],
  "contradictionChunkIds": ["retrieved chunk id from <chunk id=...>"],
  "confidence": 0.0,
  "totalSentences": 0,
  "reason": "判定理由"
}

<question>
${question}
</question>
<answer>
${escapeXml(answer)}
</answer>
<computedFacts>
${escapeXml(computedFactsJson)}
</computedFacts>
<context>
${context || "根拠チャンクはありません。"}
</context>`
}

export function buildSupportedAnswerRepairPrompt(
  question: string,
  answer: string,
  unsupportedSentences: Array<{ sentence: string; reason: string }>,
  chunks: RetrievedVector[]
): string {
  const assembly = assembleContext({ question, chunks, tokenBudget: 2400 })
  const context = formatContextXml(assembly)
  const unsupported = unsupportedSentences.map((item) => `- ${item.sentence}\n  reason=${item.reason}`).join("\n")

  return `SUPPORTED_ONLY_ANSWER_JSON
あなたは社内資料QAボットの回答修復器です。<answer>から、<context>内の evidence chunk で明示的に支持されない文を除去し、支持される事実だけで短く再回答してください。
出力はJSONのみ。Markdownや説明文は禁止。

ルール:
- <unsupportedSentences> の文や同等の主張は残さない。
- <context>に明示された事実だけを使う。
- 修復後に回答できる事実が残らない場合は isAnswerable=false とし、answer は「資料からは回答できません。」だけにする。
- usedChunkIds には根拠に使った <chunk id="..."> の id だけを入れる。

JSON schema:
{
  "isAnswerable": true,
  "answer": "支持された事実だけの回答",
  "usedChunkIds": ["retrieved chunk id from <chunk id=...>"]
}

<question>
${question}
</question>
<answer>
${escapeXml(answer)}
</answer>
<unsupportedSentences>
${escapeXml(unsupported || "なし")}
</unsupportedSentences>
<context>
${context || "根拠チャンクはありません。"}
</context>`
}

export function buildRetrievalJudgePrompt(
  question: string,
  requiredFacts: Array<{ id: string; description: string }>,
  riskSignals: Array<{ type: string; factId?: string; chunkKeys: string[]; values: string[]; reason: string }>,
  chunks: RetrievedVector[]
): string {
  const facts = requiredFacts.length > 0 ? requiredFacts.map((fact) => `- ${fact.id}: ${fact.description}`).join("\n") : `- fact-1: ${question}`
  const risks = riskSignals
    .map((signal, index) => `- risk-${index + 1}: type=${signal.type}, factId=${signal.factId ?? ""}, values=${signal.values.join(", ")}, chunks=${signal.chunkKeys.join(", ")}, reason=${signal.reason}`)
    .join("\n")
  const context = chunks
    ? formatContextXml(assembleContext({ question, chunks, requiredFacts: requiredFacts.map((fact) => fact.description), tokenBudget: 2400 }))
    : ""

  return `RETRIEVAL_JUDGE_JSON
あなたは社内QA用RAGの検索評価 judge です。heuristic が検出した risk signal を、<context>内の evidence chunk だけで確認してください。
出力はJSONのみ。Markdownや説明文は禁止。

判定ルール:
- CONFLICT: 同一 fact / 同一 subject / 同一 scope で、複数の evidence が排他的な値を示している。
- NO_CONFLICT: 値の違いが旧制度/現行制度、部署、対象条件、適用期間などの scope 違いで説明できる、または risk が誤検出である。
- UNCLEAR: context だけでは conflict とも no conflict とも判断できない。
- regex cue や単語だけで CONFLICT にしない。
- memory card、一般知識、推測は根拠にしない。
- supportingChunkIds / contradictionChunkIds には <chunk id="..."> の id だけを入れる。

JSON schema:
{
  "label": "CONFLICT | NO_CONFLICT | UNCLEAR",
  "confidence": 0.0,
  "factIds": ["required fact id"],
  "supportingChunkIds": ["retrieved chunk id from <chunk id=...>"],
  "contradictionChunkIds": ["retrieved chunk id from <chunk id=...>"],
  "reason": "判定理由"
}

<question>
${question}
</question>
<requiredFacts>
${escapeXml(facts)}
</requiredFacts>
<riskSignals>
${escapeXml(risks || "risk signal はありません。")}
</riskSignals>
<context>
${context || "根拠チャンクはありません。"}
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
