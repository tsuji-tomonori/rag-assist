import assert from "node:assert/strict"
import test from "node:test"
import { safeUnhandledErrorResponse } from "./error-response.js"

test("safeUnhandledErrorResponse hides raw infrastructure error details", () => {
  const awsError = new Error("User: arn:aws:sts::111111111111:assumed-role/MemoRagMvpStack-ApiFunctionServiceRole is not authorized to perform: logs:GetLogEvents on resource: arn:aws:logs:us-east-1:111111111111:log-group:MemoRagMvpStack-BenchmarkProjectLogGroup:log-stream:build-stream")

  const response = safeUnhandledErrorResponse(awsError)

  assert.equal(response.status, 500)
  assert.deepEqual(response.body, { error: "Internal server error" })
  assert.doesNotMatch(JSON.stringify(response.body), /arn:aws|logs:GetLogEvents|MemoRagMvpStack|assumed-role/)
})

test("safeUnhandledErrorResponse hides messages from non-HTTP status errors", () => {
  const adapterError = Object.assign(new Error("AccessDeniedException: internal role and resource details"), { status: 403 })

  const response = safeUnhandledErrorResponse(adapterError)

  assert.equal(response.status, 403)
  assert.deepEqual(response.body, { error: "Request failed" })
  assert.doesNotMatch(JSON.stringify(response.body), /AccessDeniedException|internal role/)
})
