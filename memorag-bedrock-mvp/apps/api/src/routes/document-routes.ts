import { randomUUID } from "node:crypto"
import { z } from "@hono/zod-openapi"
import { streamSSE } from "hono/streaming"
import { HTTPException } from "hono/http-exception"
import { config } from "../config.js"
import { eventPayload } from "../chat-run-events-stream.js"
import type { AppUser } from "../auth.js"
import { getPermissionsForGroups, hasPermission, requirePermission } from "../authorization.js"
import {
  CreateDocumentGroupRequestSchema,
  CreateDocumentUploadRequestSchema,
  CreateDocumentUploadResponseSchema,
  DeleteDocumentResponseSchema,
  DocumentGroupListResponseSchema,
  DocumentGroupSchema,
  DocumentIngestRunSchema,
  DocumentIngestRunStartResponseSchema,
  DocumentListResponseSchema,
  DocumentManifestSchema,
  DocumentManifestSummarySchema,
  DocumentUploadRequestSchema,
  ErrorResponseSchema,
  IngestUploadedDocumentRequestSchema,
  ReindexMigrationListResponseSchema,
  ReindexMigrationSchema,
  ShareDocumentGroupRequestSchema,
  StartDocumentIngestRunRequestSchema
} from "../schemas.js"
import type { DocumentIngestRun, DocumentListItemSummary, DocumentManifest, DocumentManifestSummary, JsonValue } from "../types.js"
import type { ApiRouteContext } from "./route-context.js"
import { looseRoute, routeAuthorization, sleep } from "./route-utils.js"
import {
  authorizeDocumentDelete,
  authorizeDocumentUpload,
  authorizeUploadedDocumentIngest,
  isBenchmarkSeedUploadedObjectIngest
} from "./benchmark-seed.js"

const uploadObjectKeyPrefix = "uploads"

type UploadPurpose = z.infer<typeof CreateDocumentUploadRequestSchema>["purpose"]

function canReadOwnedRun(user: AppUser, createdBy: string): boolean {
  return createdBy === user.userId || getPermissionsForGroups(user.cognitoGroups).includes("chat:admin:read_all")
}

function canReadDocumentIngestRun(user: AppUser, run: DocumentIngestRun): boolean {
  if (hasPermission(user, "chat:read:own") && canReadOwnedRun(user, run.createdBy)) return true
  return hasPermission(user, "benchmark:seed_corpus")
    && run.createdBy === user.userId
    && run.purpose === "benchmarkSeed"
    && isBenchmarkSeedUploadedObjectIngest(run)
}

function authorizeDocumentUploadSession(user: AppUser, purpose: UploadPurpose) {
  if (purpose === "chatAttachment") {
    if (hasPermission(user, "chat:create")) return
    throw new HTTPException(403, { message: "Forbidden: missing chat:create" })
  }
  if (purpose === "benchmarkSeed") {
    if (hasPermission(user, "benchmark:seed_corpus")) return
    throw new HTTPException(403, { message: "Forbidden: missing benchmark:seed_corpus" })
  }
  if (hasPermission(user, "rag:doc:write:group")) return
  throw new HTTPException(403, { message: "Forbidden: missing rag:doc:write:group" })
}

function buildUploadObjectKey(user: AppUser, purpose: UploadPurpose, fileName: string): string {
  return [
    uploadObjectKeyPrefix,
    purpose === "benchmarkSeed" ? "benchmark-seeds" : purpose === "chatAttachment" ? "chat-attachments" : "documents",
    safeUploadPathSegment(user.userId),
    `${randomUUID()}-${safeUploadFileName(fileName)}`
  ].join("/")
}

function uploadPurposeForKey(user: AppUser, objectKey: string): UploadPurpose {
  const documentPrefix = `${uploadObjectKeyPrefix}/documents/${safeUploadPathSegment(user.userId)}/`
  const benchmarkPrefix = `${uploadObjectKeyPrefix}/benchmark-seeds/${safeUploadPathSegment(user.userId)}/`
  const chatAttachmentPrefix = `${uploadObjectKeyPrefix}/chat-attachments/${safeUploadPathSegment(user.userId)}/`
  if (objectKey.startsWith(documentPrefix)) return "document"
  if (objectKey.startsWith(benchmarkPrefix)) return "benchmarkSeed"
  if (objectKey.startsWith(chatAttachmentPrefix)) return "chatAttachment"
  throw new HTTPException(403, { message: "Forbidden: upload object key is outside the caller scope" })
}

function encodeUploadId(objectKey: string): string {
  return Buffer.from(objectKey, "utf-8").toString("base64url")
}

function decodeUploadId(uploadId: string): string {
  try {
    const objectKey = Buffer.from(uploadId, "base64url").toString("utf-8")
    if (!objectKey.startsWith(`${uploadObjectKeyPrefix}/`) || objectKey.includes("..")) throw new Error("invalid upload object key")
    return objectKey
  } catch {
    throw new HTTPException(400, { message: "Invalid uploadId" })
  }
}

function safeUploadPathSegment(input: string): string {
  return input.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "user"
}

function safeUploadFileName(input: string): string {
  const baseName = input.split(/[\\/]/).filter(Boolean).at(-1) ?? "upload"
  return baseName.replace(/[^A-Za-z0-9._()-]/g, "_").slice(0, 180) || "upload"
}

function localUploadUrl(requestUrl: string, uploadId: string): string {
  const url = new URL(requestUrl)
  url.pathname = `/documents/uploads/${encodeURIComponent(uploadId)}/content`
  url.search = ""
  return url.toString()
}

function documentManifestSummary(manifest: DocumentManifest): DocumentManifestSummary {
  return {
    documentId: manifest.documentId,
    fileName: manifest.fileName,
    mimeType: manifest.mimeType,
    chunkCount: manifest.chunkCount,
    memoryCardCount: manifest.memoryCardCount,
    createdAt: manifest.createdAt,
    lifecycleStatus: manifest.lifecycleStatus,
    activeDocumentId: manifest.activeDocumentId,
    stagedFromDocumentId: manifest.stagedFromDocumentId,
    reindexMigrationId: manifest.reindexMigrationId,
    chunkerVersion: manifest.chunkerVersion,
    sourceExtractorVersion: manifest.sourceExtractorVersion
  }
}

function documentListItemSummary(manifest: DocumentManifest): DocumentListItemSummary {
  return {
    ...documentManifestSummary(manifest),
    metadata: manifest.metadata,
    embeddingModelId: manifest.embeddingModelId,
    embeddingDimensions: manifest.embeddingDimensions
  }
}

async function scopedMetadata(
  service: ApiRouteContext["service"],
  user: AppUser,
  metadata: Record<string, JsonValue> | undefined,
  scope: z.infer<typeof DocumentUploadRequestSchema>["scope"],
  purpose: UploadPurpose = "document"
): Promise<Record<string, JsonValue> | undefined> {
  const base: Record<string, JsonValue> = { ...(metadata ?? {}) }
  if (purpose === "chatAttachment") {
    const temporaryScopeId = scope?.temporaryScopeId
    if (!temporaryScopeId) throw new HTTPException(400, { message: "chatAttachment requires temporaryScopeId" })
    return {
      ...base,
      scopeType: "chat",
      ownerUserId: user.userId,
      allowedUsers: [user.userId, ...(user.email ? [user.email] : [])],
      temporaryScopeId,
      expiresAt: scope?.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }
  }

  if (!scope) return metadata
  const groupIds = scope.groupIds ?? []
  if (scope.scopeType === "group" && groupIds.length === 0) throw new HTTPException(400, { message: "group scope requires non-empty groupIds" })
  if (groupIds.length > 0) await service.assertDocumentGroupsWritable(user, groupIds)
  if (groupIds.length > 0 || scope.scopeType === "group") {
    return { ...base, scopeType: "group", ownerUserId: user.userId, groupIds }
  }
  if (scope.scopeType === "personal") {
    return { ...base, scopeType: "personal", ownerUserId: user.userId, allowedUsers: [user.userId, ...(user.email ? [user.email] : [])] }
  }
  return Object.keys(base).length > 0 ? base : undefined
}

async function authorizeScopedIngest(
  service: ApiRouteContext["service"],
  user: AppUser,
  purpose: UploadPurpose,
  body: z.infer<typeof IngestUploadedDocumentRequestSchema>
) {
  if (purpose === "chatAttachment") {
    if (!hasPermission(user, "chat:create")) throw new HTTPException(403, { message: "Forbidden: missing chat:create" })
    if (body.scope?.scopeType && body.scope.scopeType !== "chat") throw new HTTPException(400, { message: "chatAttachment scopeType must be chat" })
    if (!body.scope?.temporaryScopeId) throw new HTTPException(400, { message: "chatAttachment requires temporaryScopeId" })
    return
  }
  authorizeUploadedDocumentIngest(user, purpose, body)
  await scopedMetadata(service, user, body.metadata, body.scope, purpose)
}

export function registerDocumentRoutes({ app, deps, service }: ApiRouteContext) {
  app.openapi(
    looseRoute({
      method: "get",
      path: "/document-groups",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:doc:read" }),
      responses: {
        200: { description: "List visible document groups", content: { "application/json": { schema: DocumentGroupListResponseSchema } } },
        500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "rag:doc:read")
      return c.json({ groups: await service.listDocumentGroups(user) }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/document-groups",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:group:create" }),
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateDocumentGroupRequestSchema } }
        }
      },
      responses: {
        200: { description: "Created document group", content: { "application/json": { schema: DocumentGroupSchema } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "rag:group:create")
      const body = (c.req as any).valid("json") as z.infer<typeof CreateDocumentGroupRequestSchema>
      return c.json(await service.createDocumentGroup(user, body), 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/document-groups/{groupId}/share",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:group:assign_manager" }),
      request: {
        params: z.object({ groupId: z.string().min(1) }),
        body: {
          required: true,
          content: { "application/json": { schema: ShareDocumentGroupRequestSchema } }
        }
      },
      responses: {
        200: { description: "Updated document group sharing", content: { "application/json": { schema: DocumentGroupSchema } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "rag:group:assign_manager")
      const { groupId } = (c.req as any).valid("param") as { groupId: string }
      const body = (c.req as any).valid("json") as z.infer<typeof ShareDocumentGroupRequestSchema>
      try {
        const group = await service.updateDocumentGroupSharing(user, groupId, body)
        if (!group) return c.json({ error: "Document group not found" }, 404)
        return c.json(group, 200)
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Forbidden:")) throw new HTTPException(403, { message: "Forbidden" })
        throw err
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/documents",
      "x-memorag-authorization": routeAuthorization({ mode: "benchmarkSeedListOrPermission", permission: "rag:doc:read", conditionalPermissions: ["benchmark:seed_corpus"], notes: ["BENCHMARK_RUNNER は benchmark seed 文書の一覧に限定して実行できます。"] }),
      responses: {
        200: {
          description: "List ingested document summaries without full chunk metadata or vector keys",
          content: { "application/json": { schema: DocumentListResponseSchema } }
        },
        500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      if (!hasPermission(user, "rag:doc:read") && !hasPermission(user, "benchmark:seed_corpus")) {
        throw new HTTPException(403, { message: "Forbidden: missing document list permission" })
      }
      const documents = (await service.listDocuments(user)).map(documentListItemSummary)
      return c.json({ documents }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/documents",
      "x-memorag-authorization": routeAuthorization({ mode: "benchmarkSeedOrPermission", permission: "rag:doc:write:group", conditionalPermissions: ["benchmark:seed_corpus"], notes: ["BENCHMARK_RUNNER は benchmark seed 用 upload body の場合だけ実行できます。"] }),
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: DocumentUploadRequestSchema } }
        }
      },
      responses: {
        200: { description: "Ingested document summary. Deprecated for file uploads; use /documents/uploads and /document-ingest-runs for files.", content: { "application/json": { schema: DocumentManifestSummarySchema } } },
        400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
        500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const body = (c.req as any).valid("json") as z.infer<typeof DocumentUploadRequestSchema>
      const user = c.get("user")
      if (!hasPermission(user, "rag:doc:write:group") && !hasPermission(user, "benchmark:seed_corpus")) {
        throw new HTTPException(403, { message: "Forbidden: missing document upload permission" })
      }
      authorizeDocumentUpload(user, body)
      if (!body.text && !body.contentBase64 && !body.textractJson) return c.json({ error: "Either text, contentBase64, or textractJson is required" }, 400)
      const metadata = await scopedMetadata(service, user, body.metadata, body.scope)
      const manifest = await service.ingest({ ...body, metadata })
      return c.json(documentManifestSummary(manifest), 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/documents/uploads",
      "x-memorag-authorization": routeAuthorization({ mode: "documentUploadSession", permission: "rag:doc:write:group", conditionalPermissions: ["chat:create", "benchmark:seed_corpus"], notes: ["purpose=document は rag:doc:write:group、purpose=chatAttachment は chat:create、purpose=benchmarkSeed は benchmark:seed_corpus が必要です。"] }),
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateDocumentUploadRequestSchema } }
        }
      },
      responses: {
        200: { description: "Created document upload URL", content: { "application/json": { schema: CreateDocumentUploadResponseSchema } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      const body = (c.req as any).valid("json") as z.infer<typeof CreateDocumentUploadRequestSchema>
      authorizeDocumentUploadSession(user, body.purpose)
      const objectKey = buildUploadObjectKey(user, body.purpose, body.fileName)
      const uploadId = encodeUploadId(objectKey)
      const contentType = body.mimeType || "application/octet-stream"
      const expiresInSeconds = Math.max(60, config.documentUploadExpiresInSeconds)
      const maxUploadBytes = Math.max(1, config.documentUploadMaxBytes)
      const s3Upload = await deps.objectStore.createUploadUrl?.(objectKey, { contentType, expiresInSeconds, maxBytes: maxUploadBytes })

      return c.json({
        uploadId,
        objectKey,
        uploadUrl: s3Upload?.url ?? localUploadUrl(c.req.url, uploadId),
        method: s3Upload ? "PUT" : "POST",
        headers: s3Upload?.headers ?? { "Content-Type": contentType },
        expiresInSeconds,
        requiresAuth: !s3Upload,
        maxUploadBytes
      }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/documents/uploads/{uploadId}/content",
      "x-memorag-authorization": routeAuthorization({ mode: "documentUploadSession", permission: "rag:doc:write:group", conditionalPermissions: ["chat:create", "benchmark:seed_corpus"], notes: ["uploadId の object key が実行者 scope 外の場合は 403 を返します。"] }),
      request: {
        params: z.object({ uploadId: z.string().min(1) })
      },
      responses: {
        204: { description: "Uploaded document bytes for local development" },
        400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      const { uploadId } = (c.req as any).valid("param") as { uploadId: string }
      const objectKey = decodeUploadId(uploadId)
      const purpose = uploadPurposeForKey(user, objectKey)
      authorizeDocumentUploadSession(user, purpose)
      if (deps.objectStore.createUploadUrl) {
        return c.json({ error: "Local upload content endpoint is disabled when S3 upload URLs are available" }, 400)
      }

      const uploaded = Buffer.from(await c.req.arrayBuffer())
      if (uploaded.length > config.documentUploadMaxBytes) return c.json({ error: `Uploaded object exceeds ${config.documentUploadMaxBytes} bytes` }, 400)
      await deps.objectStore.putBytes(objectKey, uploaded, c.req.header("content-type") ?? undefined)
      return c.body(null, 204)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/documents/uploads/{uploadId}/ingest",
      "x-memorag-authorization": routeAuthorization({ mode: "documentUploadSession", permission: "rag:doc:write:group", conditionalPermissions: ["chat:create", "benchmark:seed_corpus"], notes: ["upload purpose と scope に応じた permission を確認します。"] }),
      request: {
        params: z.object({ uploadId: z.string().min(1) }),
        body: {
          required: true,
          content: { "application/json": { schema: IngestUploadedDocumentRequestSchema } }
        }
      },
      responses: {
        200: { description: "Ingested uploaded document summary without full chunk metadata or vector keys", content: { "application/json": { schema: DocumentManifestSummarySchema } } },
        400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      const { uploadId } = (c.req as any).valid("param") as { uploadId: string }
      const body = (c.req as any).valid("json") as z.infer<typeof IngestUploadedDocumentRequestSchema>
      const objectKey = decodeUploadId(uploadId)
      const purpose = uploadPurposeForKey(user, objectKey)
      await authorizeScopedIngest(service, user, purpose, body)
      const objectSize = await deps.objectStore.getObjectSize(objectKey)
      if (objectSize > config.documentUploadMaxBytes) {
        await deps.objectStore.deleteObject(objectKey)
        return c.json({ error: `Uploaded object exceeds ${config.documentUploadMaxBytes} bytes` }, 400)
      }
      const contentBytes = await deps.objectStore.getBytes(objectKey)
      if (contentBytes.length === 0) return c.json({ error: "Uploaded object is empty" }, 400)

      const sourceS3Object = config.docsBucketName
        ? { bucketName: config.docsBucketName, key: objectKey }
        : undefined
      const metadata = await scopedMetadata(service, user, body.metadata, body.scope, purpose)
      const manifest = await service.ingest({ ...body, metadata, contentBytes, sourceS3Object })
      await deps.objectStore.deleteObject(objectKey)
      return c.json(documentManifestSummary(manifest), 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/document-ingest-runs",
      "x-memorag-authorization": routeAuthorization({ mode: "documentUploadSession", permission: "rag:doc:write:group", conditionalPermissions: ["chat:create", "benchmark:seed_corpus"], notes: ["upload purpose と scope に応じた permission を確認します。"] }),
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: StartDocumentIngestRunRequestSchema } }
        }
      },
      responses: {
        200: { description: "Started asynchronous document ingest run", content: { "application/json": { schema: DocumentIngestRunStartResponseSchema } } },
        400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
        500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      const body = (c.req as any).valid("json") as z.infer<typeof StartDocumentIngestRunRequestSchema>
      const objectKey = decodeUploadId(body.uploadId)
      const purpose = uploadPurposeForKey(user, objectKey)
      await authorizeScopedIngest(service, user, purpose, body)
      const metadata = await scopedMetadata(service, user, body.metadata, body.scope, purpose)
      return c.json(await service.startDocumentIngestRun({ ...body, metadata, objectKey, purpose }, user), 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/document-ingest-runs/{runId}",
      "x-memorag-authorization": routeAuthorization({ mode: "benchmarkSeedRunOrOwnedRun", permission: "chat:read:own", conditionalPermissions: ["benchmark:seed_corpus"], notes: ["chat:read:own は自分が作成した run のみ参照できます。BENCHMARK_RUNNER は自分が作成した benchmark seed run のみ参照できます。"] }),
      request: {
        params: z.object({ runId: z.string().min(1) })
      },
      responses: {
        200: { description: "Document ingest run", content: { "application/json": { schema: DocumentIngestRunSchema } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Document ingest run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      const runId = c.req.param("runId") ?? ""
      const run = await deps.documentIngestRunStore.get(runId)
      if (!run) return c.json({ error: "Document ingest run not found" }, 404)
      if (!canReadDocumentIngestRun(user, run)) return c.json({ error: "Forbidden" }, 403)
      return c.json(run, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/document-ingest-runs/{runId}/events",
      "x-memorag-authorization": routeAuthorization({ mode: "benchmarkSeedRunOrOwnedRun", permission: "chat:read:own", conditionalPermissions: ["benchmark:seed_corpus"], notes: ["chat:read:own は自分が作成した run のみ購読できます。BENCHMARK_RUNNER は自分が作成した benchmark seed run のみ購読できます。"] }),
      request: {
        params: z.object({ runId: z.string().min(1) })
      },
      responses: {
        200: { description: "Asynchronous document ingest run events", content: { "text/event-stream": { schema: z.string() } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Document ingest run not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      const runId = c.req.param("runId") ?? ""
      const run = await deps.documentIngestRunStore.get(runId)
      if (!run) return c.json({ error: "Document ingest run not found" }, 404)
      if (!canReadDocumentIngestRun(user, run)) return c.json({ error: "Forbidden" }, 403)

      return streamSSE(c, async (stream) => {
        const lastEventId = Number(c.req.header("Last-Event-ID") ?? 0)
        let afterSeq = Number.isFinite(lastEventId) ? lastEventId : 0
        const deadline = Date.now() + 14 * 60 * 1000
        let lastHeartbeat = 0

        while (Date.now() < deadline) {
          const events = await deps.documentIngestRunEventStore.listAfter(runId, afterSeq)
          for (const item of events) {
            await stream.writeSSE({
              id: String(item.seq),
              event: item.type,
              data: JSON.stringify(eventPayload(item))
            })
            afterSeq = item.seq
            if (item.type === "final" || item.type === "error") return
          }

          if (Date.now() - lastHeartbeat > 15_000) {
            await stream.writeSSE({
              event: "heartbeat",
              data: JSON.stringify({ ts: new Date().toISOString(), nextSeq: afterSeq + 1 })
            })
            lastHeartbeat = Date.now()
          }

          await sleep(1000)
        }

        await stream.writeSSE({
          event: "timeout",
          data: JSON.stringify({
            message: "stream timeout. reconnect with Last-Event-ID.",
            nextSeq: afterSeq + 1
          })
        })
      })
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/documents/{documentId}/reindex",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:index:rebuild:group" }),
      request: {
        params: z.object({ documentId: z.string().min(1) }),
        body: {
          required: false,
          content: { "application/json": { schema: z.object({ embeddingModelId: z.string().optional(), memoryModelId: z.string().optional() }) } }
        }
      },
      responses: {
        200: { description: "Reindexed document", content: { "application/json": { schema: DocumentManifestSchema } } },
        404: { description: "Document not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "rag:index:rebuild:group")
      const { documentId } = (c.req as any).valid("param") as { documentId: string }
      const body = ((c.req as any).valid("json") ?? {}) as { embeddingModelId?: string; memoryModelId?: string }
      try {
        return c.json(await service.reindexDocument(user, documentId, body), 200)
      } catch (err) {
        if (err instanceof Error && (err.message.includes("ENOENT") || err.message.includes("NoSuchKey"))) return c.json({ error: "Document not found" }, 404)
        throw err
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/documents/reindex-migrations",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:index:rebuild:group" }),
      responses: {
        200: { description: "List blue-green reindex migrations", content: { "application/json": { schema: ReindexMigrationListResponseSchema } } }
      }
    }),
    async (c) => {
      requirePermission(c.get("user"), "rag:index:rebuild:group")
      return c.json({ migrations: await service.listReindexMigrations() }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/documents/{documentId}/reindex/stage",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:index:rebuild:group" }),
      request: {
        params: z.object({ documentId: z.string().min(1) }),
        body: {
          required: false,
          content: { "application/json": { schema: z.object({ embeddingModelId: z.string().optional(), memoryModelId: z.string().optional() }) } }
        }
      },
      responses: {
        200: { description: "Staged reindex migration", content: { "application/json": { schema: ReindexMigrationSchema } } },
        404: { description: "Document not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "rag:index:rebuild:group")
      const { documentId } = (c.req as any).valid("param") as { documentId: string }
      const body = ((c.req as any).valid("json") ?? {}) as { embeddingModelId?: string; memoryModelId?: string }
      try {
        return c.json(await service.stageReindexMigration(user, documentId, body), 200)
      } catch (err) {
        if (err instanceof Error && (err.message.includes("ENOENT") || err.message.includes("NoSuchKey"))) return c.json({ error: "Document not found" }, 404)
        throw err
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/documents/reindex-migrations/{migrationId}/cutover",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:index:rebuild:group" }),
      request: { params: z.object({ migrationId: z.string().min(1) }) },
      responses: {
        200: { description: "Cut over staged reindex migration", content: { "application/json": { schema: ReindexMigrationSchema } } },
        404: { description: "Migration not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      requirePermission(c.get("user"), "rag:index:rebuild:group")
      const { migrationId } = (c.req as any).valid("param") as { migrationId: string }
      try {
        return c.json(await service.cutoverReindexMigration(migrationId), 200)
      } catch (err) {
        if (err instanceof Error && err.message.includes("not found")) return c.json({ error: "Migration not found" }, 404)
        throw err
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/documents/reindex-migrations/{migrationId}/rollback",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:index:rebuild:group" }),
      request: { params: z.object({ migrationId: z.string().min(1) }) },
      responses: {
        200: { description: "Rolled back reindex migration", content: { "application/json": { schema: ReindexMigrationSchema } } },
        404: { description: "Migration not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      requirePermission(c.get("user"), "rag:index:rebuild:group")
      const { migrationId } = (c.req as any).valid("param") as { migrationId: string }
      try {
        return c.json(await service.rollbackReindexMigration(migrationId), 200)
      } catch (err) {
        if (err instanceof Error && err.message.includes("not found")) return c.json({ error: "Migration not found" }, 404)
        throw err
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "delete",
      path: "/documents/{documentId}",
      "x-memorag-authorization": routeAuthorization({ mode: "benchmarkSeedDeleteOrPermission", permission: "rag:doc:delete:group", conditionalPermissions: ["benchmark:seed_corpus"], notes: ["BENCHMARK_RUNNER は benchmark seed 文書だけ削除できます。"] }),
      request: {
        params: z.object({ documentId: z.string().min(1) })
      },
      responses: {
        200: {
          description: "Deleted document",
          content: { "application/json": { schema: DeleteDocumentResponseSchema } }
        },
        404: { description: "Document not found", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      const { documentId } = (c.req as any).valid("param") as { documentId: string }
      try {
        await authorizeDocumentDelete(service, user, documentId)
        return c.json(await service.deleteDocument(documentId), 200)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes("ENOENT") || message.includes("NoSuchKey") || message.includes("NotFound")) {
          return c.json({ error: "Document not found" }, 404)
        }
        throw err
      }
    }
  )
}
