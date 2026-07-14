import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import type { AppUser } from "../auth.js"
import {
  enforceResolvedResourceOperation,
  resolvedResourceScope,
  ResourceOperationAuthorizationError
} from "./production-resource-operation-authorizer.js"
import {
  RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION,
  getResourceOperationAuthorizationCell,
  type ProtectedResourceOperation,
  type ProtectedResourceType,
  type ResourcePermissionScope,
  type ResourcePermissionScopeContext
} from "./resource-operation-authorization.js"

const resourceTypes = ["document", "folder", "resourceGroup"] as const satisfies readonly ProtectedResourceType[]
const operations = ["create", "read", "update", "delete", "move", "share", "searchUse"] as const satisfies readonly ProtectedResourceOperation[]

test("production adapter は FR-076 の enabled 19 セルを完全一致 evidence で許可する", () => {
  let allowed = 0
  for (const resourceType of resourceTypes) {
    for (const operation of operations) {
      const cell = getResourceOperationAuthorizationCell(
        RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION,
        resourceType,
        operation
      )
      assert.ok(cell)
      if (!cell.enabled) continue
      const path = cell.authorizationPaths[0]
      assert.ok(path)
      const resourceScopes: Partial<Record<ResourcePermissionScope, ResourcePermissionScopeContext>> = {}
      for (const requirement of path.permissions) {
        resourceScopes[requirement.scope] = resolvedResourceScope({ tenantId: "tenant-a", permission: "full" })
      }
      const decision = enforceResolvedResourceOperation(manager(), {
        resourceType,
        operation,
        authorizationPath: path.key,
        resourceScopes,
        satisfiedGuards: cell.requiredGuards
      })
      assert.equal(decision.allowed, true, cell.logicalOperationKey)
      assert.equal(decision.logicalOperationKey, cell.logicalOperationKey)
      allowed += 1
    }
  }
  assert.equal(allowed, 19)
})

test("production adapter は explicit deny・disabled actor・unknown role・other-cell 代用を拒否する", () => {
  for (const operation of ["move", "share"] as const) {
    assert.throws(() => enforceResolvedResourceOperation(manager(), {
      resourceType: "resourceGroup",
      operation,
      authorizationPath: "disabled",
      resourceScopes: {},
      satisfiedGuards: []
    }), (error: unknown) => (
      error instanceof ResourceOperationAuthorizationError &&
      error.decision.reasonCode === "resource_operation_explicit_deny"
    ))
  }

  const read = permittedDocumentRead()
  assert.throws(() => enforceResolvedResourceOperation({ ...manager(), accountStatus: "suspended" }, read), (error: unknown) => (
    error instanceof ResourceOperationAuthorizationError && error.decision.reasonCode === "account_not_active"
  ))
  assert.throws(() => enforceResolvedResourceOperation({ ...manager(), cognitoGroups: ["UNKNOWN_ROLE"] }, read), (error: unknown) => (
    error instanceof ResourceOperationAuthorizationError && error.decision.reasonCode === "feature_permission_missing"
  ))

  // BENCHMARK_RUNNER has exact document create/read/delete/search cells, but a
  // document permission never substitutes for folder.create.
  assert.throws(() => enforceResolvedResourceOperation({ ...manager(), cognitoGroups: ["BENCHMARK_RUNNER"] }, {
    resourceType: "folder",
    operation: "create",
    authorizationPath: "tenantRoot",
    resourceScopes: { tenantCreateScope: resolvedResourceScope({ tenantId: "tenant-a", permission: "full" }) },
    satisfiedGuards: ["sameTenantPath", "nonCyclicPath", "canonicalNameConfirmed"]
  }), (error: unknown) => (
    error instanceof ResourceOperationAuthorizationError && error.decision.reasonCode === "feature_permission_missing"
  ))
})

test("3×7 セルは test-only でなく production API/service/retrieval callsite に接続される", async () => {
  const sourceByResource = {
    document: await sources([
      "src/routes/document-routes.ts",
      "src/rag/memorag-service.ts",
      "src/documents/document-permission-service.ts",
      "src/documents/document-lifecycle-mutation-coordinator.ts",
      "src/rag/online/retrieval/hybrid/hybrid-retriever.ts"
    ]),
    folder: await sources([
      "src/rag/memorag-service.ts",
      "src/folders/folder-permission-service.ts",
      "src/folders/folder-lifecycle-mutation-coordinator.ts",
      "src/folders/folder-archive-service.ts",
      "src/rag/online/retrieval/hybrid/hybrid-retriever.ts"
    ]),
    resourceGroup: await sources([
      "src/routes/resource-group-routes.ts",
      "src/security/resource-group-lifecycle-service.ts",
      "src/security/resource-group-membership-service.ts",
      "src/security/production-resource-operation-authorizer.ts",
      "src/folders/folder-permission-service.ts",
      "src/documents/document-permission-service.ts"
    ])
  }
  for (const resourceType of resourceTypes) {
    for (const operation of operations) {
      const source = sourceByResource[resourceType]
      assert.match(source, new RegExp(`resourceType:\\s*["']${resourceType}["']`), `${resourceType} has no production kernel call`)
      assert.match(source, new RegExp(`operation:\\s*["']${operation}["']|Operation\\([^\\n]*["']${operation}["']|Unsupported\\([^\\n]*["']${operation}["']|operationKey:\\s*["']${resourceType}\\.${operation === "searchUse" ? "useInSearch" : operation}["']`), `${resourceType}:${operation} has no production path`)
    }
  }
})

function manager(): AppUser {
  return {
    userId: "manager-1",
    cognitoGroups: ["RAG_GROUP_MANAGER"],
    accountStatus: "active",
    tenantId: "tenant-a"
  }
}

function permittedDocumentRead() {
  return {
    resourceType: "document" as const,
    operation: "read" as const,
    authorizationPath: "target",
    resourceScopes: { target: resolvedResourceScope({ tenantId: "tenant-a", permission: "readOnly" }) },
    satisfiedGuards: ["responseAllowlistApplied" as const]
  }
}

async function sources(paths: readonly string[]): Promise<string> {
  return (await Promise.all(paths.map((path) => readFile(path, "utf-8")))).join("\n")
}
