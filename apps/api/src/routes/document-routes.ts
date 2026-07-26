import { randomUUID } from "node:crypto"
import { z } from "@hono/zod-openapi"
import { streamSSE } from "hono/streaming"
import { HTTPException } from "hono/http-exception"
import { config } from "../config.js"
import { eventPayload } from "../chat-run-events-stream.js"
import type { AppUser } from "../auth.js"
import { getPermissionsForGroups, hasPermission, requirePermission } from "../authorization.js"
import { DocumentShareConflictError, DocumentShareValidationError } from "../documents/document-permission-service.js"
import { DocumentMutationConflictError } from "../documents/document-lifecycle-mutation-coordinator.js"
import {
  FolderMoveAuthorizationError,
  FolderMoveConflictError
} from "../folders/folder-lifecycle-mutation-coordinator.js"
import {
  ArchiveFolderRequestSchema,
  ArchiveFolderResponseSchema,
  ApproveSourceGovernanceRequestSchema,
  CreateDocumentGroupRequestSchema,
  CreateDocumentUploadRequestSchema,
  CreateDocumentUploadResponseSchema,
  DeleteDocumentRequestSchema,
  DeleteDocumentResponseSchema,
  DocumentMoveRequestSchema,
  DocumentMoveResponseSchema,
  FolderMoveRequestSchema,
  FolderMoveResponseSchema,
  DocumentShareRequestSchema,
  DocumentShareResponseSchema,
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
  ParsedDocumentPreviewSchema,
  ReindexMigrationListResponseSchema,
  ReindexMigrationSchema,
  ReplaceVersionedFolderPolicyRequestSchema,
  ReplaceVersionedFolderPolicyResponseSchema,
  RestrictSourceGovernanceRequestSchema,
  ResourceUnavailableResponseSchema,
  ShareDocumentGroupRequestSchema,
  StartDocumentIngestRunRequestSchema,
  VersionedFolderPolicyResponseSchema,
  VersionedSourceGovernanceRecordSchema
} from "../schemas.js"
import type { AuthoritativeAdmissionContext, DocumentGroup, DocumentIngestRun, DocumentManifest, DocumentManifestSummary, DocumentQualityProfile, JsonValue } from "../types.js"
import type { ApiRouteContext } from "./route-context.js"
import { looseRoute, routeAuthorization, sleep, validJson, validParam, validQuery } from "./route-utils.js"
import {
  authorizeDocumentDelete,
  authorizeDocumentUpload,
  authorizeUploadedDocumentIngest,
  isBenchmarkSeedDocumentManifest,
  isBenchmarkSeedUpload,
  isBenchmarkSeedUploadedObjectIngest
} from "./benchmark-seed.js"
import { FolderPermissionService, FolderPolicyMutationError } from "../folders/folder-permission-service.js"
import { FolderArchiveError, FolderArchiveService } from "../folders/folder-archive-service.js"
import { createVersionedReference } from "../rag/offline/pre-retrieval/admission/source-admission.js"
import {
  SourceGovernanceConflictError,
  SourceGovernanceDeniedError,
  SourceGovernanceUnavailableError,
  SourceGovernanceValidationError,
  type ApproveSourceGovernanceInput,
  type RestrictSourceGovernanceInput,
  type VersionedSourceGovernanceRecord
} from "../rag/offline/pre-retrieval/admission/source-governance-approval-service.js"
import { BenchmarkEvaluationContextError, resolveBenchmarkEvaluationContext } from "../benchmark/evaluation-context.js"
import {
  ResourceUnavailableError,
  authorizedOnlyPage,
  sanitizeAuthorizedResourceMetadata,
  settleNonEnumerationTiming
} from "../security/public-resource-response.js"
import { isPermissionRevokedError } from "../security/current-worker-authorization.js"
import {
  enforceResolvedResourceOperation,
  resolvedResourceScope
} from "../security/production-resource-operation-authorizer.js"

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

function publicDocumentIngestRun(run: DocumentIngestRun): Omit<DocumentIngestRun, "admissionContext"> {
  const { admissionContext: _internalAdmissionContext, ...publicRun } = run
  return publicRun
}

function publicSourceGovernanceRecord(state: VersionedSourceGovernanceRecord) {
  const { sourceManifestObjectKey: _sourceManifestObjectKey, stagedPublication, ...record } = state.record
  return {
    record: {
      ...record,
      ...(stagedPublication
        ? { stagedPublication: { runId: stagedPublication.runId, candidateDocumentId: stagedPublication.candidateDocumentId } }
        : {})
    },
    version: state.version
  }
}

function authorizeDocumentUploadSession(user: AppUser, purpose: UploadPurpose) {
  if (purpose === "chatAttachment") {
    if (hasPermission(user, "chat:create")) return
    throw new HTTPException(403, { message: "Forbidden" })
  }
  if (purpose === "benchmarkSeed") {
    if (hasPermission(user, "benchmark:seed_corpus")) return
    throw new HTTPException(403, { message: "Forbidden" })
  }
  if (hasPermission(user, "rag:doc:write:group")) return
  throw new HTTPException(403, { message: "Forbidden" })
}

function buildUploadObjectKey(user: AppUser, purpose: UploadPurpose, fileName: string): string {
  return [
    uploadObjectKeyPrefix,
    purpose === "benchmarkSeed" ? "benchmark-seeds" : purpose === "chatAttachment" ? "chat-attachments" : "documents",
    safeUploadPathSegment(uploadTenantId(user, purpose)),
    safeUploadPathSegment(user.userId),
    `${randomUUID()}-${safeUploadFileName(fileName)}`
  ].join("/")
}

function uploadPurposeForKey(user: AppUser, objectKey: string): UploadPurpose {
  const documentPrefix = `${uploadObjectKeyPrefix}/documents/${safeUploadPathSegment(uploadTenantId(user, "document"))}/${safeUploadPathSegment(user.userId)}/`
  const benchmarkPrefix = `${uploadObjectKeyPrefix}/benchmark-seeds/${safeUploadPathSegment(uploadTenantId(user, "benchmarkSeed"))}/${safeUploadPathSegment(user.userId)}/`
  const chatAttachmentPrefix = `${uploadObjectKeyPrefix}/chat-attachments/${safeUploadPathSegment(uploadTenantId(user, "chatAttachment"))}/${safeUploadPathSegment(user.userId)}/`
  if (objectKey.startsWith(documentPrefix)) return "document"
  if (objectKey.startsWith(benchmarkPrefix)) return "benchmarkSeed"
  if (objectKey.startsWith(chatAttachmentPrefix)) return "chatAttachment"
  throw new HTTPException(403, { message: "Forbidden" })
}

function uploadTenantId(user: AppUser, purpose: UploadPurpose): string {
  if (purpose === "benchmarkSeed") {
    if (!config.benchmarkEvaluationEnabled || !config.benchmarkEvaluationTenantId.trim()) {
      throw new HTTPException(503, { message: "Benchmark evaluation is unavailable" })
    }
    return config.benchmarkEvaluationTenantId.trim()
  }
  const tenantId = user.tenantId?.trim() || (!config.authEnabled ? config.localAuthTenantId.trim() : "")
  if (!tenantId) throw new HTTPException(403, { message: "Forbidden" })
  return tenantId
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

const CollectionListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(100),
  cursor: z.string().min(1).max(256).optional()
})

type CollectionListQuery = z.infer<typeof CollectionListQuerySchema>

function documentListItemSummary(manifest: DocumentManifest) {
  const permission = manifest.currentUserEffectivePermission
  if (permission !== "full") {
    return {
      detailLevel: "reader" as const,
      documentId: manifest.documentId,
      fileName: manifest.fileName,
      mimeType: manifest.mimeType,
      createdAt: manifest.createdAt,
      metadata: sanitizeAuthorizedResourceMetadata(manifest.metadata, typeof manifest.metadata?.benchmarkSuiteId === "string" ? "benchmark" : "reader"),
      currentUserEffectivePermission: permission,
      capabilities: manifest.capabilities
    }
  }
  return {
    detailLevel: "manager" as const,
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
    sourceExtractorVersion: manifest.sourceExtractorVersion,
    metadata: manifest.metadata,
    embeddingModelId: manifest.embeddingModelId,
    embeddingDimensions: manifest.embeddingDimensions,
    currentUserEffectivePermission: permission,
    capabilities: manifest.capabilities
  }
}

function documentGroupListItem(group: DocumentGroup) {
  const capabilities = {
    canRead: true,
    canManage: group.effectivePermission === "full"
  }
  if (group.effectivePermission !== "full") {
    return {
      detailLevel: "reader" as const,
      groupId: group.groupId,
      name: group.name,
      description: group.description,
      canonicalPath: group.canonicalPath,
      parentGroupId: group.parentGroupId,
      ancestorGroupIds: group.ancestorGroupIds,
      effectivePermission: group.effectivePermission,
      capabilities
    }
  }
  return { ...group, detailLevel: "manager" as const, effectivePermission: "full" as const, capabilities }
}

function decodeCollectionCursor(cursor: string | undefined): number {
  if (!cursor) return 0
  try {
    const normalized = cursor.replace(/=+$/u, "")
    const decoded = Buffer.from(normalized, "base64url").toString("utf-8")
    if (!/^(0|[1-9][0-9]*)$/u.test(decoded)) throw new Error("invalid cursor payload")
    if (Buffer.from(decoded, "utf-8").toString("base64url") !== normalized) throw new Error("non-canonical cursor")
    const offset = Number(decoded)
    if (!Number.isSafeInteger(offset)) throw new Error("cursor offset overflow")
    return offset
  } catch {
    throw new HTTPException(400, { message: "Invalid cursor" })
  }
}

async function resourceUnavailable(startedAtMs: number): Promise<never> {
  await settleNonEnumerationTiming(startedAtMs)
  throw new ResourceUnavailableError()
}

function extractedTextDownloadFileName(fileName: string): string {
  const leaf = fileName.split(/[\\/]/u).filter(Boolean).at(-1) ?? "document"
  const base = leaf.replace(/\.[^.]+$/u, "").trim() || "document"
  return `${base}.txt`
}

function attachmentContentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7E]/gu, "_").replace(/["\\]/gu, "_")
  const encoded = encodeURIComponent(fileName).replace(/[!'()*]/gu, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

function isForbiddenError(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith("Forbidden")
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

  if (purpose === "document") {
    if (!scope || scope.scopeType !== "group" || !scope.groupIds?.length) {
      throw new HTTPException(400, { message: "document upload requires group scope" })
    }
    await service.assertDocumentGroupsWritable(user, scope.groupIds)
    return { ...base, scopeType: "group", ownerUserId: user.userId, groupIds: scope.groupIds }
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

function authoritativeAdmissionContext(
  user: AppUser,
  metadata: Record<string, JsonValue> | undefined,
  scope: z.infer<typeof DocumentUploadRequestSchema>["scope"],
  purpose: UploadPurpose,
  sourceIdentifier: string
): AuthoritativeAdmissionContext {
  let tenantId = user.tenantId?.trim() ?? ""
  let ownerUserId = user.userId
  let benchmarkQualityProfile: DocumentQualityProfile | undefined
  const temporaryQualityProfile: DocumentQualityProfile | undefined = purpose === "chatAttachment"
    ? {
        knowledgeQualityStatus: "warning",
        verificationStatus: "unverified",
        freshnessStatus: "current",
        supersessionStatus: "current",
        extractionQualityStatus: "high",
        ragEligibility: "eligible_with_warning",
        flags: ["verification_required"]
      }
    : undefined
  if (purpose === "benchmarkSeed") {
    const suiteId = stringValue(metadata?.benchmarkSuiteId)
    if (!suiteId) throw new HTTPException(400, { message: "benchmark suite is required" })
    try {
      const benchmark = resolveBenchmarkEvaluationContext(user, suiteId)
      tenantId = benchmark.subject.tenantId ?? ""
      ownerUserId = benchmark.subject.userId
      benchmarkQualityProfile = {
        knowledgeQualityStatus: "approved",
        verificationStatus: "verified",
        freshnessStatus: "current",
        supersessionStatus: "current",
        extractionQualityStatus: "high",
        ragEligibility: "eligible",
        flags: []
      }
    } catch (error) {
      if (error instanceof BenchmarkEvaluationContextError) {
        throw new HTTPException(error.status, { message: error.message })
      }
      throw error
    }
  }
  const resolvedScope = purpose === "chatAttachment"
    ? {
        scopeType: "chat" as const,
        allowedUsers: [user.userId, ...(user.email ? [user.email] : [])],
        temporaryScopeId: stringValue(metadata?.temporaryScopeId),
        expiresAt: stringValue(metadata?.expiresAt)
      }
    : purpose === "benchmarkSeed"
      ? { scopeType: "benchmark" as const }
      : scope?.scopeType === "group"
        ? { scopeType: "group" as const, groupIds: [...(scope.groupIds ?? [])] }
        : { scopeType: "personal" as const, allowedUsers: [user.userId, ...(user.email ? [user.email] : [])] }
  const authorizationValue: JsonValue = {
    tenantId,
    ownerUserId,
    purpose,
    scope: JSON.parse(JSON.stringify(resolvedScope)) as JsonValue
  }
  const classificationValue: JsonValue = purpose === "benchmarkSeed"
    ? { classification: "benchmark_isolated", tenantId }
    : purpose === "chatAttachment"
      ? { classification: "owner_scoped_temporary_attachment", tenantId }
    : { classification: "unreviewed", tenantId }
  const usagePolicyValue: JsonValue = purpose === "benchmarkSeed"
    ? { allowedPurposes: ["benchmark_evaluation"], externalModelAllowed: true, loggingAllowed: true }
    : purpose === "chatAttachment"
      ? { allowedPurposes: ["normal_rag", "external_model"], externalModelAllowed: true, loggingAllowed: false }
    : { allowedPurposes: [], externalModelAllowed: false, loggingAllowed: false }
  const qualityProfile = benchmarkQualityProfile ?? temporaryQualityProfile
  const qualityValue: JsonValue = qualityProfile
    ? JSON.parse(JSON.stringify(qualityProfile)) as JsonValue
    : { status: "unreviewed" }
  return {
    mode: "authoritative",
    tenantId,
    ownerUserId,
    authorizationRef: createVersionedReference(`authorization:${tenantId}:${ownerUserId}`, "route-scope-v1", authorizationValue),
    classificationRef: createVersionedReference(`classification:${tenantId}:${sourceIdentifier}`, "source-classification-v1", classificationValue),
    usagePolicyRef: createVersionedReference(`usage:${tenantId}:${sourceIdentifier}`, "source-usage-v1", usagePolicyValue),
    qualityRef: createVersionedReference(`quality:${tenantId}:${sourceIdentifier}`, "source-quality-v1", qualityValue),
    lifecycleRef: createVersionedReference(`lifecycle:${sourceIdentifier}`, "ingest-lifecycle-v1", "active"),
    provenanceRef: createVersionedReference(`provenance:${sourceIdentifier}`, "source-route-v1", sourceIdentifier),
    inspectionStatus: purpose === "benchmarkSeed" || purpose === "chatAttachment" ? "passed" : "unknown",
    malwareScan: { status: "unknown" },
    qualityProfile,
    lifecycleStatus: "active",
    scope: resolvedScope
  }
}

function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined
}

async function authorizeScopedIngest(
  service: ApiRouteContext["service"],
  user: AppUser,
  purpose: UploadPurpose,
  body: z.infer<typeof IngestUploadedDocumentRequestSchema>
) {
  if (purpose === "chatAttachment") {
    if (!hasPermission(user, "chat:create")) throw new HTTPException(403, { message: "Forbidden" })
    if (body.scope?.scopeType && body.scope.scopeType !== "chat") throw new HTTPException(400, { message: "chatAttachment scopeType must be chat" })
    if (!body.scope?.temporaryScopeId) throw new HTTPException(400, { message: "chatAttachment requires temporaryScopeId" })
    return
  }
  authorizeUploadedDocumentIngest(user, purpose, body)
  await scopedMetadata(service, user, body.metadata, body.scope, purpose)
}

async function enforceDocumentCreateOperation(
  service: ApiRouteContext["service"],
  user: AppUser,
  purpose: UploadPurpose,
  scope: z.infer<typeof DocumentUploadRequestSchema>["scope"],
  admissionContext: AuthoritativeAdmissionContext
): Promise<void> {
  if (purpose === "chatAttachment") return
  const actor = purpose === "benchmarkSeed"
    ? { ...user, userId: admissionContext.ownerUserId, tenantId: admissionContext.tenantId, accountStatus: "active" as const }
    : user
  const groupIds = scope?.scopeType === "group" ? [...(scope.groupIds ?? [])] : []
  if (groupIds.length > 0) {
    await service.assertDocumentGroupsWritable(actor, groupIds)
    for (const _groupId of groupIds) {
      enforceResolvedResourceOperation(actor, {
        resourceType: "document",
        operation: "create",
        authorizationPath: "destinationFolder",
        resourceScopes: {
          destinationContainer: resolvedResourceScope({ tenantId: admissionContext.tenantId, permission: "full" })
        },
        satisfiedGuards: ["admissionApproved", "authoritativeOwnerConfirmed"]
      })
    }
    return
  }
  enforceResolvedResourceOperation(actor, {
    resourceType: "document",
    operation: "create",
    authorizationPath: "tenantRoot",
    resourceScopes: {
      tenantCreateScope: resolvedResourceScope({ tenantId: admissionContext.tenantId, permission: "full" })
    },
    satisfiedGuards: ["admissionApproved", "authoritativeOwnerConfirmed"]
  })
}

export function registerDocumentRoutes({ app, deps, service }: ApiRouteContext) {
  app.openapi(
    looseRoute({
      method: "get",
      path: "/document-groups",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:doc:read", operationKey: "folder.read", resourceCondition: "documentGroupRead" }),
      request: { query: CollectionListQuerySchema },
      responses: {
        200: { description: "List visible document groups", content: { "application/json": { schema: DocumentGroupListResponseSchema } } },
        400: { description: "Invalid collection cursor", content: { "application/json": { schema: ErrorResponseSchema } } },
        500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "rag:doc:read")
      const query = validQuery<CollectionListQuery>(c)
      const page = authorizedOnlyPage({
        candidates: await service.listDocumentGroups(user),
        authorized: () => true,
        project: documentGroupListItem,
        offset: decodeCollectionCursor(query.cursor),
        limit: query.limit
      })
      return c.json({ groups: page.items, count: page.count, nextCursor: page.nextCursor, responseProfileVersion: page.responseProfileVersion }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/documents/{documentId}/source-governance/restrict",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "rag:source:approve",
        operationKey: "source_governance.restrict",
        resourceCondition: "documentEffectiveFull",
        errorDisclosure: "resource-hidden",
        notes: ["expectedVersion CAS と監査 intent を先に確定し、cleanup 前に current eligibility を deny へ変更します。"]
      }),
      request: {
        params: z.object({ documentId: z.string().min(1) }),
        body: { required: true, content: { "application/json": { schema: RestrictSourceGovernanceRequestSchema } } }
      },
      responses: {
        200: { description: "利用制限を確定した情報源審査状態", content: { "application/json": { schema: VersionedSourceGovernanceRecordSchema } } },
        400: { description: "Invalid governance restriction", content: { "application/json": { schema: ErrorResponseSchema } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Resource unavailable", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } },
        409: { description: "審査 version または状態の競合", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "監査、identity、または情報源審査 store を利用できない", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const user = c.get("user")
      requirePermission(user, "rag:source:approve")
      const { documentId } = validParam<{ documentId: string }>(c)
      const body = validJson<RestrictSourceGovernanceInput>(c)
      try {
        return c.json(publicSourceGovernanceRecord(await service.restrictSourceGovernance(user, documentId, body)), 200)
      } catch (error) {
        if (error instanceof SourceGovernanceValidationError) return c.json({ error: error.message }, 400)
        if (error instanceof SourceGovernanceDeniedError) return resourceUnavailable(startedAtMs)
        if (error instanceof SourceGovernanceConflictError) return c.json({ error: error.message }, 409)
        if (error instanceof SourceGovernanceUnavailableError) return c.json({ error: error.message }, 503)
        if (error instanceof Error && (error.message.includes("ENOENT") || error.message.includes("NoSuchKey"))) {
          return resourceUnavailable(startedAtMs)
        }
        throw error
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/document-groups",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:group:create", operationKey: "folder.create.group", resourceCondition: "documentGroupFull" }),
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateDocumentGroupRequestSchema } }
        }
      },
      responses: {
        200: { description: "Created document group", content: { "application/json": { schema: DocumentGroupSchema } } },
        400: { description: "Invalid document group create request", content: { "application/json": { schema: ErrorResponseSchema } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      requirePermission(user, "rag:group:create")
      const body = validJson<z.infer<typeof CreateDocumentGroupRequestSchema>>(c)
      try {
        return c.json(await service.createDocumentGroup(user, body), 200)
      } catch (err) {
        if (isDocumentGroupInputError(err)) return c.json({ error: (err as Error).message }, 400)
        if (err instanceof Error && err.message.startsWith("Forbidden:")) throw new HTTPException(403, { message: "Forbidden" })
        throw err
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/document-groups/{groupId}/share",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "folder.share",
        operationKey: "folder.share.read",
        resourceCondition: "documentGroupFull",
        errorDisclosure: "resource-hidden",
        notes: ["対象 folder の full permission を再確認し、complete policy と optimistic concurrency version を返します。"]
      }),
      request: { params: z.object({ groupId: z.string().min(1) }) },
      responses: {
        200: { description: "Versioned folder share policy", content: { "application/json": { schema: VersionedFolderPolicyResponseSchema } } },
        404: { description: "Resource unavailable", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } },
        503: { description: "フォルダ共有 policy store を利用できません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const user = c.get("user")
      requirePermission(user, "folder.share")
      const { groupId } = validParam<{ groupId: string }>(c)
      const permissions = new FolderPermissionService(deps)
      try {
        await permissions.assertFolderPermission(user, groupId, "full")
        const state = await permissions.getVersionedFolderPolicy(uploadTenantId(user, "document"), groupId)
        return c.json({ policy: state.policy ?? null, version: state.version }, 200)
      } catch (error) {
        if (error instanceof HTTPException && error.status === 403) return resourceUnavailable(startedAtMs)
        return c.json({ error: "Folder sharing is unavailable" }, 503)
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "put",
      path: "/document-groups/{groupId}/share",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "folder.share",
        operationKey: "folder.share.update",
        resourceCondition: "documentGroupFull",
        errorDisclosure: "resource-hidden",
        notes: ["expectedVersion、complete entries、canonical reason、active same-tenant principal validation、security audit outbox を強制します。"]
      }),
      request: {
        params: z.object({ groupId: z.string().min(1) }),
        body: { required: true, content: { "application/json": { schema: ReplaceVersionedFolderPolicyRequestSchema } } }
      },
      responses: {
        200: { description: "Replaced versioned folder share policy", content: { "application/json": { schema: ReplaceVersionedFolderPolicyResponseSchema } } },
        400: { description: "Invalid complete folder policy", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Resource unavailable", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } },
        409: { description: "Folder share policy version conflict", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "フォルダ共有の依存サービスを利用できません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const user = c.get("user")
      const { groupId } = validParam<{ groupId: string }>(c)
      const body = validJson<z.infer<typeof ReplaceVersionedFolderPolicyRequestSchema>>(c)
      const permissions = new FolderPermissionService(deps)
      try {
        return c.json(await permissions.replaceVersionedFolderPolicy(user, groupId, body), 200)
      } catch (error) {
        if (error instanceof HTTPException && error.status === 403) return resourceUnavailable(startedAtMs)
        if (error instanceof FolderPolicyMutationError) {
          if (error.result === "conflict") return c.json({ error: "Folder share policy version conflict" }, 409)
          if (error.result === "denied") return c.json({ error: error.message }, 400)
          return c.json({ error: "Folder sharing is unavailable" }, 503)
        }
        return c.json({ error: "Folder sharing is unavailable" }, 503)
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/document-groups/{groupId}/share",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:group:assign_manager", operationKey: "folder.settings.update", resourceCondition: "documentGroupFull", errorDisclosure: "resource-hidden", notes: ["legacy compatibility route。name / description だけを更新し、move と共有 ACL fields は受理しません。"] }),
      request: {
        params: z.object({ groupId: z.string().min(1) }),
        body: {
          required: true,
          content: { "application/json": { schema: ShareDocumentGroupRequestSchema } }
        }
      },
      responses: {
        200: { description: "Updated document group settings", content: { "application/json": { schema: DocumentGroupSchema } } },
        400: { description: "Invalid document group update", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Resource unavailable", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const user = c.get("user")
      requirePermission(user, "rag:group:assign_manager")
      const { groupId } = validParam<{ groupId: string }>(c)
      const body = validJson<z.infer<typeof ShareDocumentGroupRequestSchema>>(c)
      try {
        const group = await service.updateDocumentGroupSharing(user, groupId, body)
        if (!group) return resourceUnavailable(startedAtMs)
        return c.json(group, 200)
      } catch (err) {
        if (isDocumentGroupInputError(err)) return c.json({ error: (err as Error).message }, 400)
        if (err instanceof Error && err.message.startsWith("Forbidden:")) return resourceUnavailable(startedAtMs)
        throw err
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/document-groups/{groupId}/move",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "folder.move",
        operationKey: "folder.move",
        resourceCondition: "folderMove",
        errorDisclosure: "resource-hidden",
        notes: ["current active actor、source/destination full、expectedVersion、subtree cycle、hidden projection、path-lock transaction、audit outbox、retry reconciliation を強制します。"]
      }),
      request: {
        params: z.object({ groupId: z.string().min(1) }),
        body: { required: true, content: { "application/json": { schema: FolderMoveRequestSchema } } }
      },
      responses: {
        200: { description: "Moved folder subtree", content: { "application/json": { schema: FolderMoveResponseSchema } } },
        400: { description: "Invalid folder move request", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Resource unavailable", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } },
        409: { description: "Folder move state conflict", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "フォルダ移動 projection の再調整待ち", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const user = c.get("user")
      const { groupId } = validParam<{ groupId: string }>(c)
      const body = validJson<z.infer<typeof FolderMoveRequestSchema>>(c)
      try {
        const result = await service.moveDocumentGroup(user, groupId, body)
        return c.json({
          operationId: result.operationId,
          folder: result.folder,
          subtree: result.subtree,
          affectedDocumentCount: result.affectedDocumentIds.length,
          directDocumentGrantsPreserved: result.directDocumentGrantsPreserved,
          folderLocalPoliciesPreserved: result.folderLocalPoliciesPreserved,
          documentVersionsPreserved: result.documentVersionsPreserved
        }, 200)
      } catch (error) {
        if (error instanceof FolderMoveAuthorizationError) return resourceUnavailable(startedAtMs)
        if (error instanceof FolderMoveConflictError) return c.json({ error: "Folder move conflict" }, 409)
        if (error instanceof Error && /required|canonical|invalid/i.test(error.message)) {
          return c.json({ error: "Invalid folder move request" }, 400)
        }
        return c.json({ error: "Folder move reconciliation pending" }, 503)
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "delete",
      path: "/document-groups/{groupId}",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "folder.delete",
        operationKey: "folder.delete",
        resourceCondition: "documentGroupFull",
        errorDisclosure: "resource-hidden",
        notes: ["current full authority、empty descendant/document impact、expectedVersion CAS、deny-first archive、監査 intent を強制します。"]
      }),
      request: {
        params: z.object({ groupId: z.string().min(1).max(200) }),
        body: { required: true, content: { "application/json": { schema: ArchiveFolderRequestSchema } } }
      },
      responses: {
        200: { description: "archive したフォルダ", content: { "application/json": { schema: ArchiveFolderResponseSchema } } },
        404: { description: "資源を利用できません", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } },
        409: { description: "version または descendant impact の競合", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "フォルダまたは監査 store を利用できません", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const actor = c.get("user")
      const { groupId } = validParam<{ groupId: string }>(c)
      const body = validJson<z.infer<typeof ArchiveFolderRequestSchema>>(c)
      try {
        const folder = await new FolderArchiveService(deps).archive(actor, groupId, body)
        return c.json({ folder }, 200)
      } catch (error) {
        if (error instanceof FolderArchiveError) {
          if (error.result === "denied") return resourceUnavailable(startedAtMs)
          if (error.result === "conflict") return c.json({ error: "Folder archive conflict" }, 409)
        }
        return c.json({ error: "Folder archive unavailable" }, 503)
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/documents",
      "x-memorag-authorization": routeAuthorization({ mode: "benchmarkSeedListOrPermission", permission: "rag:doc:read", conditionalPermissions: ["benchmark:seed_corpus"], operationKey: "document.read", resourceCondition: "benchmarkSeedScope", notes: ["BENCHMARK_RUNNER は benchmark seed 文書の一覧に限定して実行できます。"] }),
      request: { query: CollectionListQuerySchema },
      responses: {
        200: {
          description: "List ingested document summaries without full chunk metadata or vector keys",
          content: { "application/json": { schema: DocumentListResponseSchema } }
        },
        400: { description: "Invalid collection cursor", content: { "application/json": { schema: ErrorResponseSchema } } },
        500: { description: "Server error", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const user = c.get("user")
      if (!hasPermission(user, "rag:doc:read") && !hasPermission(user, "benchmark:seed_corpus")) {
        throw new HTTPException(403, { message: "Forbidden" })
      }
      const query = validQuery<CollectionListQuery>(c)
      const candidates = hasPermission(user, "rag:doc:read")
        ? await service.listDocuments(user)
        : (await service.listBenchmarkDocumentManifests())
          .filter(isBenchmarkSeedDocumentManifest)
          .map((manifest) => ({
            ...manifest,
            currentUserEffectivePermission: "readOnly" as const,
            capabilities: {
              canRead: true,
              canShare: false,
              canMove: false,
              canDelete: false,
              canReindex: false
            }
          }))
      const page = authorizedOnlyPage({
        candidates,
        authorized: () => true,
        project: documentListItemSummary,
        offset: decodeCollectionCursor(query.cursor),
        limit: query.limit
      })
      return c.json({ documents: page.items, count: page.count, nextCursor: page.nextCursor, responseProfileVersion: page.responseProfileVersion }, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/documents/{documentId}/share",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:doc:share", operationKey: "document.share.read", resourceCondition: "documentEffectiveFull", errorDisclosure: "resource-hidden" }),
      request: {
        params: z.object({ documentId: z.string().min(1) })
      },
      responses: {
        200: { description: "Document share grants with the current policy version", content: { "application/json": { schema: DocumentShareResponseSchema } } },
        404: { description: "Resource unavailable", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const user = c.get("user")
      requirePermission(user, "rag:doc:share")
      const { documentId } = validParam<{ documentId: string }>(c)
      try {
        return c.json(await service.getDocumentShareInfo(user, documentId), 200)
      } catch (err) {
        if (isForbiddenError(err)) return resourceUnavailable(startedAtMs)
        if (err instanceof Error && (err.message.includes("ENOENT") || err.message.includes("NoSuchKey"))) return resourceUnavailable(startedAtMs)
        throw err
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "put",
      path: "/documents/{documentId}/share",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:doc:share", operationKey: "document.share.update", resourceCondition: "documentEffectiveFull", errorDisclosure: "resource-hidden" }),
      request: {
        params: z.object({ documentId: z.string().min(1) }),
        body: {
          required: true,
          content: { "application/json": { schema: DocumentShareRequestSchema } }
        }
      },
      responses: {
        200: { description: "Updated document share grants with the new policy version", content: { "application/json": { schema: DocumentShareResponseSchema } } },
        400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
        409: { description: "Document share update conflict", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Resource unavailable", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const user = c.get("user")
      const { documentId } = validParam<{ documentId: string }>(c)
      const body = validJson<z.infer<typeof DocumentShareRequestSchema>>(c)
      try {
        return c.json(await service.updateDocumentShare(user, documentId, body), 200)
      } catch (err) {
        if (err instanceof DocumentShareValidationError) return c.json({ error: err.message }, 400)
        if (err instanceof DocumentShareConflictError) return c.json({ error: err.message }, 409)
        if (isForbiddenError(err)) return resourceUnavailable(startedAtMs)
        if (err instanceof Error && (err.message.includes("ENOENT") || err.message.includes("NoSuchKey"))) return resourceUnavailable(startedAtMs)
        throw err
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/documents/{documentId}/move",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:doc:move", operationKey: "document.move", resourceCondition: "documentMove", errorDisclosure: "resource-hidden" }),
      request: {
        params: z.object({ documentId: z.string().min(1) }),
        body: {
          required: true,
          content: { "application/json": { schema: DocumentMoveRequestSchema } }
        }
      },
      responses: {
        200: { description: "Moved document", content: { "application/json": { schema: DocumentMoveResponseSchema } } },
        400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Resource unavailable", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } },
        409: { description: "Conflict", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const user = c.get("user")
      const { documentId } = validParam<{ documentId: string }>(c)
      const body = validJson<z.infer<typeof DocumentMoveRequestSchema>>(c)
      try {
        return c.json(await service.moveDocument(user, documentId, body), 200)
      } catch (err) {
        if (err instanceof Error && (err.message.includes("required"))) return c.json({ error: err.message }, 400)
        if (isForbiddenError(err)) return resourceUnavailable(startedAtMs)
        if (err instanceof Error && (err.message.includes("Destination folder not found") || err.message.includes("ENOENT") || err.message.includes("NoSuchKey"))) return resourceUnavailable(startedAtMs)
        if (err instanceof DocumentMutationConflictError || err instanceof Error && (err.message.includes("changed before move") || err.message.includes("same file name"))) return c.json({ error: err.message }, 409)
        throw err
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/documents",
      "x-memorag-authorization": routeAuthorization({ mode: "benchmarkSeedOrPermission", permission: "rag:doc:write:group", conditionalPermissions: ["benchmark:seed_corpus"], operationKey: "document.upload", resourceCondition: "benchmarkSeedScope", notes: ["BENCHMARK_RUNNER は benchmark seed 用 upload body の場合だけ実行できます。"] }),
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
      const body = validJson<z.infer<typeof DocumentUploadRequestSchema>>(c)
      const user = c.get("user")
      if (!hasPermission(user, "rag:doc:write:group") && !hasPermission(user, "benchmark:seed_corpus")) {
        throw new HTTPException(403, { message: "Forbidden" })
      }
      authorizeDocumentUpload(user, body)
      if (!body.text && !body.contentBase64 && !body.textractJson) return c.json({ error: "Either text, contentBase64, or textractJson is required" }, 400)
      const purpose: UploadPurpose = isBenchmarkSeedUpload(body) ? "benchmarkSeed" : "document"
      const metadata = await scopedMetadata(service, user, body.metadata, body.scope, purpose)
      const admissionContext = authoritativeAdmissionContext(user, metadata, body.scope, purpose, `inline:${body.fileName}`)
      await enforceDocumentCreateOperation(service, user, purpose, body.scope, admissionContext)
      const currentAuthorization = service.createCurrentDocumentIngestAuthorization({
        actor: user,
        admissionContext,
        purpose,
        operationId: `sync-inline-ingest:${randomUUID()}`
      })
      await currentAuthorization.authorizeStart()
      await currentAuthorization.authorizeProtectedRead()
      let manifest: DocumentManifest | undefined
      try {
        manifest = await service.ingest({ ...body, metadata, admissionContext, currentAuthorization: currentAuthorization.currentAuthorization })
        await currentAuthorization.currentAuthorization.authorizeDurableCommit()
        if (purpose === "document") await service.registerSourceGovernance(manifest)
        return c.json(documentManifestSummary(manifest), 200)
      } catch (error) {
        if (manifest) await service.discardUncommittedIngest(manifest)
        if (isPermissionRevokedError(error)) throw new HTTPException(403, { message: "Forbidden" })
        throw error
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/documents/uploads",
      "x-memorag-authorization": routeAuthorization({ mode: "documentUploadSession", permission: "rag:doc:write:group", conditionalPermissions: ["chat:create", "benchmark:seed_corpus"], operationKey: "document.upload_session.create", resourceCondition: "documentUploadSession", notes: ["purpose=document は rag:doc:write:group、purpose=chatAttachment は chat:create、purpose=benchmarkSeed は benchmark:seed_corpus が必要です。"] }),
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
      const body = validJson<z.infer<typeof CreateDocumentUploadRequestSchema>>(c)
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
        method: s3Upload ? "PUT" as const : "POST" as const,
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
      const { uploadId } = validParam<{ uploadId: string }>(c)
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
      const { uploadId } = validParam<{ uploadId: string }>(c)
      const body = validJson<z.infer<typeof IngestUploadedDocumentRequestSchema>>(c)
      const objectKey = decodeUploadId(uploadId)
      const purpose = uploadPurposeForKey(user, objectKey)
      await authorizeScopedIngest(service, user, purpose, body)
      const metadata = await scopedMetadata(service, user, body.metadata, body.scope, purpose)
      const admissionContext = authoritativeAdmissionContext(user, metadata, body.scope, purpose, objectKey)
      await enforceDocumentCreateOperation(service, user, purpose, body.scope, admissionContext)
      const currentAuthorization = service.createCurrentDocumentIngestAuthorization({
        actor: user,
        admissionContext,
        purpose,
        operationId: `sync-upload-ingest:${randomUUID()}`
      })
      await currentAuthorization.authorizeStart()
      const objectSize = await deps.objectStore.getObjectSize(objectKey)
      if (objectSize > config.documentUploadMaxBytes) {
        await currentAuthorization.currentAuthorization.authorizeExternalSideEffect()
        await deps.objectStore.deleteObject(objectKey)
        return c.json({ error: `Uploaded object exceeds ${config.documentUploadMaxBytes} bytes` }, 400)
      }
      await currentAuthorization.authorizeProtectedRead()
      const contentBytes = await deps.objectStore.getBytes(objectKey)
      if (contentBytes.length === 0) return c.json({ error: "Uploaded object is empty" }, 400)

      const sourceS3Object = config.docsBucketName
        ? { bucketName: config.docsBucketName, key: objectKey }
        : undefined
      let manifest: DocumentManifest | undefined
      try {
        manifest = await service.ingest({
          ...body,
          metadata,
          contentBytes,
          sourceS3Object,
          admissionContext,
          currentAuthorization: currentAuthorization.currentAuthorization
        })
        await currentAuthorization.currentAuthorization.authorizeDurableCommit()
        if (purpose === "document") await service.registerSourceGovernance(manifest)
        await currentAuthorization.currentAuthorization.authorizeExternalSideEffect()
        await deps.objectStore.deleteObject(objectKey)
        return c.json(documentManifestSummary(manifest), 200)
      } catch (error) {
        if (manifest) await service.discardUncommittedIngest(manifest)
        if (isPermissionRevokedError(error)) throw new HTTPException(403, { message: "Forbidden" })
        throw error
      }
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
      const body = validJson<z.infer<typeof StartDocumentIngestRunRequestSchema>>(c)
      const objectKey = decodeUploadId(body.uploadId)
      const purpose = uploadPurposeForKey(user, objectKey)
      await authorizeScopedIngest(service, user, purpose, body)
      const metadata = await scopedMetadata(service, user, body.metadata, body.scope, purpose)
      const admissionContext = authoritativeAdmissionContext(user, metadata, body.scope, purpose, objectKey)
      await enforceDocumentCreateOperation(service, user, purpose, body.scope, admissionContext)
      return c.json(await service.startDocumentIngestRun({ ...body, metadata, admissionContext, objectKey, purpose }, user), 200)
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
      const lookupStartedAt = Date.now()
      const user = c.get("user")
      const runId = c.req.param("runId") ?? ""
      const tenantId = uploadTenantId(user, "document")
      const run = await deps.documentIngestRunStore.get(tenantId, runId)
      if (!run || !canReadDocumentIngestRun(user, run)) return resourceUnavailable(lookupStartedAt)
      return c.json(publicDocumentIngestRun(run), 200)
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
      const lookupStartedAt = Date.now()
      const user = c.get("user")
      const runId = c.req.param("runId") ?? ""
      const tenantId = uploadTenantId(user, "document")
      const run = await deps.documentIngestRunStore.get(tenantId, runId)
      if (!run || !canReadDocumentIngestRun(user, run)) return resourceUnavailable(lookupStartedAt)

      return streamSSE(c, async (stream) => {
        const lastEventId = Number(c.req.header("Last-Event-ID") ?? 0)
        let afterSeq = Number.isFinite(lastEventId) ? lastEventId : 0
        const deadline = Date.now() + 14 * 60 * 1000
        let lastHeartbeat = 0

        while (Date.now() < deadline) {
          const events = await deps.documentIngestRunEventStore.listAfter(tenantId, runId, afterSeq)
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
      method: "get",
      path: "/documents/{documentId}/source-governance",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "rag:source:approve",
        operationKey: "source_governance.read",
        resourceCondition: "documentEffectiveFull",
        errorDisclosure: "resource-hidden",
        notes: ["現行 actor と対象文書の同一 tenant/full permission を service で再確認します。"]
      }),
      request: { params: z.object({ documentId: z.string().min(1) }) },
      responses: {
        200: { description: "version 付き情報源審査状態", content: { "application/json": { schema: VersionedSourceGovernanceRecordSchema } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Resource unavailable", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } },
        503: { description: "現行 identity または情報源審査 store を利用できない", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const user = c.get("user")
      requirePermission(user, "rag:source:approve")
      const { documentId } = validParam<{ documentId: string }>(c)
      try {
        return c.json(publicSourceGovernanceRecord(await service.getSourceGovernance(user, documentId)), 200)
      } catch (error) {
        if (error instanceof SourceGovernanceDeniedError) return resourceUnavailable(startedAtMs)
        if (error instanceof SourceGovernanceUnavailableError) return c.json({ error: error.message }, 503)
        if (error instanceof Error && (error.message.includes("ENOENT") || error.message.includes("NoSuchKey"))) {
          return resourceUnavailable(startedAtMs)
        }
        throw error
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/documents/{documentId}/source-governance/approve",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "rag:source:approve",
        operationKey: "source_governance.approve_publish",
        resourceCondition: "documentEffectiveFull",
        errorDisclosure: "resource-hidden",
        notes: ["expectedVersion CAS、現行 actor/tenant/full permission、audit outbox、approved-only staged publish を強制します。"]
      }),
      request: {
        params: z.object({ documentId: z.string().min(1) }),
        body: { required: true, content: { "application/json": { schema: ApproveSourceGovernanceRequestSchema } } }
      },
      responses: {
        200: { description: "承認・公開済み情報源審査状態", content: { "application/json": { schema: VersionedSourceGovernanceRecordSchema } } },
        400: { description: "Invalid governance profile", content: { "application/json": { schema: ErrorResponseSchema } } },
        403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Resource unavailable", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } },
        409: { description: "審査 version または状態の競合", content: { "application/json": { schema: ErrorResponseSchema } } },
        503: { description: "監査、identity、staging、または公開処理を利用できない", content: { "application/json": { schema: ErrorResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const user = c.get("user")
      requirePermission(user, "rag:source:approve")
      const { documentId } = validParam<{ documentId: string }>(c)
      const body = validJson<ApproveSourceGovernanceInput>(c)
      try {
        return c.json(publicSourceGovernanceRecord(await service.approveSourceGovernance(user, documentId, body)), 200)
      } catch (error) {
        if (error instanceof SourceGovernanceValidationError) return c.json({ error: error.message }, 400)
        if (error instanceof SourceGovernanceDeniedError) return resourceUnavailable(startedAtMs)
        if (error instanceof SourceGovernanceConflictError) return c.json({ error: error.message }, 409)
        if (error instanceof SourceGovernanceUnavailableError) return c.json({ error: error.message }, 503)
        if (error instanceof Error && (error.message.includes("ENOENT") || error.message.includes("NoSuchKey"))) {
          return resourceUnavailable(startedAtMs)
        }
        throw error
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/documents/{documentId}/reindex",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:index:rebuild:group", operationKey: "document.reindex", resourceCondition: "documentGroupFull", errorDisclosure: "resource-hidden" }),
      request: {
        params: z.object({ documentId: z.string().min(1) }),
        body: {
          required: false,
          content: { "application/json": { schema: z.object({ embeddingModelId: z.string().optional(), memoryModelId: z.string().optional() }) } }
        }
      },
      responses: {
        200: { description: "Reindexed document", content: { "application/json": { schema: DocumentManifestSchema } } },
        404: { description: "Resource unavailable", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const user = c.get("user")
      requirePermission(user, "rag:index:rebuild:group")
      const { documentId } = validParam<{ documentId: string }>(c)
      const body = (validJson<{ embeddingModelId?: string; memoryModelId?: string } | undefined>(c) ?? {})
      try {
        return c.json(await service.reindexDocument(user, documentId, body), 200)
      } catch (err) {
        if (isForbiddenError(err)) return resourceUnavailable(startedAtMs)
        if (err instanceof Error && (err.message.includes("ENOENT") || err.message.includes("NoSuchKey"))) return resourceUnavailable(startedAtMs)
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
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:index:rebuild:group", operationKey: "document.reindex.stage", resourceCondition: "documentGroupFull", errorDisclosure: "resource-hidden" }),
      request: {
        params: z.object({ documentId: z.string().min(1) }),
        body: {
          required: false,
          content: { "application/json": { schema: z.object({ embeddingModelId: z.string().optional(), memoryModelId: z.string().optional() }) } }
        }
      },
      responses: {
        200: { description: "Staged reindex migration", content: { "application/json": { schema: ReindexMigrationSchema } } },
        404: { description: "Resource unavailable", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const user = c.get("user")
      requirePermission(user, "rag:index:rebuild:group")
      const { documentId } = validParam<{ documentId: string }>(c)
      const body = (validJson<{ embeddingModelId?: string; memoryModelId?: string } | undefined>(c) ?? {})
      try {
        return c.json(await service.stageReindexMigration(user, documentId, body), 200)
      } catch (err) {
        if (isForbiddenError(err)) return resourceUnavailable(startedAtMs)
        if (err instanceof Error && (err.message.includes("ENOENT") || err.message.includes("NoSuchKey"))) return resourceUnavailable(startedAtMs)
        throw err
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/documents/reindex-migrations/{migrationId}/cutover",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:index:rebuild:group", operationKey: "document.reindex.cutover", resourceCondition: "documentGroupFull", errorDisclosure: "resource-hidden" }),
      request: { params: z.object({ migrationId: z.string().min(1) }) },
      responses: {
        200: { description: "Cut over staged reindex migration", content: { "application/json": { schema: ReindexMigrationSchema } } },
        404: { description: "Resource unavailable", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const user = c.get("user")
      requirePermission(user, "rag:index:rebuild:group")
      const { migrationId } = validParam<{ migrationId: string }>(c)
      try {
        return c.json(await service.cutoverReindexMigration(user, migrationId), 200)
      } catch (err) {
        if (isForbiddenError(err)) return resourceUnavailable(startedAtMs)
        if (err instanceof Error && err.message.includes("not found")) return resourceUnavailable(startedAtMs)
        throw err
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "post",
      path: "/documents/reindex-migrations/{migrationId}/rollback",
      "x-memorag-authorization": routeAuthorization({ mode: "required", permission: "rag:index:rebuild:group", operationKey: "document.reindex.rollback", resourceCondition: "documentGroupFull", errorDisclosure: "resource-hidden" }),
      request: { params: z.object({ migrationId: z.string().min(1) }) },
      responses: {
        200: { description: "Rolled back reindex migration", content: { "application/json": { schema: ReindexMigrationSchema } } },
        404: { description: "Resource unavailable", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const user = c.get("user")
      requirePermission(user, "rag:index:rebuild:group")
      const { migrationId } = validParam<{ migrationId: string }>(c)
      try {
        return c.json(await service.rollbackReindexMigration(user, migrationId), 200)
      } catch (err) {
        if (isForbiddenError(err)) return resourceUnavailable(startedAtMs)
        if (err instanceof Error && err.message.includes("not found")) return resourceUnavailable(startedAtMs)
        throw err
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/documents/{documentId}/extracted-text",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "rag:doc:read",
        operationKey: "document.extracted_text.download",
        resourceCondition: "documentGroupRead",
        errorDisclosure: "resource-hidden",
        notes: ["現行 actor、現行 publication pointer、active lifecycle、現行 document permission を取得時に再評価し、抽出済み本文だけを返します。"]
      }),
      request: {
        params: z.object({ documentId: z.string().min(1) })
      },
      responses: {
        200: { description: "Download the currently authorized extracted document text", content: { "text/plain": { schema: z.string() } } },
        404: { description: "Resource unavailable", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const user = c.get("user")
      requirePermission(user, "rag:doc:read")
      const { documentId } = validParam<{ documentId: string }>(c)
      const download = await service.getDocumentExtractedText(user, documentId)
      if (!download) return resourceUnavailable(startedAtMs)
      const fileName = extractedTextDownloadFileName(download.fileName)
      c.header("cache-control", "no-store")
      c.header("content-disposition", attachmentContentDisposition(fileName))
      c.header("content-type", "text/plain; charset=utf-8")
      c.header("x-content-type-options", "nosniff")
      return c.body(download.text, 200)
    }
  )

  app.openapi(
    looseRoute({
      method: "get",
      path: "/documents/{documentId}/parsed-preview",
      "x-memorag-authorization": routeAuthorization({
        mode: "required",
        permission: "rag:doc:read",
        operationKey: "document.parsed_preview.read",
        resourceCondition: "documentGroupRead",
        errorDisclosure: "resource-hidden",
        notes: ["ParsedDocument preview は caller が読める文書に限定し、全文・vector key・raw object key は返しません。"]
      }),
      request: {
        params: z.object({ documentId: z.string().min(1) })
      },
      responses: {
        200: { description: "Get parsed document preview metadata", content: { "application/json": { schema: ParsedDocumentPreviewSchema } } },
        404: { description: "Resource unavailable", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const user = c.get("user")
      requirePermission(user, "rag:doc:read")
      const { documentId } = validParam<{ documentId: string }>(c)
      try {
        const preview = await service.getParsedDocumentPreview(user, documentId)
        if (!preview) return resourceUnavailable(startedAtMs)
        return c.json(preview, 200)
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Forbidden")) return resourceUnavailable(startedAtMs)
        throw err
      }
    }
  )

  app.openapi(
    looseRoute({
      method: "delete",
      path: "/documents/{documentId}",
      "x-memorag-authorization": routeAuthorization({ mode: "benchmarkSeedDeleteOrPermission", permission: "rag:doc:delete:group", conditionalPermissions: ["benchmark:seed_corpus"], errorDisclosure: "resource-hidden", notes: ["BENCHMARK_RUNNER は benchmark seed 文書だけ削除できます。"] }),
      request: {
        params: z.object({ documentId: z.string().min(1) }),
        body: {
          required: true,
          content: { "application/json": { schema: DeleteDocumentRequestSchema } }
        }
      },
      responses: {
        200: {
          description: "Deleted document",
          content: { "application/json": { schema: DeleteDocumentResponseSchema } }
        },
        400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
        409: { description: "Document version conflict", content: { "application/json": { schema: ErrorResponseSchema } } },
        404: { description: "Resource unavailable", content: { "application/json": { schema: ResourceUnavailableResponseSchema } } }
      }
    }),
    async (c) => {
      const startedAtMs = Date.now()
      const user = c.get("user")
      const { documentId } = validParam<{ documentId: string }>(c)
      const body = validJson<z.infer<typeof DeleteDocumentRequestSchema>>(c)
      try {
        await authorizeDocumentDelete(service, user, documentId)
        let authorizationActor = user
        let auditActorId: string | undefined
        if (!hasPermission(user, "rag:doc:delete:group")) {
          const manifest = await service.getBenchmarkDocumentManifest(documentId)
          const tenantId = stringValue(manifest.metadata?.tenantId)
          const ownerUserId = stringValue(manifest.metadata?.ownerUserId)
          if (!tenantId || !ownerUserId) throw new HTTPException(403, { message: "Forbidden" })
          // Resource metadata is an authorization subject only. The durable
          // audit/tombstone attribution remains the verified runner identity.
          authorizationActor = { ...user, tenantId, userId: ownerUserId }
          auditActorId = user.userId
        }
        return c.json(await service.deleteDocument(
          authorizationActor,
          documentId,
          body,
          auditActorId ? { auditActorId } : undefined
        ), 200)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (isForbiddenError(err) || err instanceof HTTPException && err.status === 403) return resourceUnavailable(startedAtMs)
        if (message.includes("ENOENT") || message.includes("NoSuchKey") || message.includes("NotFound")) return resourceUnavailable(startedAtMs)
        if (err instanceof DocumentMutationConflictError) return c.json({ error: err.message }, 409)
        throw err
      }
    }
  )
}

function isDocumentGroupInputError(err: unknown): boolean {
  return err instanceof Error && [
    "Document group canonical path already exists",
    "Document group name is required",
    "Document group name contains unsupported characters",
    "Parent document group not found",
    "Document group subtree is too large for synchronous path update"
  ].includes(err.message)
}
