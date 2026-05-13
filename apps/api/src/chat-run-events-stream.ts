import type { APIGatewayProxyEvent } from "aws-lambda"
import { createDependencies } from "./dependencies.js"
import { getPermissionsForGroups } from "./authorization.js"
import type { ChatRunEvent, JsonValue } from "./types.js"

declare const awslambda: {
  streamifyResponse: (handler: (event: APIGatewayProxyEvent, responseStream: NodeJS.WritableStream) => Promise<void>) => unknown
  HttpResponseStream: {
    from: (
      stream: NodeJS.WritableStream,
      metadata: { statusCode: number; headers: Record<string, string> }
    ) => NodeJS.WritableStream
  }
}

const deps = createDependencies()

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Last-Event-ID",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
}

export const streamResponseHeaders = {
  ...corsHeaders,
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive"
}

export const plainResponseHeaders = {
  ...corsHeaders,
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-cache"
}

type ChatRunEventsStreamDependencies = Pick<typeof deps, "chatRunStore" | "chatRunEventStore">
type LambdaStreamingRuntime = typeof awslambda

export function createChatRunEventsStreamHandler(runtime: LambdaStreamingRuntime, streamDeps: ChatRunEventsStreamDependencies) {
  return runtime.streamifyResponse(async (event, responseStream) => {
    let stream: NodeJS.WritableStream | undefined
    try {
      const runId = event.pathParameters?.runId
      if (!runId) {
        writePlainResponse(runtime, responseStream, 400, "runId is required")
        return
      }

      const run = await streamDeps.chatRunStore.get(runId)
      if (!run) {
        writePlainResponse(runtime, responseStream, 404, "Chat run not found")
        return
      }

      const claims = (event.requestContext.authorizer as { claims?: Record<string, unknown> } | undefined)?.claims ?? {}
      const userId = claims.sub ? String(claims.sub) : ""
      const groups = parseGroups(claims["cognito:groups"])
      const permissions = getPermissionsForGroups(groups)
      const canReadOwn = permissions.includes("chat:read:own")
      const canReadAll = permissions.includes("chat:admin:read_all")
      if ((!canReadOwn && !canReadAll) || (run.createdBy !== userId && !canReadAll)) {
        writePlainResponse(runtime, responseStream, 403, "Forbidden")
        return
      }

      stream = runtime.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: streamResponseHeaders
      })

      const lastEventId = Number(event.headers?.["Last-Event-ID"] ?? event.headers?.["last-event-id"] ?? 0)
      let afterSeq = Number.isFinite(lastEventId) ? lastEventId : 0
      const deadline = Date.now() + 14 * 60 * 1000
      let lastHeartbeat = 0

      while (Date.now() < deadline) {
        const events = await streamDeps.chatRunEventStore.listAfter(runId, afterSeq)
        for (const item of events) {
          send(stream, item.type, item.seq, eventPayload(item))
          afterSeq = item.seq
          if (item.type === "final" || item.type === "error") return
        }

        if (Date.now() - lastHeartbeat > 15_000) {
          send(stream, "heartbeat", undefined, { ts: new Date().toISOString(), nextSeq: afterSeq + 1 })
          lastHeartbeat = Date.now()
        }

        await sleep(1000)
      }

      send(stream, "timeout", undefined, {
        message: "stream timeout. reconnect with Last-Event-ID.",
        nextSeq: afterSeq + 1
      })
    } catch (err) {
      console.error("Unhandled chat run event stream error", { error: err })
      if (stream) {
        send(stream, "error", undefined, {
          message: "Internal server error"
        })
      } else {
        writePlainResponse(runtime, responseStream, 500, "Internal server error")
      }
    } finally {
      stream?.end()
    }
  })
}

const lambdaRuntime =
  typeof awslambda !== "undefined" &&
  typeof awslambda.streamifyResponse === "function" &&
  typeof awslambda.HttpResponseStream?.from === "function"
    ? awslambda
    : undefined

export const handler = lambdaRuntime ? createChatRunEventsStreamHandler(lambdaRuntime, deps) : undefined

export function eventPayload(item: ChatRunEvent): JsonValue {
  const base: Record<string, JsonValue> = {}
  if (item.stage !== undefined) base.stage = item.stage
  if (item.message !== undefined) base.message = item.message

  if (item.data && typeof item.data === "object" && !Array.isArray(item.data)) {
    return { ...base, ...item.data } as JsonValue
  }

  return item.data === undefined
    ? base
    : { ...base, data: item.data } as JsonValue
}

function send(stream: NodeJS.WritableStream, eventName: string, id: number | undefined, data: JsonValue | Record<string, unknown>) {
  if (id !== undefined) stream.write(`id: ${id}\n`)
  stream.write(`event: ${eventName}\n`)
  stream.write(`data: ${JSON.stringify(data)}\n\n`)
}

function parseGroups(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === "string") return value.split(",").map((group) => group.trim()).filter(Boolean)
  return []
}

function writePlainResponse(runtime: LambdaStreamingRuntime, responseStream: NodeJS.WritableStream, statusCode: number, message: string) {
  const stream = runtime.HttpResponseStream.from(responseStream, {
    statusCode,
    headers: plainResponseHeaders
  })
  stream.write(message)
  stream.end()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
