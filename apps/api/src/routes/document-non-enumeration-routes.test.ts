import assert from "node:assert/strict"
import test from "node:test"
import { OpenAPIHono } from "@hono/zod-openapi"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../app-env.js"
import type { AppUser } from "../auth.js"
import { SourceGovernanceDeniedError } from "../rag/offline/pre-retrieval/admission/source-governance-approval-service.js"
import {
  RESOURCE_NON_ENUMERATION_MINIMUM_DELAY_MS,
  RESOURCE_UNAVAILABLE_BODY,
  ResourceUnavailableError,
  publicResourceUnavailable
} from "../security/public-resource-response.js"
import { registerDocumentRoutes } from "./document-routes.js"

const actor: AppUser = {
  userId: "resource-manager",
  email: "resource-manager@example.test",
  cognitoGroups: ["RAG_GROUP_MANAGER"],
  accountStatus: "active",
  tenantId: "tenant-a"
}

test("source-governance and reindex routes generalize authorized missing and unauthorized existing resources", async () => {
  const app = createApp()
  const probes: Array<{
    name: string
    path: (id: string) => string
    init?: RequestInit
  }> = [
    {
      name: "source governance read",
      path: (id) => `/documents/${id}/source-governance`
    },
    {
      name: "source governance approve",
      path: (id) => `/documents/${id}/source-governance/approve`,
      init: jsonRequest(approvalInput())
    },
    {
      name: "source governance restrict",
      path: (id) => `/documents/${id}/source-governance/restrict`,
      init: jsonRequest({
        expectedVersion: "governance-version-1",
        reason: "security review restriction",
        dimensions: ["quality"]
      })
    },
    {
      name: "document reindex",
      path: (id) => `/documents/${id}/reindex`,
      init: jsonRequest({})
    },
    {
      name: "document reindex stage",
      path: (id) => `/documents/${id}/reindex/stage`,
      init: jsonRequest({})
    },
    {
      name: "reindex cutover",
      path: (id) => `/documents/reindex-migrations/${id}/cutover`,
      init: { method: "POST" }
    },
    {
      name: "reindex rollback",
      path: (id) => `/documents/reindex-migrations/${id}/rollback`,
      init: { method: "POST" }
    }
  ]

  for (const probe of probes) {
    const unauthorizedExisting = await timedRequest(app, probe.path("existing-unauthorized"), probe.init)
    const authorizedMissing = await timedRequest(app, probe.path("missing"), probe.init)

    assert.equal(unauthorizedExisting.status, 404, `${probe.name}: unauthorized existing status`)
    assert.equal(authorizedMissing.status, 404, `${probe.name}: authorized missing status`)
    assert.deepEqual(JSON.parse(unauthorizedExisting.body), RESOURCE_UNAVAILABLE_BODY, `${probe.name}: versioned body`)
    assert.equal(unauthorizedExisting.body, authorizedMissing.body, `${probe.name}: body class`)
    assert.deepEqual(unauthorizedExisting.headers, authorizedMissing.headers, `${probe.name}: header class`)
    assert.equal(unauthorizedExisting.headers["cache-control"], "no-store")
    assert.equal(unauthorizedExisting.headers["x-resource-response-profile"], "resource-non-enumeration-v1")
    assert.ok(unauthorizedExisting.elapsedMs >= RESOURCE_NON_ENUMERATION_MINIMUM_DELAY_MS - 5, `${probe.name}: deny timing lower bound`)
    assert.ok(authorizedMissing.elapsedMs >= RESOURCE_NON_ENUMERATION_MINIMUM_DELAY_MS - 5, `${probe.name}: missing timing lower bound`)
  }
})

function createApp() {
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, context) => result.success
      ? undefined
      : context.json({ error: "Validation failed", details: result.error.flatten() }, 400)
  })
  app.use("*", async (context, next) => {
    context.set("user", actor)
    await next()
  })
  const documentFailure = (id: string): never => {
    if (id === "missing") throw new Error("ENOENT")
    throw new Error("Forbidden: document resource is not authorized")
  }
  const governanceFailure = (id: string): never => {
    if (id === "missing") throw new Error("ENOENT")
    throw new SourceGovernanceDeniedError()
  }
  const migrationFailure = (id: string): never => {
    if (id === "missing") throw new Error("migration not found")
    throw new Error("Forbidden: reindex migration is not authorized")
  }
  registerDocumentRoutes({
    app,
    deps: {} as never,
    service: {
      getSourceGovernance: async (_user: AppUser, id: string) => governanceFailure(id),
      approveSourceGovernance: async (_user: AppUser, id: string) => governanceFailure(id),
      restrictSourceGovernance: async (_user: AppUser, id: string) => governanceFailure(id),
      reindexDocument: async (_user: AppUser, id: string) => documentFailure(id),
      stageReindexMigration: async (_user: AppUser, id: string) => documentFailure(id),
      cutoverReindexMigration: async (_user: AppUser, id: string) => migrationFailure(id),
      rollbackReindexMigration: async (_user: AppUser, id: string) => migrationFailure(id)
    } as never
  })
  app.onError((error, context) => {
    if (error instanceof ResourceUnavailableError) {
      const response = publicResourceUnavailable()
      for (const [name, value] of Object.entries(response.headers)) context.header(name, value)
      return context.json(response.body, response.status)
    }
    if (error instanceof HTTPException) return context.json({ error: error.message }, error.status)
    return context.json({ error: "Internal server error" }, 500)
  })
  return app
}

function approvalInput() {
  return {
    expectedVersion: "governance-version-1",
    reason: "security review approval",
    classification: { level: "confidential", policyVersion: "classification-v1" },
    usagePolicy: {
      allowedPurposes: ["normal_rag"],
      externalModelAllowed: false,
      loggingAllowed: false,
      evaluationAllowed: false,
      policyVersion: "usage-v1"
    },
    qualityProfile: {
      knowledgeQualityStatus: "approved",
      verificationStatus: "verified",
      freshnessStatus: "current",
      supersessionStatus: "current",
      extractionQualityStatus: "high",
      ragEligibility: "eligible",
      flags: []
    },
    qualityPolicyVersion: "quality-v1",
    inspection: { status: "passed", profileVersion: "inspection-v1" }
  }
}

function jsonRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }
}

async function timedRequest(app: OpenAPIHono<AppEnv>, path: string, init?: RequestInit) {
  const startedAt = Date.now()
  const response = await app.request(path, init)
  return {
    status: response.status,
    body: await response.text(),
    elapsedMs: Date.now() - startedAt,
    headers: {
      "cache-control": response.headers.get("cache-control"),
      "content-type": response.headers.get("content-type"),
      "x-resource-response-profile": response.headers.get("x-resource-response-profile")
    }
  }
}
