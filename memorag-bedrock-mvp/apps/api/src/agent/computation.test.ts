import assert from "node:assert/strict"
import test from "node:test"
import { buildTemporalContext, calculateDeadlineStatus, detectToolIntent, executeComputationTools } from "./computation.js"
import type { TemporalContext } from "./state.js"

const fixedTemporalContext: TemporalContext = {
  nowIso: "2026-05-03T00:00:00.000+09:00",
  today: "2026-05-03",
  timezone: "Asia/Tokyo",
  source: "test"
}

test("DateCalculator calculates days remaining, due today, and overdue status with fixed calendar-day rules", () => {
  const future = calculateDeadlineStatus("2026-05-10", fixedTemporalContext)
  assert.equal(future.daysRemaining, 7)
  assert.equal(future.overdueDays, 0)
  assert.equal(future.status, "not_due")

  const today = calculateDeadlineStatus("2026-05-03", fixedTemporalContext)
  assert.equal(today.daysRemaining, 0)
  assert.equal(today.overdueDays, 0)
  assert.equal(today.status, "due_today")
  assert.equal(today.rule.dueTodayIsOverdue, false)

  const overdue = calculateDeadlineStatus("2026-05-01", fixedTemporalContext)
  assert.equal(overdue.daysRemaining, 0)
  assert.equal(overdue.overdueDays, 2)
  assert.equal(overdue.status, "overdue")
})

test("temporal context uses question date when the question explicitly declares an as-of date", () => {
  const context = buildTemporalContext("2026年5月1日時点で、このタスクは期限切れですか？", new Date("2026-05-03T12:00:00.000Z"))
  assert.equal(context.today, "2026-05-01")
  assert.equal(context.timezone, "Asia/Tokyo")
  assert.equal(context.source, "question")
})

test("tool intent routes explicit temporal, arithmetic, and exhaustive deadline questions without RAG topK", () => {
  assert.deepEqual(detectToolIntent("2026-05-10まであと何日？").needsTemporalCalculation, true)
  assert.equal(detectToolIntent("1,200円を15人で12か月使うといくら？").needsArithmeticCalculation, true)

  const taskList = detectToolIntent("期限切れのタスクを全部出して")
  assert.equal(taskList.needsTaskDeadlineIndex, true)
  assert.equal(taskList.needsExhaustiveEnumeration, true)
  assert.equal(taskList.needsSearch, false)
})

test("computation layer executes MVP temporal and arithmetic tools deterministically", () => {
  const days = executeComputationTools("2026-05-10まであと何日？", fixedTemporalContext, detectToolIntent("2026-05-10まであと何日？"))
  assert.equal(days[0]?.kind, "days_until")
  assert.equal(days[0]?.kind === "days_until" ? days[0].daysRemaining : undefined, 7)

  const relative = executeComputationTools("申請から30日以内。申請日は2026-04-15", fixedTemporalContext, detectToolIntent("申請から30日以内。申請日は2026-04-15"))
  assert.equal(relative[0]?.kind, "add_days")
  assert.equal(relative[0]?.kind === "add_days" ? relative[0].resultDate : undefined, "2026-05-15")

  const arithmetic = executeComputationTools("1,200円を15人で12か月使うといくら？", fixedTemporalContext, detectToolIntent("1,200円を15人で12か月使うといくら？"))
  assert.equal(arithmetic[0]?.kind, "arithmetic")
  assert.equal(arithmetic[0]?.kind === "arithmetic" ? arithmetic[0].result : undefined, "216000")
})

test("computation layer reports explicit unavailable cases instead of guessing", () => {
  const missingBase = executeComputationTools("申請から30日以内。申請日不明", fixedTemporalContext, detectToolIntent("申請から30日以内。申請日不明"))
  assert.equal(missingBase[0]?.kind, "calculation_unavailable")
  assert.match(missingBase[0]?.kind === "calculation_unavailable" ? missingBase[0].reason : "", /申請日/)

  const businessDay = executeComputationTools("5営業日以内の期限は？", fixedTemporalContext, detectToolIntent("5営業日以内の期限は？"))
  assert.equal(businessDay[0]?.kind, "calculation_unavailable")
  assert.deepEqual(businessDay[0]?.kind === "calculation_unavailable" ? businessDay[0].unsupportedCapabilities : [], ["business_day"])

  const exhaustive = executeComputationTools("期限切れのタスクを全部出して", fixedTemporalContext, detectToolIntent("期限切れのタスクを全部出して"))
  assert.equal(exhaustive[0]?.kind, "task_deadline_query_unavailable")
  assert.equal(exhaustive[0]?.kind === "task_deadline_query_unavailable" ? exhaustive[0].condition : undefined, "overdue")
})
