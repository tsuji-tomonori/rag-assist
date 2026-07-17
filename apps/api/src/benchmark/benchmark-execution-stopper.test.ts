import assert from "node:assert/strict"
import test from "node:test"
import type { StopExecutionCommand } from "@aws-sdk/client-sfn"
import {
  stopBenchmarkExecution,
  type BenchmarkExecutionStopClient
} from "./benchmark-execution-stopper.js"

test("stopBenchmarkExecution maps the exact execution ARN and cancellation cause", async () => {
  const commands: StopExecutionCommand[] = []
  const client: BenchmarkExecutionStopClient = {
    send: async (command) => {
      commands.push(command)
      return {}
    }
  }

  await stopBenchmarkExecution({
    executionArn: "arn:aws:states:ap-northeast-1:123:execution:benchmark:run-1",
    cause: "Cancelled from MemoRAG admin benchmark view"
  }, client)

  assert.equal(commands.length, 1)
  assert.deepEqual(commands[0]?.input, {
    executionArn: "arn:aws:states:ap-northeast-1:123:execution:benchmark:run-1",
    cause: "Cancelled from MemoRAG admin benchmark view"
  })
})
