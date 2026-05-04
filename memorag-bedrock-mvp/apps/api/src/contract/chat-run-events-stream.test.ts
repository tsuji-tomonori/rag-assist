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

  const missing = await invokeStream({
    events: [],
    event: event({ runId: "missing", userId: "user-1" })
  })
  assert.equal(missing.metadata?.statusCode, 404)
  assert.deepEqual(missing.metadata?.headers, plainResponseHeaders)

  const failed = await invokeStream({
    events: [],
    event: event({ runId: "run-1", userId: "user-1" }),
    getError: new Error("store unavailable")
  })
  assert.equal(failed.metadata?.statusCode, 500)
  assert.deepEqual(failed.metadata?.headers, plainResponseHeaders)
})

async function invokeStream({
  run,
  events,
  event,
  getError
}: {
  run?: ChatRun
  events: ChatRunEvent[]
  event: APIGatewayProxyEvent
  getError?: Error
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
        return events
      }
    }
  }) as (event: APIGatewayProxyEvent, responseStream: NodeJS.WritableStream) => Promise<void>

  await handler(event, responseStream)
  return output
}

function event({ runId, userId }: { runId: string; userId: string }): APIGatewayProxyEvent {
  return {
    headers: {},
    pathParameters: { runId },
    requestContext: {
      authorizer: {
        claims: {
          sub: userId,
          "cognito:groups": "CHAT_USER"
        }
      }
    }
  } as unknown as APIGatewayProxyEvent
}
