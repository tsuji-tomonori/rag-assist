import { PublishCommand, SNSClient } from "@aws-sdk/client-sns"

export type RagAlertNotification = {
  schemaVersion: 1
  alertId: string
  severity: "critical" | "high" | "warning"
  owner: string
  profile: { id: string; version: string }
  affected: {
    runtimeProfileVersion: string
    signalId: string
    slice: string
    versionDimensions: Record<string, string[]>
  }
  reason: string
  traceIds: string[]
  runbookVersion: string
  createdAt: string
}

export interface RagAlertPublisher {
  publish(notification: RagAlertNotification): Promise<void>
}

type SnsClientPort = Pick<SNSClient, "send">

export class SnsRagAlertPublisher implements RagAlertPublisher {
  constructor(
    private readonly topicArn: string,
    private readonly client: SnsClientPort = new SNSClient({})
  ) {
    if (!topicArn.trim()) throw new Error("RAG_ALERT_TOPIC_ARN is required")
  }

  async publish(notification: RagAlertNotification): Promise<void> {
    await this.client.send(new PublishCommand({
      TopicArn: this.topicArn,
      Subject: `MemoRAG ${notification.severity} ${notification.affected.signalId}`.slice(0, 100),
      Message: JSON.stringify(notification),
      MessageAttributes: {
        severity: { DataType: "String", StringValue: notification.severity },
        profileVersion: { DataType: "String", StringValue: notification.profile.version },
        signalId: { DataType: "String", StringValue: notification.affected.signalId }
      }
    }))
  }
}

export function createRagAlertPublisherFromEnvironment(env: NodeJS.ProcessEnv = process.env): RagAlertPublisher | undefined {
  const topicArn = env.RAG_ALERT_TOPIC_ARN?.trim()
  return topicArn ? new SnsRagAlertPublisher(topicArn) : undefined
}
