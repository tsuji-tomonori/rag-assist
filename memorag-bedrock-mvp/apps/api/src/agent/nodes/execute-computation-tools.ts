import { executeComputationTools as executeTools } from "../computation.js"
import type { ComputedFact, QaAgentState, QaAgentUpdate } from "../state.js"

const slashMonthDayPattern = /(?<!\d)(\d{1,2})\/(\d{1,2})(?!\d)/
const relativeMonthDeadlinePattern = /(?:(?:申請期限|提出期限|締切)\s*は\s*開始日\s*の\s*([0-9０-９]+)\s*(?:か月|ヶ月|カ月)前|開始日\s*の\s*([0-9０-９]+)\s*(?:か月|ヶ月|カ月)前\s*までに\s*(?:申請|提出))/

export async function executeComputationTools(state: QaAgentState): Promise<QaAgentUpdate> {
  if (!state.temporalContext || !state.toolIntent) return { computedFacts: [] }
  if (!state.toolIntent.needsArithmeticCalculation && !state.toolIntent.needsTemporalCalculation && !state.toolIntent.needsAggregation && !state.toolIntent.needsTaskDeadlineIndex) {
    return { computedFacts: [] }
  }

  const computedFacts = state.toolIntent.temporalOperation === "relative_policy_deadline"
    ? deriveRelativePolicyDeadlineFacts(state)
    : executeTools(state.question, state.temporalContext, state.toolIntent)

  return {
    computedFacts
  }
}

function deriveRelativePolicyDeadlineFacts(state: QaAgentState): ComputedFact[] {
  if (!state.temporalContext || !state.toolIntent?.needsTemporalCalculation) return []
  const startDate = extractStartDate(state.question, state.temporalContext.today)
  if (!startDate) return []

  for (const chunk of state.selectedChunks.length > 0 ? state.selectedChunks : state.retrievedChunks) {
    const text = chunk.metadata.text ?? ""
    const rule = relativeMonthDeadlinePattern.exec(text)
    if (!rule) continue
    const amountText = rule[1] ?? rule[2]
    if (!amountText) continue
    const amount = parseNumber(amountText)
    const resultDate = addMonths(startDate, -amount)
    const ruleText = rule[0]
    return [
      {
        id: "relative-deadline-001",
        kind: "relative_policy_deadline",
        inputFactIds: [],
        sourceChunkId: chunk.metadata.chunkId,
        today: state.temporalContext.today,
        timezone: state.temporalContext.timezone,
        baseDate: startDate,
        resultDate,
        amount,
        unit: "month",
        direction: "before",
        ruleText,
        explanation: `${startDate}開始の場合、${ruleText}に基づく申請期限は${resultDate}です。`
      }
    ]
  }
  return []
}

function extractStartDate(question: string, today: string): string | undefined {
  const match = slashMonthDayPattern.exec(question)
  if (!match?.[1] || !match[2]) return undefined
  const month = Number(match[1])
  const day = Number(match[2])
  const currentYear = Number(today.slice(0, 4))
  const currentMonthDay = today.slice(5)
  const candidateMonthDay = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  const year = candidateMonthDay < currentMonthDay ? currentYear + 1 : currentYear
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined
  return `${year}-${candidateMonthDay}`
}

export function addMonths(date: string, amount: number): string {
  const [yearText, monthText, dayText] = date.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const targetFirst = new Date(Date.UTC(year, month - 1 + amount, 1))
  const targetYear = targetFirst.getUTCFullYear()
  const targetMonth = targetFirst.getUTCMonth()
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const clampedDay = Math.min(day, lastDay)
  return new Date(Date.UTC(targetYear, targetMonth, clampedDay)).toISOString().slice(0, 10)
}

function parseNumber(text: string): number {
  return Number(text.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0)))
}
