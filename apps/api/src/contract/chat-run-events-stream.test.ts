import assert from "node:assert/strict"
import test from "node:test"
import type { APIGatewayProxyEvent } from "aws-lambda"
import { createChatRunEventsStreamHandler, eventPayload, plainResponseHeaders, streamResponseHeaders } from "../chat-run-events-stream.js"
import type { ChatRun, ChatRunEvent } from "../types.js"

test("chat run event payload preserves stage and message when data exists", () => {
  assert.deepEqual(
    eventPayload({
      runId: "run-1",
      seq: 1,
      type: "status",
      stage: "retrieve",
      message: "根拠を検索しました",
      data: { latencyMs: 42 },
      createdAt: "2026-05-04T00:00:00.000Z"
    }),
    { stage: "retrieve", message: "根拠を検索しました", latencyMs: 42 }
  )

  assert.deepEqual(
    eventPayload({
      runId: "run-1",
      seq: 2,
      type: "status",
      stage: "queued",
      message: "リクエストを受け付けました",
      createdAt: "2026-05-04T00:00:00.000Z"
    }),
    { stage: "queued", message: "リクエストを受け付けました" }
  )

  assert.deepEqual(
    eventPayload({
      runId: "run-1",
      seq: 3,
      type: "status",
      data: ["queued"],
      createdAt: "2026-05-04T00:00:00.000Z"
    }),
    { data: ["queued"] }
  )

  assert.deepEqual(
    eventPayload({
      runId: "run-1",
      seq: 4,
      type: "status",
      data: "raw",
      createdAt: "2026-05-04T00:00:00.000Z"
    }),
    { data: "raw" }
  )

  assert.deepEqual(
    eventPayload({
      runId: "run-1",
      seq: 5,
      type: "status",
      createdAt: "2026-05-04T00:00:00.000Z"
    }),
    {}
  )
})

test("chat run event stream responses include CORS headers", async () => {
  const run: ChatRun = {
    runId: "run-1",
    status: "running",
    createdBy: "user-1",
    question: "質問",
    modelId: "model",
    createdAt: "2026-05-04T00:00:00.000Z",
    updatedAt: "2026-05-04T00:00:00.000Z"
  }
  const events: ChatRunEvent[] = [
    {
      runId: "run-1",
      seq: 1,
      type: "status",
      stage: "retrieve",
      message: "根拠を検索しました",
      data: { latencyMs: 42 },
      createdAt: "2026-05-04T00:00:01.000Z"
    },
    {
      runId: "run-1",
      seq: 2,
      type: "final",
      stage: "done",
      message: "回答生成が完了しました",
      data: { answer: "ok", isAnswerable: true, citations: [], retrieved: [] },
      createdAt: "2026-05-04T00:00:02.000Z"
    }
  ]

  const ok = await invokeStream({
    run,
    events,
    event: event({ runId: "run-1", userId: "user-1" })
  })
  assert.equal(ok.metadata?.statusCode, 200)
  assert.deepEqual(ok.metadata?.headers, streamResponseHeaders)
  assert.match(ok.body, /event: status/)
  assert.match(ok.body, /"stage":"retrieve"/)
  assert.match(ok.body, /"message":"根拠を検索しました"/)

  const forbidden = await invokeStream({
    run,
    events: [],
    event: event({ runId: "run-1", userId: "user-2" })
  })
  assert.equal(forbidden.metadata?.statusCode, 403)
  assert.deepEqual(forbidden.metadata?.headers, plainResponseHeaders)

  const missingReadPermission = await invokeStream({
    run,
    events: [],
    event: event({ runId: "run-1", userId: "user-1", groups: [] })
  })
  assert.equal(missingReadPermission.metadata?.statusCode, 403)
  assert.deepEqual(missingReadPermission.metadata?.headers, plainResponseHeaders)

  const adminReadAll = await invokeStream({
    run,
    events,
    event: event({ runId: "run-1", userId: "admin-1", groups: ["SYSTEM_ADMIN"] })
  })
  assert.equal(adminReadAll.metadata?.statusCode, 200)
  assert.deepEqual(adminReadAll.metadata?.headers, streamResponseHeaders)

  const missing = await invokeStream({
    events: [],
    event: event({ runId: "missing", userId: "user-1" })
  })
  assert.equal(missing.metadata?.statusCode, 404)
  assert.deepEqual(missing.metadata?.headers, plainResponseHeaders)

  const failed = await invokeStream({
    events: [],
    event: event({ runId: "run-1", userId: "user-1" }),
    getError: new Error("AccessDeniedException: arn:aws:logs:us-east-1:111111111111:log-group:secret")
  })
  assert.equal(failed.metadata?.statusCode, 500)
  assert.deepEqual(failed.metadata?.headers, plainResponseHeaders)
  assert.equal(failed.body, "Internal server error")
  assert.doesNotMatch(failed.body, /AccessDeniedException|arn:aws|secret/)

  const streamFailed = await invokeStream({
    run,
    events: [],
    event: event({ runId: "run-1", userId: "user-1" }),
    listError: new Error("AccessDeniedException: arn:aws:logs:us-east-1:111111111111:log-group:secret")
  })
  assert.equal(streamFailed.metadata?.statusCode, 200)
  assert.match(streamFailed.body, /event: error/)
  assert.match(streamFailed.body, /Internal server error/)
  assert.doesNotMatch(streamFailed.body, /AccessDeniedException|arn:aws|secret/)

  const missingRunId = await invokeStream({
    events: [],
    event: event({ runId: "", userId: "user-1" })
  })
  assert.equal(missingRunId.metadata?.statusCode, 400)
  assert.deepEqual(missingRunId.metadata?.headers, plainResponseHeaders)

  const arrayGroupsAndLastEventId = await invokeStream({
    run,
    events: [
      {
        runId: "run-1",
        seq: 3,
        type: "error",
        stage: "failed",
        message: "failed",
        createdAt: "2026-05-04T00:00:03.000Z"
      }
    ],
    event: event({ runId: "run-1", userId: "user-1", groups: ["CHAT_USER"], groupClaimFormat: "array", headers: { "Last-Event-ID": "2" } })
  })
  assert.equal(arrayGroupsAndLastEventId.metadata?.statusCode, 200)
  assert.match(arrayGroupsAndLastEventId.body, /id: 3/)
  assert.match(arrayGroupsAndLastEventId.body, /event: error/)

  const lowercaseLastEventId = await invokeStream({
    run,
    events: [
      {
        runId: "run-1",
        seq: 4,
        type: "final",
        stage: "done",
        message: "done",
        createdAt: "2026-05-04T00:00:04.000Z"
      }
    ],
    event: event({ runId: "run-1", userId: "user-1", headers: { "last-event-id": "3" } })
  })
  assert.equal(lowercaseLastEventId.metadata?.statusCode, 200)
  assert.match(lowercaseLastEventId.body, /id: 4/)

  const invalidLastEventId = await invokeStream({
    run,
    events: [
      {
        runId: "run-1",
        seq: 1,
        type: "final",
        stage: "done",
        message: "done",
        createdAt: "2026-05-04T00:00:01.000Z"
      }
    ],
    event: event({ runId: "run-1", userId: "user-1", headers: { "Last-Event-ID": "not-a-number" } })
  })
  assert.equal(invalidLastEventId.metadata?.statusCode, 200)
  assert.match(invalidLastEventId.body, /id: 1/)

  const noClaims = await invokeStream({
    run,
    events: [],
    event: event({ runId: "run-1", userId: "", claims: false })
  })
  assert.equal(noClaims.metadata?.statusCode, 403)
  assert.deepEqual(noClaims.metadata?.headers, plainResponseHeaders)
})

async function invokeStream({
  run,
  events,
  event,
  getError,
  listError
}: {
  run?: ChatRun
  events: ChatRunEvent[]
  event: APIGatewayProxyEvent
  getError?: Error
  listError?: Error
}) {
  const output = {
    metadata: undefined as { statusCode: number; headers: Record<string, string> } | undefined,
    body: "",
    ended: false
  }
  const responseStream = {
    write: (chunk: string) => {
      output.body += chunk
      return true
    },
    end: () => {
      output.ended = true
    }
  } as NodeJS.WritableStream
  const runtime = {
    streamifyResponse: (inner: (event: APIGatewayProxyEvent, responseStream: NodeJS.WritableStream) => Promise<void>) => inner,
    HttpResponseStream: {
      from: (stream: NodeJS.WritableStream, metadata: { statusCode: number; headers: Record<string, string> }) => {
        output.metadata = metadata
        return stream
      }
    }
  }
  const handler = createChatRunEventsStreamHandler(runtime, {
    chatRunStore: {
      async create(input) {
        return input
      },
      async get() {
        if (getError) throw getError
        return run
      },
      async update(_runId, input) {
        return { ...(run as ChatRun), ...input }
      }
    },
    chatRunEventStore: {
      async append(input) {
        return { ...input, seq: 1, createdAt: "2026-05-04T00:00:00.000Z" }
      },
      async listAfter() {
        if (listError) throw listError
        return events
      }
    }
  }) as (event: APIGatewayProxyEvent, responseStream: NodeJS.WritableStream) => Promise<void>

  await handler(event, responseStream)
  return output
}

function event({
  runId,
  userId,
  groups = ["CHAT_USER"],
  groupClaimFormat = "csv",
  headers,
  claims = true
}: {
  runId: string
  userId: string
  groups?: string[]
  groupClaimFormat?: "array" | "csv"
  headers?: Record<string, string> | undefined
  claims?: boolean
}): APIGatewayProxyEvent {
  return {
    headers,
    pathParameters: { runId },
    requestContext: {
      authorizer: claims
        ? {
            claims: {
              sub: userId,
              "cognito:groups": groupClaimFormat === "array" ? groups : groups.join(",")
            }
          }
        : undefined
    }
  } as unknown as APIGatewayProxyEvent
}
