import { SFNClient, StopExecutionCommand } from "@aws-sdk/client-sfn"
import { config } from "../config.js"
import type { BenchmarkExecutionStopInput } from "./benchmark-run-cancellation-service.js"

export type BenchmarkExecutionStopClient = {
  send(command: StopExecutionCommand): Promise<unknown>
}

export async function stopBenchmarkExecution(
  input: BenchmarkExecutionStopInput,
  client: BenchmarkExecutionStopClient = new SFNClient({ region: config.region })
): Promise<void> {
  await client.send(new StopExecutionCommand({
    executionArn: input.executionArn,
    cause: input.cause
  }))
}
