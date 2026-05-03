import type { APIGatewayProxyEvent } from "aws-lambda"
import { createDependencies } from "./dependencies.js"
import { getPermissionsForGroups } from "./authorization.js"
import type { JsonValue } from "./types.js"

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

export const handler = awslambda.streamifyResponse(async (event, responseStream) => {
  let stream: NodeJS.WritableStream | undefined
  try {
    const runId = event.pathParameters?.runId
    if (!runId) {
      writePlainResponse(responseStream, 400, "runId is required")
      return
    }

    const run = await deps.chatRunStore.get(runId)
    if (!run) {
      writePlainResponse(responseStream, 404, "Chat run not found")
      return
    }

    const claims = (event.requestContext.authorizer as { claims?: Record<string, unknown> } | undefined)?.claims ?? {}
    const userId = claims.sub ? String(claims.sub) : ""
    const groups = parseGroups(claims["cognito:groups"])
    const canReadAll = getPermissionsForGroups(groups).includes("chat:admin:read_all")
    if (run.createdBy !== userId && !canReadAll) {
      writePlainResponse(responseStream, 403, "Forbidden")
      return
    }

    stream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive"
      }
    })

    const lastEventId = Number(event.headers?.["Last-Event-ID"] ?? event.headers?.["last-event-id"] ?? 0)
    let afterSeq = Number.isFinite(lastEventId) ? lastEventId : 0
    const deadline = Date.now() + 14 * 60 * 1000
    let lastHeartbeat = 0

    while (Date.now() < deadline) {
      const events = await deps.chatRunEventStore.listAfter(runId, afterSeq)
      for (const item of events) {
        send(stream, item.type, item.seq, item.data ?? { stage: item.stage, message: item.message })
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
    if (stream) {
      send(stream, "error", undefined, {
        message: err instanceof Error ? err.message : String(err)
      })
    } else {
      writePlainResponse(responseStream, 500, err instanceof Error ? err.message : String(err))
    }
  } finally {
    stream?.end()
  }
})

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

function writePlainResponse(responseStream: NodeJS.WritableStream, statusCode: number, message: string) {
  const stream = awslambda.HttpResponseStream.from(responseStream, {
    statusCode,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache"
    }
  })
  stream.write(message)
  stream.end()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
