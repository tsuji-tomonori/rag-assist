import assert from "node:assert/strict"
import test from "node:test"
import { PublishCommand } from "@aws-sdk/client-sns"
import { SnsRagAlertPublisher, type RagAlertNotification } from "./quality-control/rag-alert-publisher.js"

test("FR-093 SNS publisher sends the sanitized structured owner/runbook/version/slice payload", async () => {
  const commands: unknown[] = []
  const notification: RagAlertNotification = {
    schemaVersion: 1,
    alertId: "alert-1",
    severity: "critical",
    owner: "rag-on-call",
    profile: { id: "production-rag", version: "approved-1" },
    affected: {
      runtimeProfileVersion: "runtime-v2",
      signalId: "security.unauthorized_exposure_count",
      slice: "role=chat_user",
      versionDimensions: { model: ["model-v1"], index: ["index-v1"] }
    },
    reason: "zero_tolerance_violation",
    traceIds: ["trace:leak-canary"],
    runbookVersion: "rag-runbook-v1",
    createdAt: "2026-07-11T02:00:00.000Z"
  }
  const publisher = new SnsRagAlertPublisher("arn:aws:sns:ap-northeast-1:123456789012:rag-alerts", {
    send: async (command: unknown) => { commands.push(command); return {} }
  } as never)

  await publisher.publish(notification)

  assert.equal(commands.length, 1)
  const command = commands[0]
  assert.ok(command instanceof PublishCommand)
  assert.equal(command.input.TopicArn, "arn:aws:sns:ap-northeast-1:123456789012:rag-alerts")
  assert.deepEqual(JSON.parse(command.input.Message ?? ""), notification)
  assert.equal(command.input.MessageAttributes?.severity?.StringValue, "critical")
})
