import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { ROLE_PERMISSION_CATALOG } from "@memorag-mvp/contract/access-control"
import app from "../app.js"
import type { Permission, RouteAuthorizationMode } from "../authorization.js"

const appSourcePath = path.resolve(process.cwd(), "src/app.ts")
const routeSourceDir = path.resolve(process.cwd(), "src/routes")
const accessControlCatalogPath = path.resolve(process.cwd(), "../../packages/contract/src/access-control.ts")

const publicMiddlewarePaths = ["/health", "/openapi.json"]

type RoutePolicy = {
  method: string
  path: string
  mode: RouteAuthorizationMode
  permission?: Permission
  operationKey?: string
  resourceCondition?: string
  errorDisclosure?: string
}

const operationMatrixSubset = new Map<string, { operationKey: string; resourceCondition: string }>([
  ["POST /chat", { operationKey: "chat.send", resourceCondition: "documentGroupRead" }],
  ["POST /chat-runs", { operationKey: "chat.run.start", resourceCondition: "documentGroupRead" }],
  ["GET /chat-runs/{runId}/events", { operationKey: "chat.run.events.read", resourceCondition: "ownedRun" }],
  ["GET /chat-tools", { operationKey: "chat_tool.registry.read", resourceCondition: "none" }],
  ["GET /chat-tool-invocations", { operationKey: "chat_tool.invocation.read", resourceCondition: "ownedRun" }],
  ["POST /search", { operationKey: "document.search", resourceCondition: "documentGroupRead" }],
  ["GET /conversation-history", { operationKey: "history.read.self", resourceCondition: "self" }],
  ["GET /conversation-history/{id}", { operationKey: "history.read.self", resourceCondition: "self" }],
  ["POST /questions", { operationKey: "support.ticket.create.self", resourceCondition: "self" }],
  ["GET /questions/{questionId}", { operationKey: "support.ticket.read", resourceCondition: "requester" }],
  ["POST /questions/{questionId}/search-improvement-candidates", { operationKey: "search_improvement.candidate.create", resourceCondition: "none" }],
  ["POST /questions/{questionId}/resolve", { operationKey: "support.ticket.close", resourceCondition: "requester" }],
  ["GET /document-groups", { operationKey: "folder.read", resourceCondition: "documentGroupRead" }],
  ["POST /document-groups", { operationKey: "folder.create.group", resourceCondition: "documentGroupFull" }],
  ["GET /document-groups/{groupId}/share", { operationKey: "folder.share.read", resourceCondition: "documentGroupFull" }],
  ["PUT /document-groups/{groupId}/share", { operationKey: "folder.share.update", resourceCondition: "documentGroupFull" }],
  ["POST /document-groups/{groupId}/share", { operationKey: "folder.settings.update", resourceCondition: "documentGroupFull" }],
  ["POST /document-groups/{groupId}/move", { operationKey: "folder.move", resourceCondition: "folderMove" }],
  ["DELETE /document-groups/{groupId}", { operationKey: "folder.delete", resourceCondition: "documentGroupFull" }],
  ["GET /resource-groups", { operationKey: "resourceGroup.read", resourceCondition: "resourceGroupFull" }],
  ["POST /resource-groups", { operationKey: "resourceGroup.create", resourceCondition: "resourceGroupFull" }],
  ["GET /resource-groups/{groupId}", { operationKey: "resourceGroup.read", resourceCondition: "resourceGroupFull" }],
  ["PUT /resource-groups/{groupId}", { operationKey: "resourceGroup.update", resourceCondition: "resourceGroupFull" }],
  ["DELETE /resource-groups/{groupId}", { operationKey: "resourceGroup.delete", resourceCondition: "resourceGroupFull" }],
  ["POST /resource-groups/{groupId}/move", { operationKey: "resourceGroup.move", resourceCondition: "resourceGroupFull" }],
  ["POST /resource-groups/{groupId}/share", { operationKey: "resourceGroup.share", resourceCondition: "resourceGroupFull" }],
  ["GET /resource-groups/{groupId}/memberships", { operationKey: "resource_group.membership.read", resourceCondition: "resourceGroupFull" }],
  ["PUT /resource-groups/{groupId}/memberships", { operationKey: "resource_group.membership.replace", resourceCondition: "resourceGroupFull" }],
  ["GET /documents", { operationKey: "document.read", resourceCondition: "benchmarkSeedScope" }],
  ["GET /documents/{documentId}/share", { operationKey: "document.share.read", resourceCondition: "documentEffectiveFull" }],
  ["PUT /documents/{documentId}/share", { operationKey: "document.share.update", resourceCondition: "documentEffectiveFull" }],
  ["POST /documents/{documentId}/move", { operationKey: "document.move", resourceCondition: "documentMove" }],
  ["GET /documents/{documentId}/extracted-text", { operationKey: "document.extracted_text.download", resourceCondition: "documentGroupRead" }],
  ["GET /documents/{documentId}/parsed-preview", { operationKey: "document.parsed_preview.read", resourceCondition: "documentGroupRead" }],
  ["GET /documents/{documentId}/source-governance", { operationKey: "source_governance.read", resourceCondition: "documentEffectiveFull" }],
  ["POST /documents/{documentId}/source-governance/approve", { operationKey: "source_governance.approve_publish", resourceCondition: "documentEffectiveFull" }],
  ["POST /documents/{documentId}/source-governance/restrict", { operationKey: "source_governance.restrict", resourceCondition: "documentEffectiveFull" }],
  ["POST /documents", { operationKey: "document.upload", resourceCondition: "benchmarkSeedScope" }],
  ["POST /documents/{documentId}/reindex", { operationKey: "document.reindex", resourceCondition: "documentGroupFull" }],
  ["POST /documents/{documentId}/reindex/stage", { operationKey: "document.reindex.stage", resourceCondition: "documentGroupFull" }],
  ["POST /documents/reindex-migrations/{migrationId}/cutover", { operationKey: "document.reindex.cutover", resourceCondition: "documentGroupFull" }],
  ["POST /documents/reindex-migrations/{migrationId}/rollback", { operationKey: "document.reindex.rollback", resourceCondition: "documentGroupFull" }],
  ["POST /admin/audit-log/export", { operationKey: "audit.export", resourceCondition: "none" }],
  ["POST /admin/usage/export", { operationKey: "usage.export", resourceCondition: "none" }],
  ["GET /admin/aliases", { operationKey: "alias.read", resourceCondition: "tenantCollection" }],
  ["POST /admin/aliases", { operationKey: "alias.create", resourceCondition: "tenantCollection" }],
  ["POST /admin/aliases/{aliasId}/update", { operationKey: "alias.update", resourceCondition: "tenantCollection" }],
  ["POST /admin/aliases/{aliasId}/review", { operationKey: "alias.review", resourceCondition: "tenantCollection" }],
  ["POST /admin/aliases/{aliasId}/transition", { operationKey: "alias.transition", resourceCondition: "tenantCollection" }],
  ["POST /admin/aliases/{aliasId}/disable", { operationKey: "alias.disable", resourceCondition: "tenantCollection" }],
  ["POST /admin/aliases/publish", { operationKey: "alias.publish", resourceCondition: "tenantCollection" }],
  ["GET /admin/aliases/audit-log", { operationKey: "alias.audit.read", resourceCondition: "tenantCollection" }],
  ["GET /admin/quality-actions", { operationKey: "quality.action.read", resourceCondition: "documentGroupRead" }],
  ["POST /admin/costs/export", { operationKey: "cost.export", resourceCondition: "none" }],
  ["GET /admin/users/{userId}/deletion-preflight", { operationKey: "user.delete.preflight", resourceCondition: "adminManagedUser" }],
  ["POST /admin/users/{userId}/administrative-principal-transfer", { operationKey: "administrative_principal.transfer", resourceCondition: "adminManagedUser" }],
  ["POST /documents/uploads", { operationKey: "document.upload_session.create", resourceCondition: "documentUploadSession" }],
  ["POST /benchmark/query", { operationKey: "benchmark.query", resourceCondition: "benchmarkEvaluationScope" }],
  ["POST /benchmark/search", { operationKey: "benchmark.search", resourceCondition: "benchmarkEvaluationScope" }],
  ["POST /benchmark-runs", { operationKey: "benchmark.run", resourceCondition: "documentGroupRead" }],
  ["GET /benchmark-runs", { operationKey: "benchmark.run.read", resourceCondition: "tenantCollection" }],
  ["GET /benchmark-runs/{runId}", { operationKey: "benchmark.run.read", resourceCondition: "tenantRun" }],
  ["POST /benchmark-runs/{runId}/cancel", { operationKey: "benchmark.run.cancel", resourceCondition: "tenantRun" }],
  ["POST /benchmark-runs/{runId}/download", { operationKey: "benchmark.artifact.download", resourceCondition: "tenantRun" }],
  ["GET /benchmark-runs/{runId}/logs", { operationKey: "benchmark.artifact.download", resourceCondition: "tenantRun" }],
  ["POST /admin/users/{userId}/roles", { operationKey: "role.assign", resourceCondition: "roleAssignment" }]
])

const auditedMutationDelegations = new Map<string, RegExp>([
  ["PUT /document-groups/{groupId}/share", /replaceVersionedFolderPolicy/],
  ["POST /document-groups/{groupId}/move", /moveDocumentGroup/],
  ["DELETE /document-groups/{groupId}", /FolderArchiveService[\s\S]*?\.archive/],
  ["PUT /documents/{documentId}/share", /updateDocumentShare/],
  ["POST /documents/{documentId}/move", /moveDocument/],
  ["POST /resource-groups", /lifecycleService\(deps\)\.create/],
  ["PUT /resource-groups/{groupId}", /lifecycleService\(deps\)\.update/],
  ["DELETE /resource-groups/{groupId}", /lifecycleService\(deps\)\.delete/],
  ["POST /resource-groups/{groupId}/move", /assertMoveUnsupported/],
  ["POST /resource-groups/{groupId}/share", /assertShareUnsupported/],
  ["PUT /resource-groups/{groupId}/memberships", /replaceResourceGroupMemberships/]
])

const debugRoutePermissions = new Map<string, { permission: Permission; conditional?: Permission; operationKey: string }>([
  ["GET /debug-runs", { permission: "chat:admin:read_all", operationKey: "debug.trace.read.sanitized" }],
  ["GET /debug-runs/{runId}", { permission: "chat:admin:read_all", operationKey: "debug.trace.read.sanitized" }],
  ["POST /debug-runs/{runId}/replay-plan", { permission: "chat:admin:read_all", conditional: "debug:replay", operationKey: "debug.trace.replay_plan" }],
  ["POST /debug-runs/{runId}/download", { permission: "chat:admin:read_all", conditional: "debug:trace:export", operationKey: "debug.trace.export" }]
])

test("auth middleware uses a public allowlist instead of protected path enumeration", async () => {
  const source = await readRouteSources()
  const middlewareBlock = findAuthMiddlewareBlock(source)

  for (const publicPath of publicMiddlewarePaths) {
    assert.match(
      middlewareBlock,
      new RegExp(`["']${escapeRegex(publicPath)}["']`),
      `${publicPath} must stay in the explicit public allowlist`
    )
  }
  assert.doesNotMatch(middlewareBlock, /protectedApiPaths/, "protected path enumeration must not return")
  assert.match(middlewareBlock, /publicApiPaths\.has\(c\.req\.path\)/, "auth middleware must bypass only publicApiPaths")
  assert.match(middlewareBlock, /return authMiddleware\(c, next\)/, "non-public paths must reach authMiddleware")
})

test("public allowlist, CORS, and preflight preserve the 14D middleware boundary", async () => {
  const source = await readRouteSources()
  const middlewareBlock = findAuthMiddlewareBlock(source)

  assert.deepEqual(publicMiddlewarePaths, ["/health", "/openapi.json"])
  assert.match(middlewareBlock, /c\.req\.method === ["']OPTIONS["']/, "OPTIONS preflight must bypass auth before protected route handling")
  assert.match(middlewareBlock, /allowHeaders:\s*\[[^\]]*["']Last-Event-ID["'][^\]]*\]/, "CORS must continue to allow Last-Event-ID for SSE reconnect")
  assert.doesNotMatch(middlewareBlock, /["']\/debug-runs["']/, "debug routes must not be added to the public allowlist")

  const configSource = await readFile(path.resolve(process.cwd(), "src/config.ts"), "utf8")
  assert.doesNotMatch(configSource, /CORS_ALLOWED_ORIGINS must not include \* in production/, "production config must temporarily allow wildcard CORS origins")
  assert.match(configSource, /csvEnv\("CORS_ALLOWED_ORIGINS",\s*isProduction \? \[\] : \["\*"\]\)/, "production must still require explicit CORS origins")
})

test("protected API routes keep route-level checks or delegate audited mutations to the canonical service boundary", async () => {
  const source = await readRouteSources()
  const documentLifecycleSource = await readFile(
    path.resolve(process.cwd(), "src/documents/document-lifecycle-mutation-coordinator.ts"),
    "utf8"
  )
  const routePolicies = (await openApiRoutePolicies()).filter((policy) => policy.mode !== "public")

  for (const policy of routePolicies) {
    const block = findRouteBlock(source, policy)
    if (policy.mode === "authenticated") {
      assert.doesNotMatch(
        block,
        /requirePermission|hasPermission/,
        `${policy.method.toUpperCase()} ${policy.path} must remain authenticated-only without extra role checks`
      )
      continue
    }
    assert.ok(policy.permission, `${policy.method.toUpperCase()} ${policy.path} must declare a permission`)
    const auditedDelegation = auditedMutationDelegations.get(routeKey(policy))
    if (auditedDelegation) {
      assert.match(
        block,
        auditedDelegation,
        `${policy.method.toUpperCase()} ${policy.path} must delegate to its audited canonical mutation boundary`
      )
      assert.doesNotMatch(
        block,
        new RegExp(`requirePermission\\([\\s\\S]*?["']${escapeRegex(policy.permission)}["']\\)`),
        `${policy.method.toUpperCase()} ${policy.path} must let the mutation boundary audit feature denial before returning`
      )
      continue
    }
    if (policy.mode === "requesterOrPermission") {
      assert.match(
        block,
        new RegExp(`hasPermission\\([\\s\\S]*?["']${escapeRegex(policy.permission)}["']\\)`),
        `${policy.method.toUpperCase()} ${policy.path} must allow ${policy.permission}`
      )
      assert.match(
        block,
        /requesterUserId[\s\S]*?user\.userId/,
        `${policy.method.toUpperCase()} ${policy.path} must check requester ownership`
      )
    } else if (policy.mode === "benchmarkSeedOrPermission") {
      assert.match(
        block,
        new RegExp(`hasPermission\\([\\s\\S]*?["']${escapeRegex(policy.permission)}["']\\)`),
        `${policy.method.toUpperCase()} ${policy.path} must allow ${policy.permission}`
      )
      assert.match(
        block,
        /benchmark:seed_corpus[\s\S]*?authorizeDocumentUpload/,
        `${policy.method.toUpperCase()} ${policy.path} must restrict benchmark seed uploads`
      )
    } else if (policy.mode === "benchmarkSeedListOrPermission") {
      assert.match(
        block,
        new RegExp(`hasPermission\\([\\s\\S]*?["']${escapeRegex(policy.permission)}["']\\)`),
        `${policy.method.toUpperCase()} ${policy.path} must allow ${policy.permission}`
      )
      assert.match(
        block,
        /benchmark:seed_corpus[\s\S]*?listDocuments/,
        `${policy.method.toUpperCase()} ${policy.path} must only allow benchmark seed document listing`
      )
    } else if (policy.mode === "benchmarkSeedDeleteOrPermission") {
      assert.match(
        block,
        /authorizeDocumentDelete\(service,\s*user,\s*documentId\)[\s\S]*?deleteDocument\([\s\S]*?authorizationActor,[\s\S]*?documentId,[\s\S]*?body,[\s\S]*?auditActorId/,
        `${policy.method.toUpperCase()} ${policy.path} must use scoped delete authorization`
      )
      assert.match(
        block,
        /authorizationActor\s*=\s*\{\s*\.\.\.user,\s*tenantId,\s*userId:\s*ownerUserId\s*\}[\s\S]*?auditActorId\s*=\s*user\.userId/,
        `${policy.method.toUpperCase()} ${policy.path} must separate the resource authorization subject from verified audit attribution`
      )
      assert.doesNotMatch(
        block,
        /auditActorId\s*=\s*ownerUserId/,
        `${policy.method.toUpperCase()} ${policy.path} must not attribute the mutation to resource metadata`
      )
      assert.match(
        documentLifecycleSource,
        new RegExp(`authorizeDelete\\([\\s\\S]*?hasPermission\\([\\s\\S]*?["']${escapeRegex(policy.permission)}["']\\)`),
        `${policy.method.toUpperCase()} ${policy.path} must allow ${policy.permission}`
      )
      assert.match(
        documentLifecycleSource,
        /authorizeDelete[\s\S]*?benchmark:seed_corpus[\s\S]*?isBenchmarkSeedManifest/,
        `${policy.method.toUpperCase()} ${policy.path} must restrict benchmark seed deletes to the target manifest`
      )
    } else if (policy.mode === "documentUploadSession") {
      assert.match(
        block,
        /authorizeDocumentUploadSession|authorizeUploadedDocumentIngest|authorizeScopedIngest/,
        `${policy.method.toUpperCase()} ${policy.path} must use scoped upload-session authorization`
      )
    } else if (policy.mode === "ownedRun") {
      assert.match(
        block,
        new RegExp(`requirePermission\\([\\s\\S]*?["']${escapeRegex(policy.permission)}["']\\)`),
        `${policy.method.toUpperCase()} ${policy.path} must require ${policy.permission}`
      )
      assert.match(
        block,
        /canReadOwnedRun[\s\S]*?createdBy|createdBy[\s\S]*?user\.userId/,
        `${policy.method.toUpperCase()} ${policy.path} must check run ownership`
      )
    } else if (policy.mode === "benchmarkSeedRunOrOwnedRun") {
      assert.match(
        block,
        /canReadDocumentIngestRun[\s\S]*?run/,
        `${policy.method.toUpperCase()} ${policy.path} must use scoped document ingest run authorization`
      )
      assert.match(
        source,
        new RegExp(`function canReadDocumentIngestRun[\\s\\S]*?hasPermission\\([\\s\\S]*?["']${escapeRegex(policy.permission)}["']\\)`),
        `${policy.method.toUpperCase()} ${policy.path} must preserve ${policy.permission} for owned document ingest runs`
      )
      assert.match(
        source,
        /function canReadDocumentIngestRun[\s\S]*?benchmark:seed_corpus[\s\S]*?purpose === "benchmarkSeed"[\s\S]*?isBenchmarkSeedUploadedObjectIngest/,
        `${policy.method.toUpperCase()} ${policy.path} must restrict BENCHMARK_RUNNER reads to isolated benchmark seed runs`
      )
    } else {
      assert.match(
        block,
        new RegExp(`requirePermission\\([\\s\\S]*?["']${escapeRegex(policy.permission)}["']\\)`),
        `${policy.method.toUpperCase()} ${policy.path} must require ${policy.permission}`
      )
    }
  }
})

test("document group create and legacy settings routes reject embedded ACL authority", async () => {
  const source = await readRouteSources()
  const createRouteBlock = findRouteBlock(source, {
    method: "post",
    path: "/document-groups",
    mode: "required",
    permission: "rag:group:create"
  })
  assert.doesNotMatch(createRouteBlock, /documentGroupHasLegacyExplicitPolicy/u)

  const schemaSource = await readFile(path.resolve(process.cwd(), "src/schemas.ts"), "utf8")
  const createSchemaStart = schemaSource.indexOf("export const CreateDocumentGroupRequestSchema")
  const legacySchemaStart = schemaSource.indexOf("export const ShareDocumentGroupRequestSchema", createSchemaStart)
  const legacySchemaEnd = schemaSource.indexOf("export const DocumentManifestSummarySchema", legacySchemaStart)
  assert.notEqual(createSchemaStart, -1)
  assert.notEqual(legacySchemaStart, -1)
  assert.notEqual(legacySchemaEnd, -1)
  const createSchemaBlock = schemaSource.slice(createSchemaStart, legacySchemaStart)
  const legacySchemaBlock = schemaSource.slice(legacySchemaStart, legacySchemaEnd)
  assert.match(createSchemaBlock, /\.strict\(\)/u)
  assert.match(legacySchemaBlock, /name:[\s\S]*description:[\s\S]*\.strict\(\)/u)
  for (const field of ["adminPrincipalType", "adminPrincipalId", "visibility", "sharedUserIds", "sharedGroups", "managerUserIds"]) {
    assert.doesNotMatch(createSchemaBlock, new RegExp(`\\b${field}:`), `create schema must reject ${field}`)
    assert.doesNotMatch(legacySchemaBlock, new RegExp(`\\b${field}:`), `legacy settings schema must reject ${field}`)
  }
  assert.doesNotMatch(legacySchemaBlock, /\bparentGroupId:/u, "legacy settings schema must reject parentGroupId")

  const serviceSource = await readFile(path.resolve(process.cwd(), "src/rag/memorag-service.ts"), "utf8")
  const createServiceStart = serviceSource.indexOf("async createDocumentGroup(")
  const createServiceEnd = serviceSource.indexOf("async updateDocumentGroupSharing(", createServiceStart)
  const createServiceBlock = serviceSource.slice(createServiceStart, createServiceEnd)
  assert.match(createServiceBlock, /adminPrincipalType:\s*["']user["']/u)
  assert.match(createServiceBlock, /visibility:\s*["']private["']/u)
  assert.doesNotMatch(createServiceBlock, /SYSTEM_ADMIN|cognitoGroups|input\.adminPrincipal/u)
})

test("protected API routes must be explicitly reviewed before they change", async () => {
  const source = await readRouteSources()
  const documentedProtectedRoutes = (await openApiRoutePolicies())
    .filter((policy) => policy.mode !== "public")
    .map(routeKey)
    .sort()

  const actualProtectedRoutes = extractRoutes(source)
    .filter((route) => !publicMiddlewarePaths.includes(route.path))
    .map(routeKey)
    .sort()

  assert.deepEqual(actualProtectedRoutes, documentedProtectedRoutes)
})

test("question routes must be explicitly reviewed before they change", async () => {
  const source = await readRouteSources()
  const expectedQuestionRoutes = (await openApiRoutePolicies())
    .filter((policy) => policy.path.startsWith("/questions"))
    .map(routeKey)
    .sort()

  const actualQuestionRoutes = extractRoutes(source)
    .filter((route) => route.path.startsWith("/questions"))
    .map(routeKey)
    .sort()

  assert.deepEqual(actualQuestionRoutes, expectedQuestionRoutes)
})

test("protected API routes document authorization metadata and auth error responses in OpenAPI", async () => {
  const policies = await openApiRoutePolicies()

  for (const policy of policies) {
    const operation = policy.operation
    assert.ok(operation["x-memorag-authorization"], `${policy.method.toUpperCase()} ${policy.path} must document x-memorag-authorization`)
    if (policy.mode !== "public") {
      assert.ok(operation.responses?.["401"], `${policy.method.toUpperCase()} ${policy.path} must document 401`)
    }
    if (policy.mode !== "public" && policy.mode !== "authenticated") {
      assert.ok(operation.responses?.["403"], `${policy.method.toUpperCase()} ${policy.path} must document 403`)
    }
  }
})

test("protected API routes document three-layer authorization metadata", async () => {
  const policies = await openApiRoutePolicies()
  const resourceHiddenRoutes = new Set([
    "GET /conversation-history/{id}",
    "GET /document-groups/{groupId}/share",
    "PUT /document-groups/{groupId}/share",
    "POST /document-groups/{groupId}/share",
    "POST /document-groups/{groupId}/move",
    "DELETE /document-groups/{groupId}",
    "GET /resource-groups/{groupId}",
    "PUT /resource-groups/{groupId}",
    "DELETE /resource-groups/{groupId}",
    "POST /resource-groups/{groupId}/move",
    "POST /resource-groups/{groupId}/share",
    "GET /documents/{documentId}/share",
    "PUT /documents/{documentId}/share",
    "POST /documents/{documentId}/move",
    "GET /documents/{documentId}/extracted-text",
    "GET /documents/{documentId}/parsed-preview",
    "GET /documents/{documentId}/source-governance",
    "POST /documents/{documentId}/source-governance/approve",
    "POST /documents/{documentId}/source-governance/restrict",
    "POST /documents/{documentId}/reindex",
    "POST /documents/{documentId}/reindex/stage",
    "POST /documents/reindex-migrations/{migrationId}/cutover",
    "POST /documents/reindex-migrations/{migrationId}/rollback",
    "DELETE /documents/{documentId}",
    "GET /benchmark-runs/{runId}",
    "POST /benchmark-runs/{runId}/cancel",
    "POST /benchmark-runs/{runId}/download",
    "GET /benchmark-runs/{runId}/logs"
  ])

  for (const policy of policies) {
    const route = routeKey(policy)
    const auth = policy.operation["x-memorag-authorization"]
    if (policy.mode !== "public") {
      assert.ok(auth?.resourceCondition, `${route} must document resourceCondition`)
      assert.ok(auth?.errorDisclosure, `${route} must document errorDisclosure`)
      if (policy.mode !== "authenticated") {
        assert.equal(
          auth.errorDisclosure,
          resourceHiddenRoutes.has(route) ? "resource-hidden" : "generic",
          `${route} must use its reviewed public error disclosure profile`
        )
      }
    }

    const expected = operationMatrixSubset.get(route)
    if (!expected) continue
    assert.equal(auth?.operationKey, expected.operationKey, `${route} must document operationKey`)
    assert.equal(auth?.resourceCondition, expected.resourceCondition, `${route} must document resourceCondition from chapter 20 subset`)
  }
})

test("document share update documents conflict response in OpenAPI", async () => {
  const response = await app.request("/openapi.json")
  assert.equal(response.status, 200)
  const document = await response.json() as {
    paths?: Record<string, { put?: { responses?: Record<string, unknown> } }>
  }
  assert.ok(document.paths?.["/documents/{documentId}/share"]?.put?.responses?.["409"])
})

test("document deletion owns the required reason/version request body and read routes do not", async () => {
  const response = await app.request("/openapi.json")
  assert.equal(response.status, 200)
  const document = await response.json() as {
    paths?: Record<string, Record<string, { requestBody?: { required?: boolean } }>>
  }

  assert.equal(document.paths?.["/documents/{documentId}/share"]?.get?.requestBody, undefined)
  assert.equal(document.paths?.["/documents/{documentId}/extracted-text"]?.get?.requestBody, undefined)
  assert.equal(document.paths?.["/documents/{documentId}"]?.delete?.requestBody?.required, true)
})

test("resource-group membership routes require the mutate feature, target full authority, CAS, and minimal errors", async () => {
  const response = await app.request("/openapi.json")
  assert.equal(response.status, 200)
  const document = await response.json() as {
    paths?: Record<string, {
      get?: { responses?: Record<string, unknown>; "x-memorag-authorization"?: { requiredPermissions?: string[]; resourceCondition?: string } }
      put?: { responses?: Record<string, unknown>; "x-memorag-authorization"?: { requiredPermissions?: string[]; resourceCondition?: string } }
    }>
  }
  const path = document.paths?.["/resource-groups/{groupId}/memberships"]
  for (const operation of [path?.get, path?.put]) {
    assert.deepEqual(operation?.["x-memorag-authorization"]?.requiredPermissions, ["rag:group:assign_manager"])
    assert.equal(operation?.["x-memorag-authorization"]?.resourceCondition, "resourceGroupFull")
    assert.ok(operation?.responses?.["403"])
    assert.ok(operation?.responses?.["503"])
  }
  assert.ok(path?.put?.responses?.["409"])
})

test("benchmark evaluation routes use only the server allowlisted simulated subject and isolated scope", async () => {
  const source = await readRouteSources()
  const registrySource = await readFile(path.resolve(process.cwd(), "src/benchmark/evaluation-context.ts"), "utf8")
  const policies = await openApiRoutePolicies()

  for (const expected of [
    { route: "POST /benchmark/query", prepare: "prepareBenchmarkQueryInvocation" },
    { route: "POST /benchmark/search", prepare: "prepareBenchmarkSearchInvocation" }
  ]) {
    const policy = policies.find((item) => routeKey(item) === expected.route)
    assert.ok(policy)
    assert.deepEqual(policy.operation["x-memorag-authorization"]?.allowedRoles, ["BENCHMARK_RUNNER"])
    assert.equal(policy.resourceCondition, "benchmarkEvaluationScope")
    const block = findRouteBlock(source, policy)
    assert.match(block, new RegExp(`${expected.prepare}\\(body,`))
    assert.match(block, /invocation\.serviceInput, invocation\.subject/)
    assert.doesNotMatch(block, /c\.set\(["']user["']/)
  }

  assert.match(registrySource, /benchmarkSuiteRegistry/)
  assert.match(registrySource, /tenantId[\s\S]*source:\s*["']benchmark-runner["'][\s\S]*docType:\s*["']benchmark-corpus["'][\s\S]*benchmarkSuiteId/)
  assert.match(registrySource, /applicationRoles\.length === 1[\s\S]*BENCHMARK_RUNNER/)
})

test("debug routes remain protected and document the debug permission migration contract", async () => {
  const policies = await openApiRoutePolicies()

  for (const [route, expected] of debugRoutePermissions) {
    const policy = policies.find((item) => routeKey(item) === route)
    assert.ok(policy, `${route} must be present in OpenAPI policies`)
    assert.notEqual(policy.mode, "public", `${route} must not become public`)
    assert.equal(policy.permission, expected.permission, `${route} must keep the chat:admin:read_all alias gate`)
    assert.equal(policy.operationKey, expected.operationKey, `${route} must document the debug operation key`)
    assert.equal(policy.resourceCondition, "ownedRun", `${route} must stay scoped to ownedRun metadata`)
    assert.match(
      (policy.operation["x-memorag-authorization"]?.notes ?? []).join("\n"),
      /debug:(trace:(read:sanitized|export)|replay)/,
      `${route} must document debug:* migration or alias notes`
    )
    if (expected.conditional) {
      assert.ok(
        policy.operation["x-memorag-authorization"]?.conditionalPermissions?.includes(expected.conditional),
        `${route} must document ${expected.conditional} as the target debug permission`
      )
    }
  }
})

test("debug permissions are defined without removing the existing admin debug gate", async () => {
  const authorizationSource = await readFile(accessControlCatalogPath, "utf8")
  for (const permission of ["debug:trace:read:sanitized", "debug:trace:export", "debug:ingest:read", "debug:chunk:read", "debug:replay"]) {
    assert.match(authorizationSource, new RegExp(`["']${escapeRegex(permission)}["']`), `${permission} must be part of the permission contract`)
  }
  assert.equal(ROLE_PERMISSION_CATALOG.SYSTEM_ADMIN.includes("chat:admin:read_all"), true)
  assert.equal(ROLE_PERMISSION_CATALOG.SYSTEM_ADMIN.includes("debug:trace:read:sanitized"), true)
})

test("admin audit export uses a permission distinct from audit read", async () => {
  const policies = await openApiRoutePolicies()
  const read = policies.find((item) => routeKey(item) === "GET /admin/audit-log")
  const exportRoute = policies.find((item) => routeKey(item) === "POST /admin/audit-log/export")
  assert.equal(read?.permission, "access:policy:read")
  assert.equal(exportRoute?.permission, "access:audit:export")
  assert.equal(ROLE_PERMISSION_CATALOG.ACCESS_ADMIN.includes("access:audit:export"), true)
  assert.equal(ROLE_PERMISSION_CATALOG.SYSTEM_ADMIN.includes("access:audit:export"), true)
})

test("async agent permissions remain typed but are removed from role seeds and active routes", async () => {
  const authorizationSource = await readFile(accessControlCatalogPath, "utf8")
  for (const permission of [
    "agent:run",
    "agent:cancel",
    "agent:read:self",
    "agent:read:managed",
    "agent:artifact:download",
    "agent:artifact:writeback",
    "agent:provider:manage",
    "skill:read",
    "skill:create",
    "agent_profile:read",
    "agent_preset:create:self"
  ]) {
    assert.match(authorizationSource, new RegExp(`["']${escapeRegex(permission)}["']`), `${permission} must be part of the permission contract`)
  }
  assert.equal((ROLE_PERMISSION_CATALOG.ASYNC_AGENT_USER as readonly string[]).includes("agent:run"), false)
  assert.equal((ROLE_PERMISSION_CATALOG.ASYNC_AGENT_ADMIN as readonly string[]).includes("agent:provider:manage"), false)
  assert.equal((ROLE_PERMISSION_CATALOG.ASYNC_AGENT_ADMIN as readonly string[]).includes("agent:artifact:writeback"), false)

  const policies = await openApiRoutePolicies()
  for (const route of [
    "POST /agents/runs",
    "GET /agents/provider-settings",
    "GET /agents/runs",
    "GET /agents/runs/{agentRunId}",
    "POST /agents/runs/{agentRunId}/cancel",
    "GET /agents/runs/{agentRunId}/artifacts",
    "POST /agents/runs/{agentRunId}/artifacts/{artifactId}/writeback",
    "GET /agents/runs/{agentRunId}/artifacts/{artifactId}"
  ]) {
    const policy = policies.find((item) => routeKey(item) === route)
    assert.equal(policy, undefined, `${route} must not be present in OpenAPI policies while async agent entrypoints are disabled`)
  }
})

test("chat and document ingest SSE routes keep Last-Event-ID reconnect and event format", async () => {
  const source = await readRouteSources()

  for (const route of [
    { method: "get", path: "/chat-runs/{runId}/events" },
    { method: "get", path: "/document-ingest-runs/{runId}/events" }
  ]) {
    const block = findRouteBlock(source, { ...route, mode: "ownedRun" })
    assert.match(block, /header\(["']Last-Event-ID["']\)/, `${route.path} must read Last-Event-ID`)
    assert.match(block, /listAfter\(tenantId, runId, afterSeq\)/, `${route.path} must resume by tenant-scoped listAfter(tenantId, runId, afterSeq)`)
    assert.match(block, /id:\s*String\(item\.seq\)/, `${route.path} must emit SSE id from event seq`)
    assert.match(block, /event:\s*item\.type/, `${route.path} must emit the stored event type`)
    assert.match(block, /event:\s*["']heartbeat["']/, `${route.path} must keep heartbeat events`)
    assert.match(block, /nextSeq:\s*afterSeq \+ 1/, `${route.path} must include nextSeq in heartbeat or timeout data`)
    assert.match(block, /event:\s*["']timeout["']/, `${route.path} must keep timeout events`)
    assert.match(block, /reconnect with Last-Event-ID/, `${route.path} timeout must tell clients to reconnect with Last-Event-ID`)
  }
})

test("authorization metadata uses generic forbidden error bodies by default", async () => {
  const policies = await openApiRoutePolicies()

  for (const policy of policies.filter((item) => item.mode !== "public" && item.mode !== "authenticated")) {
    const forbidden = policy.operation["x-memorag-authorization"]?.errors?.find((error) => error.status === 403)
    assert.equal(forbidden?.body?.error, "Forbidden", `${routeKey(policy)} must not expose internal permission names in default 403 metadata`)
  }
})

test("security audit reconciliation worker is single-tenant and rechecks authoritative source state", async () => {
  const [workerSource, reconcilerSource, sourceResolverSource, outboxSource] = await Promise.all([
    readFile(path.resolve(process.cwd(), "src/security-mutation-audit-reconciliation-worker.ts"), "utf8"),
    readFile(path.resolve(process.cwd(), "src/security/security-mutation-audit-reconciler.ts"), "utf8"),
    readFile(path.resolve(process.cwd(), "src/rag/offline/pre-retrieval/admission/source-governance-audit-reconciler.ts"), "utf8"),
    readFile(path.resolve(process.cwd(), "src/security/security-mutation-audit-outbox.ts"), "utf8")
  ])

  assert.match(workerSource, /event\.tenantId !== input\.authorizedTenantId/)
  assert.match(workerSource, /reconcileTenant\(input\.authorizedTenantId, limit\)/)
  assert.doesNotMatch(workerSource, /listPending\(event\.tenantId/)
  assert.match(reconcilerSource, /intent\.draft\.tenantId !== tenantId/)
  assert.match(sourceResolverSource, /readSourceGovernanceRecordById/)
  assert.match(sourceResolverSource, /source_governance\.approve_publish/)
  assert.match(sourceResolverSource, /source_governance\.restrict/)
  assert.match(outboxSource, /intentPrefix\(tenantId\)/)
})

async function openApiRoutePolicies(): Promise<Array<RoutePolicy & {
  operation: {
    responses?: Record<string, unknown>
    "x-memorag-authorization"?: {
      mode?: RouteAuthorizationMode
      requiredPermissions?: Permission[]
      conditionalPermissions?: Permission[]
      allowedRoles?: string[]
      operationKey?: string
      resourceCondition?: string
      errorDisclosure?: string
      notes?: string[]
      errors?: Array<{ status?: number; body?: { error?: string } }>
    }
  }
}>> {
  const response = await app.request("/openapi.json")
  assert.equal(response.status, 200)
  const document = await response.json() as {
    paths?: Record<string, Record<string, {
      responses?: Record<string, unknown>
      "x-memorag-authorization"?: {
        mode?: RouteAuthorizationMode
        requiredPermissions?: Permission[]
        conditionalPermissions?: Permission[]
        allowedRoles?: string[]
        operationKey?: string
        resourceCondition?: string
        errorDisclosure?: string
        notes?: string[]
        errors?: Array<{ status?: number; body?: { error?: string } }>
      }
    }>>
  }
  const policies: Array<RoutePolicy & { operation: NonNullable<NonNullable<typeof document.paths>[string][string]> }> = []
  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      const auth = operation["x-memorag-authorization"]
      if (!auth?.mode) continue
      policies.push({
        method,
        path,
        mode: auth.mode,
        permission: auth.requiredPermissions?.[0],
        operationKey: auth.operationKey,
        resourceCondition: auth.resourceCondition,
        errorDisclosure: auth.errorDisclosure,
        operation
      })
    }
  }
  return policies
}

async function readRouteSources(): Promise<string> {
  const routeFiles = (await readdir(routeSourceDir))
    .filter((fileName) => fileName.endsWith(".ts"))
    .map((fileName) => path.join(routeSourceDir, fileName))
    .sort()
  const routeSourcePaths = [appSourcePath, ...routeFiles]
  const sources = await Promise.all(routeSourcePaths.map((sourcePath) => readFile(sourcePath, "utf8")))
  return sources.join("\n")
}

function findAuthMiddlewareBlock(source: string): string {
  const start = source.indexOf("const publicApiPaths = new Set")
  assert.notEqual(start, -1, "authMiddleware path list was not found")
  const end = source.indexOf("registerApiRoutes(app, deps, service)", start)
  assert.notEqual(end, -1, "authMiddleware path list end was not found")
  return source.slice(start, end)
}

function findRouteBlock(source: string, policy: RoutePolicy): string {
  if (policy.path === "/chat") return findNamedRouteBlock(source, "chatRoute")

  const block = extractOpenApiBlocks(source).find(
    (candidate) =>
      new RegExp(`method:\\s*["']${escapeRegex(policy.method)}["']`).test(candidate) &&
      new RegExp(`path:\\s*["']${escapeRegex(policy.path)}["']`).test(candidate)
  )
  assert.ok(block, `${policy.method.toUpperCase()} ${policy.path} route was not found`)
  return block
}

function findNamedRouteBlock(source: string, routeName: string): string {
  const routeStart = source.indexOf(`const ${routeName} = looseRoute`)
  assert.notEqual(routeStart, -1, `${routeName} definition was not found`)
  const handlerStart = source.indexOf(`app.openapi(${routeName}`, routeStart)
  assert.notEqual(handlerStart, -1, `${routeName} handler was not found`)
  const nextRouteStart = findNextOpenApiStart(source, handlerStart + 1)
  return source.slice(routeStart, nextRouteStart)
}

function extractRoutes(source: string): Array<Pick<RoutePolicy, "method" | "path">> {
  return [...source.matchAll(/method:\s*["'](get|post|put|delete)["'],\s*path:\s*["']([^"']+)["']/g)].map((match) => ({
    method: match[1] ?? "",
    path: match[2] ?? ""
  }))
}

function extractOpenApiBlocks(source: string): string[] {
  const starts = [...source.matchAll(/\n\s*app\.openapi\(/g)].map((match) => match.index ?? 0)
  return starts.map((start, index) => {
    const nextStart = starts[index + 1]
    return source.slice(start, nextStart)
  })
}

function findNextOpenApiStart(source: string, startIndex: number): number {
  const match = /\n\s*app\.openapi\(/g
  match.lastIndex = startIndex
  return match.exec(source)?.index ?? source.length
}

function routeKey(route: Pick<RoutePolicy, "method" | "path">): string {
  return `${route.method.toUpperCase()} ${route.path}`
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
