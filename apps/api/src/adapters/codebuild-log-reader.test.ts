import assert from "node:assert/strict"
import test from "node:test"
import { AwsCodeBuildLogReader } from "./codebuild-log-reader.js"

type FakeClient = { send(command: { input: Record<string, unknown> }): Promise<Record<string, unknown>> }

test("AwsCodeBuildLogReader reads direct log references across pages", async () => {
  const inputs: Record<string, unknown>[] = []
  const pages = [
    { events: [{ timestamp: Date.UTC(2026, 6, 11), message: "start" }, { message: "plain" }], nextForwardToken: "next" },
    { events: [{ timestamp: Date.UTC(2026, 6, 11, 0, 0, 1), message: "done" }], nextForwardToken: "next" }
  ]
  const logsClient: FakeClient = {
    send: async (command) => {
      inputs.push(command.input)
      return pages.shift() ?? {}
    }
  }
  const reader = new AwsCodeBuildLogReader(logsClient as never, { send: async () => ({}) } as never)

  const text = await reader.getText({ logGroupName: "group", logStreamName: "stream" })
  assert.equal(text, "[2026-07-11T00:00:00.000Z] start\nplain\n[2026-07-11T00:00:01.000Z] done")
  assert.equal(inputs.length, 2)
  assert.deepEqual(inputs[0], {
    logGroupName: "group",
    logStreamName: "stream",
    startFromHead: true,
    nextToken: undefined,
    limit: 10000
  })
  assert.equal(inputs[1]?.nextToken, "next")
})

test("AwsCodeBuildLogReader resolves build logs and handles absent references", async () => {
  const buildInputs: Record<string, unknown>[] = []
  const codeBuildClient: FakeClient = {
    send: async (command) => {
      buildInputs.push(command.input)
      return { builds: [{ logs: { groupName: "resolved-group", streamName: "resolved-stream" } }] }
    }
  }
  const logInputs: Record<string, unknown>[] = []
  const logsClient: FakeClient = {
    send: async (command) => {
      logInputs.push(command.input)
      return { events: [], nextForwardToken: undefined }
    }
  }
  const reader = new AwsCodeBuildLogReader(logsClient as never, codeBuildClient as never)

  assert.equal(await reader.getText({ buildId: "build-1" }), "")
  assert.deepEqual(buildInputs[0], { ids: ["build-1"] })
  assert.equal(logInputs[0]?.logGroupName, "resolved-group")
  assert.equal(await reader.getText({}), undefined)

  const missing = new AwsCodeBuildLogReader(logsClient as never, { send: async () => ({ builds: [] }) } as never)
  assert.equal(await missing.getText({ buildId: "missing" }), undefined)
})
