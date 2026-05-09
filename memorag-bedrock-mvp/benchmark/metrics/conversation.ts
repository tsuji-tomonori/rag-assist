export type ConversationTurnExpectation = {
  answerable?: boolean
  expectedContains?: string | string[]
  expectedRegex?: string | string[]
  expectedFiles?: string[]
  expectedFileNames?: string[]
  expectedDocumentIds?: string[]
  expectedResponseType?: "answer" | "refusal" | "clarification"
  requiresHistory?: boolean
}

export type ConversationBenchmarkResponse = {
  responseType?: "answer" | "refusal" | "clarification"
  answer?: string
  isAnswerable?: boolean
  citations?: Array<{ fileName?: string; documentId?: string }>
  retrieved?: Array<{ fileName?: string; documentId?: string }>
  error?: string
}

export type ConversationTurnEvaluation = {
  expectedAnswerable: boolean
  actualAnswerable: boolean
  expectedResponseType: "answer" | "refusal" | "clarification"
  actualResponseType: "answer" | "refusal" | "clarification"
  responseTypeCorrect: boolean
  answerContainsExpected: boolean | null
  regexMatched: boolean | null
  answerCorrect: boolean
  abstentionCorrect: boolean | null
  expectedFileHit: boolean | null
  retrievalRecallAtK: boolean | null
  failureReasons: string[]
}

export type ConversationTurnResult = {
  conversationId: string
  turnId: string
  requiresHistory: boolean
  status: number
  evaluation: ConversationTurnEvaluation
}

export type ConversationSummary = {
  totalConversations: number
  totalTurns: number
  succeededTurns: number
  failedHttp: number
  metrics: {
    turnAnswerCorrectRate: number | null
    conversationSuccessRate: number | null
    historyDependentAccuracy: number | null
    abstentionAccuracy: number | null
    retrievalRecallAtK: number | null
  }
}

export function evaluateConversationTurn(
  expected: ConversationTurnExpectation,
  body: ConversationBenchmarkResponse,
  status: number
): ConversationTurnEvaluation {
  const expectedAnswerable = expected.answerable !== false
  const expectedResponseType = expected.expectedResponseType ?? (expectedAnswerable ? "answer" : "refusal")
  const actualResponseType = body.responseType ?? (body.isAnswerable ? "answer" : "refusal")
  const actualAnswerable = actualResponseType === "answer" || body.isAnswerable === true
  const answer = body.answer ?? ""
  const contains = expectedContains(expected.expectedContains, answer)
  const regex = expectedRegex(expected.expectedRegex, answer)
  const expectedFileHit = expectedFileNames(expected).length > 0
    ? hitAny(expectedFileNames(expected), body.citations ?? [])
    : null
  const retrievalRecallAtK = expectedFileNames(expected).length > 0 || expectedDocumentIds(expected).length > 0
    ? hitAny(expectedFileNames(expected), body.retrieved ?? []) || hitAny(expectedDocumentIds(expected), body.retrieved ?? [], "documentId")
    : null
  const responseTypeCorrect = actualResponseType === expectedResponseType
  const answerCorrect = status >= 200 && status < 300 && responseTypeCorrect && (
    expectedAnswerable
      ? contains !== false && regex !== false && expectedFileHit !== false
      : actualResponseType === "refusal"
  )
  const abstentionCorrect = expectedAnswerable ? null : actualResponseType === "refusal"
  const failureReasons: string[] = []
  if (status < 200 || status >= 300) failureReasons.push(`http_${status}`)
  if (!responseTypeCorrect) failureReasons.push(`response_type:${actualResponseType}`)
  if (contains === false) failureReasons.push("expected_contains_miss")
  if (regex === false) failureReasons.push("expected_regex_miss")
  if (expectedFileHit === false) failureReasons.push("citation_file_miss")
  if (retrievalRecallAtK === false) failureReasons.push("retrieval_file_miss")

  return {
    expectedAnswerable,
    actualAnswerable,
    expectedResponseType,
    actualResponseType,
    responseTypeCorrect,
    answerContainsExpected: contains,
    regexMatched: regex,
    answerCorrect,
    abstentionCorrect,
    expectedFileHit,
    retrievalRecallAtK,
    failureReasons
  }
}

export function summarizeConversationResults(results: ConversationTurnResult[]): ConversationSummary {
  const conversationIds = [...new Set(results.map((result) => result.conversationId))]
  const succeededTurns = results.filter((result) => result.status >= 200 && result.status < 300).length
  const failedHttp = results.length - succeededTurns
  const answerEvaluated = results.filter((result) => result.evaluation.expectedAnswerable)
  const historyDependent = answerEvaluated.filter((result) => result.requiresHistory)
  const abstentionEvaluated = results.filter((result) => result.evaluation.abstentionCorrect !== null)
  const retrievalEvaluated = results.filter((result) => result.evaluation.retrievalRecallAtK !== null)
  const successfulConversations = conversationIds.filter((conversationId) =>
    results
      .filter((result) => result.conversationId === conversationId)
      .every((result) => result.evaluation.answerCorrect)
  )

  return {
    totalConversations: conversationIds.length,
    totalTurns: results.length,
    succeededTurns,
    failedHttp,
    metrics: {
      turnAnswerCorrectRate: rate(answerEvaluated.filter((result) => result.evaluation.answerCorrect).length, answerEvaluated.length),
      conversationSuccessRate: rate(successfulConversations.length, conversationIds.length),
      historyDependentAccuracy: rate(historyDependent.filter((result) => result.evaluation.answerCorrect).length, historyDependent.length),
      abstentionAccuracy: rate(abstentionEvaluated.filter((result) => result.evaluation.abstentionCorrect).length, abstentionEvaluated.length),
      retrievalRecallAtK: rate(retrievalEvaluated.filter((result) => result.evaluation.retrievalRecallAtK).length, retrievalEvaluated.length)
    }
  }
}

export function renderConversationReport(summary: ConversationSummary): string {
  const metrics = summary.metrics
  return [
    "# Conversation Benchmark Report",
    "",
    `- totalConversations: ${summary.totalConversations}`,
    `- totalTurns: ${summary.totalTurns}`,
    `- succeededTurns: ${summary.succeededTurns}`,
    `- failedHttp: ${summary.failedHttp}`,
    "",
    "| metric | value |",
    "|---|---:|",
    `| turnAnswerCorrectRate | ${formatMetric(metrics.turnAnswerCorrectRate)} |`,
    `| conversationSuccessRate | ${formatMetric(metrics.conversationSuccessRate)} |`,
    `| historyDependentAccuracy | ${formatMetric(metrics.historyDependentAccuracy)} |`,
    `| abstentionAccuracy | ${formatMetric(metrics.abstentionAccuracy)} |`,
    `| retrievalRecallAtK | ${formatMetric(metrics.retrievalRecallAtK)} |`,
    ""
  ].join("\n")
}

function expectedContains(expected: string | string[] | undefined, answer: string): boolean | null {
  const values = toArray(expected)
  if (values.length === 0) return null
  return values.every((value) => answer.toLowerCase().includes(value.toLowerCase()))
}

function expectedRegex(expected: string | string[] | undefined, answer: string): boolean | null {
  const values = toArray(expected)
  if (values.length === 0) return null
  return values.every((value) => new RegExp(value, "iu").test(answer))
}

function expectedFileNames(expected: ConversationTurnExpectation): string[] {
  return [...toArray(expected.expectedFiles), ...toArray(expected.expectedFileNames)]
}

function expectedDocumentIds(expected: ConversationTurnExpectation): string[] {
  return toArray(expected.expectedDocumentIds)
}

function hitAny(
  expectedValues: string[],
  actual: Array<{ fileName?: string; documentId?: string }>,
  field: "fileName" | "documentId" = "fileName"
): boolean {
  const normalized = new Set(actual.map((item) => item[field]).filter((value): value is string => Boolean(value)))
  return expectedValues.some((value) => normalized.has(value))
}

function toArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean)
  return value ? [value] : []
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return Number((numerator / denominator).toFixed(4))
}

function formatMetric(value: number | null): string {
  return value === null ? "-" : value.toFixed(4)
}
