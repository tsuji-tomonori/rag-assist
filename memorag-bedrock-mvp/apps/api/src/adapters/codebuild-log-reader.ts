import { BatchGetBuildsCommand, CodeBuildClient } from "@aws-sdk/client-codebuild"
import { CloudWatchLogsClient, GetLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs"
import { config } from "../config.js"

export type CodeBuildLogReference = {
  buildId?: string
  logGroupName?: string
  logStreamName?: string
}

export interface CodeBuildLogReader {
  getText(reference: CodeBuildLogReference): Promise<string | undefined>
}

const maxLogEvents = 10000
const maxLogChars = 900_000
const maxLogPages = 20

export class AwsCodeBuildLogReader implements CodeBuildLogReader {
  constructor(
    private readonly logsClient = new CloudWatchLogsClient({ region: config.region }),
    private readonly codeBuildClient = new CodeBuildClient({ region: config.region })
  ) {}

  async getText(reference: CodeBuildLogReference): Promise<string | undefined> {
    const resolved = await this.resolveLogReference(reference)
    if (!resolved) return undefined

    const lines: string[] = []
    let nextToken: string | undefined
    let previousToken: string | undefined
    let pageCount = 0
    let charCount = 0

    while (pageCount < maxLogPages && charCount < maxLogChars) {
      const response = await this.logsClient.send(new GetLogEventsCommand({
        logGroupName: resolved.logGroupName,
        logStreamName: resolved.logStreamName,
        startFromHead: true,
        nextToken,
        limit: maxLogEvents
      }))

      for (const event of response.events ?? []) {
        const message = event.message ?? ""
        const timestamp = event.timestamp ? new Date(event.timestamp).toISOString() : ""
        const line = timestamp ? `[${timestamp}] ${message}` : message
        lines.push(line)
        charCount += line.length + 1
        if (charCount >= maxLogChars) break
      }

      pageCount += 1
      previousToken = nextToken
      nextToken = response.nextForwardToken
      if (!nextToken || nextToken === previousToken) break
    }

    return lines.join("\n")
  }

  private async resolveLogReference(reference: CodeBuildLogReference): Promise<Required<Pick<CodeBuildLogReference, "logGroupName" | "logStreamName">> | undefined> {
    if (reference.logGroupName && reference.logStreamName) {
      return { logGroupName: reference.logGroupName, logStreamName: reference.logStreamName }
    }
    if (!reference.buildId) return undefined

    const response = await this.codeBuildClient.send(new BatchGetBuildsCommand({ ids: [reference.buildId] }))
    const logs = response.builds?.[0]?.logs
    if (!logs?.groupName || !logs.streamName) return undefined
    return { logGroupName: logs.groupName, logStreamName: logs.streamName }
  }
}
