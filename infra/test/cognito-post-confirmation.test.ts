import assert from "node:assert/strict"
import test from "node:test"
import type { PostConfirmationTriggerEvent } from "aws-lambda"
import { createPostConfirmationHandler } from "../functions/cognito-post-confirmation"

function event(overrides: Partial<PostConfirmationTriggerEvent> = {}): PostConfirmationTriggerEvent {
  return {
    version: "1",
    region: "ap-northeast-1",
    userPoolId: "ap-northeast-1_pool",
    userName: "user@example.com",
    callerContext: { awsSdkVersion: "3", clientId: "client-1" },
    triggerSource: "PostConfirmation_ConfirmSignUp",
    request: {
      userAttributes: { sub: "subject-1", email: "user@example.com" },
      clientMetadata: { requestedRole: "SYSTEM_ADMIN" }
    },
    response: {},
    ...overrides
  }
}

test("assigns only CHAT_USER and converges duplicate invocations", async () => {
  const assignments: Array<{ userPoolId: string; username: string; groupName: "CHAT_USER" }> = []
  const handler = createPostConfirmationHandler({
    addUserToGroup: async (input) => { assignments.push(input) }
  })
  const input = event()

  await handler(input)
  await handler(input)

  assert.deepEqual(assignments, [
    { userPoolId: "ap-northeast-1_pool", username: "user@example.com", groupName: "CHAT_USER" },
    { userPoolId: "ap-northeast-1_pool", username: "user@example.com", groupName: "CHAT_USER" }
  ])
})

test("does not assign a group for non-self-sign-up confirmation sources", async () => {
  let called = false
  const handler = createPostConfirmationHandler({
    addUserToGroup: async () => { called = true }
  })

  const input = event({ triggerSource: "PostConfirmation_ConfirmForgotPassword" })
  assert.equal(await handler(input), input)
  assert.equal(called, false)
})

test("fails closed when the event identity is missing", async () => {
  let called = false
  const handler = createPostConfirmationHandler({
    addUserToGroup: async () => { called = true }
  })

  await assert.rejects(handler(event({ userPoolId: "" })), /missing its user pool or username/)
  assert.equal(called, false)
})

test("retries transient assignment failures and returns only after assignment succeeds", async () => {
  let attempts = 0
  const waited: number[] = []
  const handler = createPostConfirmationHandler({
    addUserToGroup: async () => {
      attempts += 1
      if (attempts < 3) throw new Error("temporary Cognito failure")
    },
    waitBeforeRetry: async (attempt) => { waited.push(attempt) }
  })

  const input = event()
  assert.equal(await handler(input), input)
  assert.equal(attempts, 3)
  assert.deepEqual(waited, [1, 2])
})

test("propagates persistent assignment failure after bounded retries", async () => {
  let attempts = 0
  const handler = createPostConfirmationHandler({
    addUserToGroup: async () => {
      attempts += 1
      throw new Error("persistent Cognito failure")
    },
    waitBeforeRetry: async () => undefined
  })

  await assert.rejects(handler(event()), /Failed to assign the default Cognito group after retries/)
  assert.equal(attempts, 3)
})
