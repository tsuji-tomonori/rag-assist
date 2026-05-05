import type { ComputedFact, TemporalContext, ToolIntent } from "./state.js"

const DEFAULT_TIMEZONE = "Asia/Tokyo"
const ISO_DATE = /(\d{4})-(\d{1,2})-(\d{1,2})/g
const JA_DATE = /(\d{4})年(\d{1,2})月(\d{1,2})日/g
const SLASH_MONTH_DAY = /(?<!\d)(\d{1,2})\/(\d{1,2})(?!\d)/

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
  const asksPolicyDeadlineCalculation = isPolicyDeadlineQuestion(question)
  const relativeDeadline = parseRelativeDeadline(normalized)
  const asksRelativeDeadlineCalculation = relativeDeadline !== undefined && !asksDocumentVerification && isRelativeDeadlineCalculationRequest(normalized)
  const asksTemporal =
    asksCurrentDate ||
    asksTaskList ||
    asksDateComputation ||
    asksPolicyDeadlineCalculation ||
    asksRelativeDeadlineCalculation ||
    asksBusinessDayCalculation
  const asksArithmetic = !asksDocumentVerification &&
    /([0-9０-９][0-9０-９,，]*)円/.test(normalized) &&
    /(いくら|合計|総額|計算|かかる|合っていますか|正しいですか)/.test(normalized)
  const asksAggregation = /(平均|最大|最小|件数|合計).*(全部|全件|部署|一覧)/.test(normalized)
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
    needsArithmeticCalculation: asksArithmetic,
    needsAggregation: asksAggregation,
    needsTemporalCalculation: asksTemporal,
    needsTaskDeadlineIndex: false,
    needsExhaustiveEnumeration: false,
    temporalOperation: inferTemporalOperation(normalized),
    arithmeticOperation: asksArithmetic ? "price" : undefined,
    confidence: asksTemporal || asksArithmetic ? 0.88 : 0.55,
    reason: asksTemporal || asksArithmetic ? "質問文だけで明示的な計算対象を検出しました。" : "通常のRAG検索質問として扱います。"
  }
}

export function executeComputationTools(question: string, temporalContext: TemporalContext, toolIntent: ToolIntent): ComputedFact[] {
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

function inferTemporalOperation(question: string): ToolIntent["temporalOperation"] {
  if (isCurrentDateRequest(question)) return "current_date"
  if (isBusinessDayCalculationRequest(question)) return "business_day_calculation"
  if (isPolicyDeadlineQuestion(question)) return "relative_policy_deadline"
  if (/(あと何日|残り何日|まで何日|何日)/.test(question)) return "days_until"
  if (/(申請から|提出から|起算).*日以内/.test(question)) return "add_days"
  if (/(期限切れ|期限|締切|超過)/.test(question)) return "deadline_status"
  return undefined
}

export function isPolicyDeadlineQuestion(question: string): boolean {
  const normalized = question.replace(/\s+/g, "")
  return hasSlashMonthDayMention(normalized) &&
    /(いつまで|期限|締切|申請.*必要|提出.*必要)/.test(normalized) &&
    /(から|開始|取得|取る)/.test(normalized)
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

function hasSlashMonthDayMention(question: string): boolean {
  return SLASH_MONTH_DAY.test(question)
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
