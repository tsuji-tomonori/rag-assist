import assert from "node:assert/strict"
import test from "node:test"
import { buildTemporalContext, calculateDeadlineStatus, detectToolIntent, executeComputationTools } from "./computation.js"
import { addMonths } from "./nodes/execute-computation-tools.js"
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

test("temporal context uses injected asOfDate when the question does not override it", () => {
  const context = buildTemporalContext("2026-05-10まであと何日？", new Date("2026-05-04T12:00:00.000Z"), "Asia/Tokyo", {
    date: "2026-05-03",
    source: "test"
  })
  assert.equal(context.today, "2026-05-03")
  assert.equal(context.source, "test")
})

test("temporal context rejects invalid injected asOfDate instead of silently falling back", () => {
  assert.throws(
    () => buildTemporalContext("2026-05-10まであと何日？", new Date("2026-05-04T12:00:00.000Z"), "Asia/Tokyo", {
      date: "2026-99-99",
      source: "test"
    }),
    /Invalid asOfDate/
  )
})

test("tool intent routes explicit temporal, arithmetic, and exhaustive deadline questions without RAG topK", () => {
  assert.deepEqual(detectToolIntent("2026-05-10まであと何日？").needsTemporalCalculation, true)
  assert.equal(detectToolIntent("1,200円を15人で12か月使うといくら？").needsArithmeticCalculation, true)
  assert.equal(detectToolIntent("1,200円を15人で12か月使うといくら？").canAnswerFromQuestionOnly, true)
  assert.equal(detectToolIntent("この資料では1,200円を15人で12か月使うと総額いくらと記載されていますか？").canAnswerFromQuestionOnly, false)
  assert.equal(detectToolIntent("この資料では1,200円を15人で12か月使うと総額いくらと記載されていますか？").needsSearch, true)
  assert.equal(detectToolIntent("この契約書では1,200円を15人で12か月使うと216,000円で合っていますか？").needsSearch, true)
  assert.equal(detectToolIntent("1,200円を15人で12か月使うと216,000円で合っていますか？").canAnswerFromQuestionOnly, true)
  assert.equal(detectToolIntent("1,200円を15人で12か月使う計算は正しいですか？").canAnswerFromQuestionOnly, true)
  assert.equal(detectToolIntent("今日の日付は？").canAnswerFromQuestionOnly, true)
  assert.equal(detectToolIntent("今日の日付は何日ですか？").canAnswerFromQuestionOnly, true)
  assert.equal(detectToolIntent("今日の日付は何日ですか？").needsTemporalCalculation, true)
  assert.equal(detectToolIntent("今は何日ですか？").canAnswerFromQuestionOnly, true)
  assert.equal(detectToolIntent("今月の締切は何日ですか？").canAnswerFromQuestionOnly, false)
  assert.equal(detectToolIntent("今月の締切は何日ですか？").needsSearch, true)
  assert.equal(detectToolIntent("今週の申請期限は何日ですか？").needsSearch, true)
  assert.equal(detectToolIntent("現在の提出期限は何日ですか？").needsSearch, true)
  assert.equal(detectToolIntent("この資料の日付を確認してください").canAnswerFromQuestionOnly, false)
  assert.equal(detectToolIntent("この資料の日付を確認してください").needsSearch, true)
  assert.equal(detectToolIntent("契約書の日付を教えて").canAnswerFromQuestionOnly, false)
  assert.equal(detectToolIntent("契約書の日付を教えて").needsSearch, true)
  assert.equal(detectToolIntent("在宅勤務手当の申請期限は何営業日ですか？").canAnswerFromQuestionOnly, false)
  assert.equal(detectToolIntent("在宅勤務手当の申請期限は何営業日ですか？").needsSearch, true)
  assert.equal(detectToolIntent("経費精算の期限は2026-05-10ですか？").canAnswerFromQuestionOnly, false)
  assert.equal(detectToolIntent("経費精算の期限は2026-05-10ですか？").needsSearch, true)
  assert.equal(detectToolIntent("経費精算の期限は申請から30日以内ですか？").canAnswerFromQuestionOnly, false)
  assert.equal(detectToolIntent("経費精算の期限は申請から30日以内ですか？").needsSearch, true)
  assert.equal(detectToolIntent("申請日は2026-04-15で、申請から30日以内の期限はいつですか？").canAnswerFromQuestionOnly, true)
  assert.equal(detectToolIntent("2026-05-01期限は期限切れですか？").canAnswerFromQuestionOnly, true)
  assert.equal(detectToolIntent("2026-05-01期限は期限切れで合っていますか？").canAnswerFromQuestionOnly, true)
  assert.equal(detectToolIntent("申請日は2026-04-15で、申請から30日以内の期限は2026-05-15で合っていますか？").canAnswerFromQuestionOnly, true)
  assert.equal(detectToolIntent("この資料では2026-05-01期限切れと記載されていますか？").canAnswerFromQuestionOnly, false)
  assert.equal(detectToolIntent("この資料では2026-05-01期限切れと記載されていますか？").needsSearch, true)
  assert.equal(detectToolIntent("この資料では5営業日以内と記載されていますか？").canAnswerFromQuestionOnly, false)
  assert.equal(detectToolIntent("この資料では5営業日以内と記載されていますか？").needsSearch, true)
  assert.equal(detectToolIntent("5200円の経費精算では領収書いる?").needsArithmeticCalculation, false)
  assert.equal(detectToolIntent("5200円の経費精算では領収書いる?").needsSearch, true)
  assert.equal(detectToolIntent("5200円の経費精算では領収書いる?").canAnswerFromQuestionOnly, false)

  const taskList = detectToolIntent("期限切れのタスクを全部出して")
  assert.equal(taskList.needsTaskDeadlineIndex, true)
  assert.equal(taskList.needsExhaustiveEnumeration, true)
  assert.equal(taskList.needsSearch, false)
})

test("tool intent consistently detects relative policy deadline wording variants", () => {
  for (const question of [
    "8/1から育休を取る場合、申請期限は？",
    "8/1から育休を取る場合、提出期限は？",
    "8/1から育休を取る場合、締切は？"
  ]) {
    const intent = detectToolIntent(question)
    assert.equal(intent.needsTemporalCalculation, true)
    assert.equal(intent.temporalOperation, "relative_policy_deadline")
    assert.equal(intent.needsSearch, true)
  }
})

test("tool intent keeps document verification questions out of relative policy deadline calculation", () => {
  for (const question of [
    "資料に、8/1から育休を取る場合の申請期限は書かれていますか？",
    "規程には、8/1開始の場合の申請期限が記載されていますか？"
  ]) {
    const intent = detectToolIntent(question)
    assert.equal(intent.needsTemporalCalculation, false)
    assert.notEqual(intent.temporalOperation, "relative_policy_deadline")
    assert.equal(intent.needsSearch, true)
  }
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

  const currentDate = executeComputationTools("今日の日付は？", fixedTemporalContext, detectToolIntent("今日の日付は？"))
  assert.equal(currentDate[0]?.kind, "current_date")
  assert.equal(currentDate[0]?.kind === "current_date" ? currentDate[0].today : undefined, "2026-05-03")

  const politeRelative = executeComputationTools(
    "申請日は2026-04-15で、申請から30日以内の期限はいつですか？",
    fixedTemporalContext,
    detectToolIntent("申請日は2026-04-15で、申請から30日以内の期限はいつですか？")
  )
  assert.equal(politeRelative[0]?.kind, "add_days")
  assert.equal(politeRelative[0]?.kind === "add_days" ? politeRelative[0].resultDate : undefined, "2026-05-15")

  const documentThreshold = executeComputationTools("5200円の経費精算では領収書いる?", fixedTemporalContext, detectToolIntent("5200円の経費精算では領収書いる?"))
  assert.equal(documentThreshold.length, 0)
})

test("days_until past date reports overdue instead of negative remaining days", () => {
  const result = executeComputationTools("2026年5月3日時点で、2026-05-01まであと何日？", fixedTemporalContext, detectToolIntent("2026年5月3日時点で、2026-05-01まであと何日？"))
  assert.equal(result[0]?.kind, "deadline_status")
  assert.equal(result[0]?.kind === "deadline_status" ? result[0].overdueDays : undefined, 2)
})

test("addMonths clamps month-end dates to the target month end", () => {
  assert.equal(addMonths("2026-08-01", -1), "2026-07-01")
  assert.equal(addMonths("2026-03-31", -1), "2026-02-28")
  assert.equal(addMonths("2028-03-31", -1), "2028-02-29")
  assert.equal(addMonths("2026-05-31", -1), "2026-04-30")
})

test("arithmetic extraction treats calendar year and month separately from duration", () => {
  const result = executeComputationTools("2026年5月に、1,200円を15人で使うといくら？", fixedTemporalContext, detectToolIntent("2026年5月に、1,200円を15人で使うといくら？"))
  assert.equal(result[0]?.kind, "arithmetic")
  assert.equal(result[0]?.kind === "arithmetic" ? result[0].result : undefined, "18000")
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
