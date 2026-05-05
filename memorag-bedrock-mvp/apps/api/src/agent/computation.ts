import type { RetrievedVector } from "../types.js"
import type { ComputedFact, TemporalContext, ToolIntent } from "./state.js"

const DEFAULT_TIMEZONE = "Asia/Tokyo"
const ISO_DATE = /(\d{4})-(\d{1,2})-(\d{1,2})/g
const JA_DATE = /(\d{4})年(\d{1,2})月(\d{1,2})日/g

type DateCandidate = {
  text: string
  date: string
  index: number
  isAsOf: boolean
}

type TemporalContextOverride = {
  date: string
  source: "benchmark" | "test"
}

export function buildTemporalContext(question: string, now = new Date(), timezone = DEFAULT_TIMEZONE, override?: TemporalContextOverride): TemporalContext {
  const asOf = extractDateCandidates(question).find((candidate) => candidate.isAsOf)
  if (asOf) {
    return {
      nowIso: `${asOf.date}T00:00:00.000+09:00`,
      today: asOf.date,
      timezone,
      source: "question"
    }
  }

  const overrideDate = override?.date ? normalizeDateText(override.date) : undefined
  const overrideSource = override?.source
  if (override?.date && !overrideDate) {
    throw new Error(`Invalid asOfDate: ${override.date}`)
  }
  if (overrideDate && overrideSource) {
    return {
      nowIso: `${overrideDate}T00:00:00.000+09:00`,
      today: overrideDate,
      timezone,
      source: overrideSource
    }
  }

  return {
    nowIso: now.toISOString(),
    today: formatDateInTimezone(now, timezone),
    timezone,
    source: "server"
  }
}

export function detectToolIntent(question: string): ToolIntent {
  const normalized = question.replace(/\s+/g, "")
  const dateCandidates = extractDateCandidates(question)
  const asksDocumentVerification = isDocumentVerificationQuestion(normalized)
  const asksCurrentDate = isCurrentDateRequest(normalized)
  const asksTaskList = /(全部|一覧|全件|洗い出し|列挙).*(期限|締切|タスク)|(期限|締切).*(全部|一覧|全件|洗い出し|列挙)/.test(normalized)
  const asksBusinessDayCalculation = !asksDocumentVerification && isBusinessDayCalculationRequest(normalized)
  const asksDateComputation = !asksDocumentVerification && dateCandidates.length > 0 && isDateComputationRequest(normalized)
  const relativeDeadline = parseRelativeDeadline(normalized)
  const asksRelativeDeadlineCalculation = relativeDeadline !== undefined && !asksDocumentVerification && isRelativeDeadlineCalculationRequest(normalized)
  const asksTemporal =
    asksCurrentDate ||
    asksTaskList ||
    asksDateComputation ||
    asksRelativeDeadlineCalculation ||
    asksBusinessDayCalculation
  const asksArithmetic = !asksDocumentVerification &&
    /([0-9０-９][0-9０-９,，]*)円/.test(normalized) &&
    /(いくら|合計|総額|計算|かかる|合っていますか|正しいですか)/.test(normalized)
  const asksAggregation = /(平均|最大|最小|件数|合計).*(全部|全件|部署|一覧)/.test(normalized)
  const asksThresholdComparison = isDocumentThresholdComparisonRequest(normalized)
  const canAnswerTemporal =
    asksCurrentDate ||
    asksTaskList ||
    asksBusinessDayCalculation ||
    asksDateComputation ||
    asksRelativeDeadlineCalculation ||
    (!asksDocumentVerification && canAnswerTemporalFromQuestion(normalized))
  const canAnswerArithmetic = asksArithmetic && hasArithmeticInputs(normalized)

  if (asksTaskList) {
    return {
      needsSearch: false,
      canAnswerFromQuestionOnly: true,
      needsArithmeticCalculation: false,
      needsAggregation: false,
      needsTemporalCalculation: true,
      needsTaskDeadlineIndex: true,
      needsExhaustiveEnumeration: true,
      temporalOperation: "deadline_status",
      confidence: 0.94,
      reason: "期限タスクの全件列挙が求められているため、RAG topK ではなく構造化インデックス対象として扱います。"
    }
  }

  return {
    needsSearch: !(canAnswerTemporal || canAnswerArithmetic),
    canAnswerFromQuestionOnly: canAnswerTemporal || canAnswerArithmetic,
    needsArithmeticCalculation: asksArithmetic || asksThresholdComparison,
    needsAggregation: asksAggregation,
    needsTemporalCalculation: asksTemporal,
    needsTaskDeadlineIndex: false,
    needsExhaustiveEnumeration: false,
    temporalOperation: inferTemporalOperation(normalized),
    arithmeticOperation: asksArithmetic || asksThresholdComparison ? "price" : undefined,
    confidence: asksTemporal || asksArithmetic || asksThresholdComparison ? 0.88 : 0.55,
    reason: asksTemporal || asksArithmetic
      ? "質問文だけで明示的な計算対象を検出しました。"
      : asksThresholdComparison
        ? "資料内条件との金額閾値比較が必要なRAG検索質問として扱います。"
        : "通常のRAG検索質問として扱います。"
  }
}

export function executeComputationTools(question: string, temporalContext: TemporalContext, toolIntent: ToolIntent, evidenceChunks: RetrievedVector[] = []): ComputedFact[] {
  const facts: ComputedFact[] = []

  if (toolIntent.needsTaskDeadlineIndex) {
    facts.push({
      id: "task-deadline-unavailable-001",
      kind: "task_deadline_query_unavailable",
      inputFactIds: [],
      today: temporalContext.today,
      timezone: temporalContext.timezone,
      condition: inferTaskDeadlineCondition(question),
      reason: "TaskDeadlineIndex は未実装のため、期限切れタスクの完全な一覧は取得できません。"
    })
    return facts
  }

  if (toolIntent.needsTemporalCalculation) {
    facts.push(...executeTemporalCalculation(question, temporalContext, toolIntent))
  }

  if (toolIntent.needsArithmeticCalculation) {
    const arithmetic = executeArithmeticCalculation(question)
    if (arithmetic) facts.push(arithmetic)
    facts.push(...executeDocumentThresholdComparisons(question, evidenceChunks))
  }

  return facts
}

export function hasUsableComputedFact(facts: ComputedFact[]): boolean {
  return facts.length > 0
}

export function hasUnavailableComputedFact(facts: ComputedFact[]): boolean {
  return facts.some((fact) => fact.kind === "calculation_unavailable" || fact.kind === "task_deadline_query_unavailable")
}

export function calculateDeadlineStatus(
  dueDate: string,
  temporalContext: TemporalContext,
  unit: "calendar_day" | "business_day" = "calendar_day"
): Extract<ComputedFact, { kind: "deadline_status" }> {
  const diff = diffCalendarDays(temporalContext.today, dueDate)
  const status = diff > 0 ? "not_due" : diff === 0 ? "due_today" : "overdue"
  const daysRemaining = Math.max(0, diff)
  const overdueDays = Math.max(0, -diff)
  const explanation =
    status === "not_due"
      ? `${temporalContext.today}時点では期限まであと${daysRemaining}日です。`
      : status === "due_today"
        ? `${temporalContext.today}は本日期限です。期限切れではありません。`
        : `${temporalContext.today}時点では期限から${overdueDays}日超過しています。`

  return {
    id: "date-001",
    kind: "deadline_status",
    inputFactIds: [],
    today: temporalContext.today,
    timezone: temporalContext.timezone,
    dueDate,
    daysRemaining,
    overdueDays,
    status,
    rule: {
      dueTodayIsOverdue: false,
      unit
    },
    explanation
  }
}

function executeTemporalCalculation(question: string, temporalContext: TemporalContext, toolIntent: ToolIntent): ComputedFact[] {
  if (toolIntent.temporalOperation === "current_date") {
    return [
      {
        id: "date-current-001",
        kind: "current_date",
        inputFactIds: [],
        today: temporalContext.today,
        timezone: temporalContext.timezone,
        explanation: `${temporalContext.timezone} の基準日は ${temporalContext.today} です。`
      }
    ]
  }

  if (toolIntent.temporalOperation === "business_day_calculation") {
    return [
      {
        id: "date-unavailable-001",
        kind: "calculation_unavailable",
        inputFactIds: [],
        computationType: "temporal",
        reason: "営業日計算は現在未対応です。",
        missingInputs: [],
        unsupportedCapabilities: ["business_day"]
      }
    ]
  }

  const relative = parseRelativeDeadline(question)
  if (relative) {
    if (!relative.baseDate) {
      return [
        {
          id: "date-unavailable-001",
          kind: "calculation_unavailable",
          inputFactIds: [],
          computationType: "temporal",
          reason: `${relative.baseEvent}日が分からないため、残り日数または期限日は計算できません。`,
          missingInputs: [`${relative.baseEvent}日`],
          unsupportedCapabilities: []
        }
      ]
    }
    const resultDate = addCalendarDays(relative.baseDate, relative.amount)
    return [
      {
        id: "date-001",
        kind: "add_days",
        inputFactIds: [],
        today: temporalContext.today,
        timezone: temporalContext.timezone,
        baseDate: relative.baseDate,
        amount: relative.amount,
        unit: "calendar_day",
        resultDate,
        explanation: `${relative.baseEvent}日 ${relative.baseDate} から${relative.amount}日後の期限は ${resultDate} です。`
      }
    ]
  }

  const dueDate = extractDueDate(question)
  if (!dueDate) {
    return [
      {
        id: "date-unavailable-001",
        kind: "calculation_unavailable",
        inputFactIds: [],
        computationType: "temporal",
        reason: "計算対象の期限日を特定できません。",
        missingInputs: ["dueDate"],
        unsupportedCapabilities: []
      }
    ]
  }

  if (toolIntent.temporalOperation === "days_until") {
    const daysRemaining = diffCalendarDays(temporalContext.today, dueDate)
    if (daysRemaining < 0) return [calculateDeadlineStatus(dueDate, temporalContext)]
    return [
      {
        id: "date-001",
        kind: "days_until",
        inputFactIds: [],
        today: temporalContext.today,
        timezone: temporalContext.timezone,
        dueDate,
        daysRemaining,
        rule: {
          inclusive: false,
          unit: "calendar_day"
        },
        explanation: `${temporalContext.today}から${dueDate}までは${daysRemaining}日です。`
      }
    ]
  }

  return [calculateDeadlineStatus(dueDate, temporalContext)]
}

function executeArithmeticCalculation(question: string): ComputedFact | undefined {
  const normalized = question.replace(/，/g, ",")
  const yen = normalized.match(/([0-9０-９][0-9０-９,]*)円/)
  if (!yen?.[1]) return undefined
  const amount = parseNumber(yen[1])
  const people = matchNumberBefore(normalized, /人/)
  const months = matchNumberBefore(normalized, /(か月|ヶ月|カ月)/)
  const years = matchNumberBefore(normalized, /(年間|年契約|年利用|年分)/)
  const multipliers = [amount, people, months, years === undefined ? undefined : years * 12].filter((value): value is number => value !== undefined)
  if (multipliers.length < 2) return undefined
  const result = multipliers.reduce((product, value) => product * value, 1)
  if (!Number.isSafeInteger(result)) {
    return {
      id: "calc-unavailable-001",
      kind: "calculation_unavailable",
      inputFactIds: [],
      computationType: "arithmetic",
      reason: "safe integer range を超えるため計算できません。",
      missingInputs: [],
      unsupportedCapabilities: ["unsafe_integer"]
    }
  }
  const expression = multipliers.map((value) => String(value)).join(" * ")

  return {
    id: "calc-001",
    kind: "arithmetic",
    inputFactIds: [],
    expression,
    result: String(result),
    unit: "円",
    explanation: `${expression} = ${result}円です。`
  }
}

function executeDocumentThresholdComparisons(question: string, evidenceChunks: RetrievedVector[]): ComputedFact[] {
  if (!isDocumentThresholdComparisonRequest(question)) return []
  const questionAmount = extractQuestionYenAmount(question)
  if (questionAmount === undefined) return []

  const facts: ComputedFact[] = []
  for (const chunk of evidenceChunks) {
    const sentences = splitPolicySentences(chunk.metadata.text ?? "")
    for (const sentence of sentences) {
      const conditions = extractRequiredThresholdConditions(question, sentence)
      for (const condition of conditions) {
        const satisfiesCondition = compare(questionAmount, condition.operator, condition.thresholdAmount)
        facts.push({
          id: `threshold-${String(facts.length + 1).padStart(3, "0")}`,
          kind: "threshold_comparison",
          inputFactIds: [],
          sourceChunkId: chunk.metadata.chunkId ?? chunk.key,
          questionAmount,
          thresholdAmount: condition.thresholdAmount,
          operator: condition.operator,
          satisfiesCondition,
          polarity: condition.polarity,
          subject: condition.subject,
          requirement: condition.requirement,
          sourceText: condition.sourceText,
          explanation: `${formatYen(questionAmount)}は${formatThreshold(condition.operator, condition.thresholdAmount)}${satisfiesCondition ? "に該当します" : "に該当しません"}。${formatPolarity(condition.polarity, satisfiesCondition)}。根拠: ${condition.sourceText}`
        })
      }
    }
  }

  return facts
    .sort((a, b) => Number(b.kind === "threshold_comparison" && b.satisfiesCondition) - Number(a.kind === "threshold_comparison" && a.satisfiesCondition))
    .map((fact, index) => ({
      ...fact,
      id: `threshold-${String(index + 1).padStart(3, "0")}`
    }))
    .slice(0, 5)
}

function isDocumentThresholdComparisonRequest(question: string): boolean {
  const normalized = question.normalize("NFKC")
  return /[0-9][0-9,]*(?:\.\d+)?\s*(?:円|万円|千円)/.test(normalized) &&
    /(領収書|添付|証跡|申請|必要|いる|要る|該当|対象|条件)/.test(normalized) &&
    /(必要|いる|要る|該当|対象|条件|できますか|ですか|\?)/.test(normalized)
}

function extractQuestionYenAmount(question: string): number | undefined {
  const normalized = question.normalize("NFKC")
  const matches = [...normalized.matchAll(/([0-9][0-9,]*(?:\.\d+)?)\s*(万円|千円|円)/g)]
    .map((match) => ({
      rawValue: match[1],
      unit: match[2],
      index: match.index ?? 0,
      after: normalized.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 24)
    }))
    .filter((match): match is { rawValue: string; unit: string; index: number; after: string } => Boolean(match.rawValue && match.unit))
  const selected = matches
    .map((match, order) => ({ ...match, order, score: scoreQuestionAmountCandidate(match.after, order) }))
    .sort((a, b) => b.score - a.score || b.index - a.index)[0]
  return selected ? parseYenAmount(selected.rawValue, selected.unit) : undefined
}

function extractRequiredThresholdConditions(question: string, sentence: string): Array<{
  thresholdAmount: number
  operator: Extract<ComputedFact, { kind: "threshold_comparison" }>["operator"]
  polarity: Extract<ComputedFact, { kind: "threshold_comparison" }>["polarity"]
  subject: string
  requirement: string
  sourceText: string
}> {
  const normalizedSentence = sentence.normalize("NFKC")
  const questionTerms = extractRequirementTerms(question)
  if (questionTerms.length === 0) return []
  if (!questionTerms.some((term) => normalizedSentence.includes(term))) return []

  return splitPolicyClauses(normalizedSentence).flatMap((clause) => {
    const polarity = requirementPolarity(clause)
    if (!polarity) return []
    const thresholds = [...clause.matchAll(/([0-9][0-9,]*(?:\.\d+)?)\s*(万円|千円|円)\s*(以上|超|より多い|以下|未満|より少ない)/g)]
    return thresholds.flatMap((threshold) => {
      if (!threshold[1] || !threshold[2] || !threshold[3]) return []
      const thresholdAmount = parseYenAmount(threshold[1], threshold[2])
      if (!Number.isFinite(thresholdAmount)) return []
      return [
        {
          thresholdAmount,
          operator: operatorFromText(threshold[3]),
          polarity,
          subject: extractSubject(question, normalizedSentence),
          requirement: questionTerms[0] ?? "必要条件",
          sourceText: clause
        }
      ]
    })
  })
}

function scoreQuestionAmountCandidate(after: string, order: number): number {
  let score = order * 0.01
  if (/^\s*(?:では|で|の場合|の(?:経費精算|交通費|申請|備品|稟議))/.test(after)) score += 12
  if (/^\s*(?:なら|だったら)/.test(after)) score += 4
  if (/^\s*(?:以上|超|以下|未満|より多い|より少ない)/.test(after)) score -= 8
  if (/必要(?:と|だと)?(?:ある|書|記載|いう)|不要(?:と|だと)?(?:ある|書|記載|いう)/.test(after)) score -= 4
  return score
}

function requirementPolarity(sentence: string): Extract<ComputedFact, { kind: "threshold_comparison" }>["polarity"] | undefined {
  if (/(不要|必要(?:ありません|ない|なし)|要しない|求めない|添付不要|免除)/.test(sentence)) return "not_required"
  if (/(必要|必須|要する|求められる)/.test(sentence)) return "required"
  return undefined
}

function parseYenAmount(value: string, unit: string): number {
  const numeric = Number(value.replace(/,/g, ""))
  const multiplier = unit === "万円" ? 10_000 : unit === "千円" ? 1_000 : 1
  return numeric * multiplier
}

function operatorFromText(text: string): Extract<ComputedFact, { kind: "threshold_comparison" }>["operator"] {
  if (text === "以上") return "gte"
  if (text === "超" || text === "より多い") return "gt"
  if (text === "以下") return "lte"
  return "lt"
}

function compare(amount: number, operator: Extract<ComputedFact, { kind: "threshold_comparison" }>["operator"], threshold: number): boolean {
  switch (operator) {
    case "gte":
      return amount >= threshold
    case "gt":
      return amount > threshold
    case "lte":
      return amount <= threshold
    case "lt":
      return amount < threshold
  }
}

function extractRequirementTerms(question: string): string[] {
  const terms = ["領収書", "添付", "証跡", "承認", "申請", "備品", "稟議"].filter((term) => question.includes(term))
  return [...new Set(terms)]
}

function extractSubject(question: string, sentence: string): string {
  const questionSubjects = ["経費精算", "交通費", "社内備品", "備品", "稟議"].filter((term) => question.includes(term))
  const sentenceSubjects = ["経費精算", "交通費", "社内備品", "備品", "稟議"].filter((term) => sentence.includes(term))
  return questionSubjects[0] ?? sentenceSubjects[0] ?? "金額条件"
}

function splitPolicySentences(text: string): string[] {
  return text
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .split(/(?<=[。！？!?])\s*|\n+/u)
    .map((sentence) => sentence.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean)
}

function splitPolicyClauses(text: string): string[] {
  return text
    .split(/[、，；;]/u)
    .map((clause) => clause.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean)
}

function formatYen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`
}

function formatThreshold(operator: Extract<ComputedFact, { kind: "threshold_comparison" }>["operator"], amount: number): string {
  const suffix = operator === "gte" ? "以上" : operator === "gt" ? "超" : operator === "lte" ? "以下" : "未満"
  return `${formatYen(amount)}${suffix}`
}

function formatPolarity(polarity: Extract<ComputedFact, { kind: "threshold_comparison" }>["polarity"], satisfiesCondition: boolean): string {
  if (polarity === "required") return satisfiesCondition ? "資料上は必要条件に該当します" : "資料上は必要条件に該当しません"
  return satisfiesCondition ? "資料上は不要条件に該当します" : "資料上は不要条件に該当しません"
}

function inferTemporalOperation(question: string): ToolIntent["temporalOperation"] {
  if (isCurrentDateRequest(question)) return "current_date"
  if (isBusinessDayCalculationRequest(question)) return "business_day_calculation"
  if (/(あと何日|残り何日|まで何日|何日)/.test(question)) return "days_until"
  if (/(申請から|提出から|起算).*日以内/.test(question)) return "add_days"
  if (/(期限切れ|期限|締切|超過)/.test(question)) return "deadline_status"
  return undefined
}

function canAnswerTemporalFromQuestion(question: string): boolean {
  if (parseRelativeDeadline(question) && isRelativeDeadlineCalculationRequest(question)) return true
  return extractDueDate(question) !== undefined && isDateComputationRequest(question)
}

function isBusinessDayCalculationRequest(question: string): boolean {
  return /営業日/.test(question) &&
    /([0-9０-９]+営業日以内|[0-9０-９]+営業日後|何営業日後|翌営業日|営業日.*(計算|加算|起算)|あと何営業日|残り何営業日|期限切れ|超過)/.test(question)
}

function isCurrentDateRequest(question: string): boolean {
  if (hasDocumentSourceCue(question)) return false
  return /(今日|本日).*(日付|何日)/.test(question) ||
    /現在(の日付|は何日)/.test(question) ||
    /今(の日付|は何日)/.test(question)
}

function isDateComputationRequest(question: string): boolean {
  return /(あと何日|残り何日|まで何日|何日後|何日前|日数|残日数|期限切れ|超過|本日期限|過ぎている|過ぎています|過ぎた|過ぎました)/.test(question)
}

function isRelativeDeadlineCalculationRequest(question: string): boolean {
  return /(申請日|提出日|起算日|期限日|いつ|あと何日|残り何日|何日後|計算|加算|期限切れ|超過|過ぎている|過ぎています|過ぎた|過ぎました)/.test(question)
}

function isDocumentVerificationQuestion(question: string): boolean {
  return hasDocumentSourceCue(question) ||
    isDeadlineFactConfirmation(question)
}

function hasDocumentSourceCue(question: string): boolean {
  return /(記載|資料|規程|規定|文書|書類|契約書|マニュアル|ポリシー|発行日|作成日|されていますか|されてますか|書かれていますか|書いてありますか)/.test(question)
}

function isDeadlineFactConfirmation(question: string): boolean {
  return /(期限|締切)/.test(question) &&
    /(\d{4}-\d{1,2}-\d{1,2}|\d{4}年\d{1,2}月\d{1,2}日|(申請|提出|起算)から[0-9０-９]+日以内)/.test(question) &&
    /(ですか|でしょうか|合っていますか|正しいですか)/.test(question) &&
    !isDateComputationRequest(question) &&
    !isRelativeDeadlineCalculationRequest(question)
}

function hasArithmeticInputs(question: string): boolean {
  if (!/([0-9０-９][0-9０-９,，]*)円/.test(question)) return false
  return matchNumberBefore(question, /人/) !== undefined ||
    matchNumberBefore(question, /(か月|ヶ月|カ月)/) !== undefined ||
    matchNumberBefore(question, /(年間|年契約|年利用|年分)/) !== undefined
}

function inferTaskDeadlineCondition(question: string): Extract<ComputedFact, { kind: "task_deadline_query_unavailable" }>["condition"] {
  if (/期限切れ|超過/.test(question)) return "overdue"
  if (/今日|本日/.test(question)) return "due_today"
  if (/今週/.test(question)) return "due_this_week"
  return "unknown"
}

function parseRelativeDeadline(question: string): { baseEvent: string; amount: number; baseDate?: string } | undefined {
  const rule = question.match(/(申請|提出|起算)から([0-9０-９]+)日以内/)
  if (!rule?.[1] || !rule[2]) return undefined
  const baseEvent = rule[1]
  const amount = parseNumber(rule[2])
  const basePattern = new RegExp(`${baseEvent}日は?\\s*(${ISO_DATE.source.replace(/\/g$/, "")}|\\d{4}年\\d{1,2}月\\d{1,2}日)`)
  const baseMatch = question.match(basePattern)
  const baseDate = baseMatch?.[1] ? normalizeDateText(baseMatch[1]) : undefined
  return { baseEvent, amount, baseDate }
}

function extractDueDate(question: string): string | undefined {
  const candidates = extractDateCandidates(question).filter((candidate) => !candidate.isAsOf)
  return candidates.at(-1)?.date
}

function extractDateCandidates(text: string): DateCandidate[] {
  return [...collectDateCandidates(text, ISO_DATE), ...collectDateCandidates(text, JA_DATE)].sort((a, b) => a.index - b.index)
}

function collectDateCandidates(text: string, regex: RegExp): DateCandidate[] {
  const candidates: DateCandidate[] = []
  for (const match of text.matchAll(regex)) {
    if (match.index === undefined || !match[1] || !match[2] || !match[3]) continue
    const date = normalizeDateParts(match[1], match[2], match[3])
    if (!date) continue
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 12)
    candidates.push({
      text: match[0],
      date,
      index: match.index,
      isAsOf: /^(時点|現在|基準|の時点)/.test(after)
    })
  }
  return candidates
}

function normalizeDateText(text: string): string | undefined {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (iso?.[1] && iso[2] && iso[3]) return normalizeDateParts(iso[1], iso[2], iso[3])
  const ja = /^(\d{4})年(\d{1,2})月(\d{1,2})日$/.exec(text)
  if (ja?.[1] && ja[2] && ja[3]) return normalizeDateParts(ja[1], ja[2], ja[3])
  return undefined
}

function normalizeDateParts(yearText: string, monthText: string, dayText: string): string | undefined {
  const year = parseNumber(yearText)
  const month = parseNumber(monthText)
  const day = parseNumber(dayText)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function formatDateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value ?? "1970"
  const month = parts.find((part) => part.type === "month")?.value ?? "01"
  const day = parts.find((part) => part.type === "day")?.value ?? "01"
  return `${year}-${month}-${day}`
}

function diffCalendarDays(fromDate: string, toDate: string): number {
  return Math.round((Date.parse(`${toDate}T00:00:00.000Z`) - Date.parse(`${fromDate}T00:00:00.000Z`)) / 86_400_000)
}

function addCalendarDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + amount)
  return value.toISOString().slice(0, 10)
}

function matchNumberBefore(text: string, suffix: RegExp): number | undefined {
  const source = suffix.source
  const match = text.match(new RegExp(`([0-9０-９][0-9０-９,]*)${source}`))
  return match?.[1] ? parseNumber(match[1]) : undefined
}

function parseNumber(text: string): number {
  const normalized = text
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/,/g, "")
  return Number(normalized)
}
