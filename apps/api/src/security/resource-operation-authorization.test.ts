import assert from "node:assert/strict"
import test from "node:test"
import { RESOURCE_OPERATION_FEATURE_PERMISSIONS } from "@memorag-mvp/contract/access-control"
import {
  RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION,
  authorizeResourceOperation,
  getResourceOperationAuthorizationCell,
  type ProtectedResourceOperation,
  type ProtectedResourceType,
  type ResourceOperationAuthorizationRequest,
  type ResourcePermissionLevel,
  type ResourcePermissionScope,
  type ResourcePermissionScopeContext
} from "./resource-operation-authorization.js"

const resourceTypes = ["document", "folder", "resourceGroup"] as const satisfies readonly ProtectedResourceType[]
const operations = ["create", "read", "update", "delete", "move", "share", "searchUse"] as const satisfies readonly ProtectedResourceOperation[]

test("versioned catalog は 3 資源種別 × 7 操作を exact match で定義する", () => {
  const disabledCells: string[] = []
  const enabledFeaturePermissions: string[] = []
  const operationKeys = new Set<string>()
  let cellCount = 0

  for (const resourceType of resourceTypes) {
    for (const operation of operations) {
      const cell = getResourceOperationAuthorizationCell(
        RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION,
        resourceType,
        operation
      )
      assert.ok(cell, `${resourceType}:${operation} must be present`)
      assert.equal(Object.isFrozen(cell), true)
      assert.equal(Object.isFrozen(cell.authorizationPaths), true)
      for (const path of cell.authorizationPaths) {
        assert.equal(Object.isFrozen(path), true)
        assert.equal(Object.isFrozen(path.permissions), true)
        for (const requirement of path.permissions) assert.equal(Object.isFrozen(requirement), true)
      }
      cellCount += 1
      operationKeys.add(cell.logicalOperationKey)
      if (cell.enabled) enabledFeaturePermissions.push(cell.featurePermission)
      else disabledCells.push(`${resourceType}:${operation}`)
    }
  }

  assert.equal(cellCount, 21)
  assert.equal(operationKeys.size, 21)
  assert.deepEqual(disabledCells, ["resourceGroup:move", "resourceGroup:share"])
  assert.deepEqual(enabledFeaturePermissions, [...RESOURCE_OPERATION_FEATURE_PERMISSIONS])
})

test("全 enabled セルは完全一致 feature と資源条件で許可し、別セル feature を代用しない", () => {
  for (const resourceType of resourceTypes) {
    for (const operation of operations) {
      const cell = getResourceOperationAuthorizationCell(
        RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION,
        resourceType,
        operation
      )
      assert.ok(cell)
      if (!cell.enabled) continue

      const request = permittedRequest(resourceType, operation)
      const firstPath = cell.authorizationPaths[0]
      assert.ok(firstPath)
      assert.deepEqual(authorizeResourceOperation(request), {
        allowed: true,
        policyVersion: RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION,
        logicalOperationKey: cell.logicalOperationKey,
        reasonCode: "allowed",
        effectivePermissions: firstPath.permissions.map(({ scope }) => ({
          scope,
          permission: "full",
          source: "ordinaryPolicy"
        }))
      })

      const substituteFeature = cell.featurePermission === "document.read" ? "document.update" : "document.read"
      const substituted = authorizeResourceOperation({
        ...request,
        actor: { ...request.actor, featurePermissions: [substituteFeature] }
      })
      assert.equal(substituted.allowed, false, `${cell.logicalOperationKey} accepted another cell feature`)
      assert.equal(substituted.reasonCode, "feature_permission_missing")
    }
  }
})

test("resourceGroup move/share と未定義・異版セルは fail closed になる", () => {
  for (const operation of ["move", "share"] as const) {
    const decision = authorizeResourceOperation({
      ...baseRequest(),
      resourceType: "resourceGroup",
      operation,
      authorizationPath: "target",
      actor: {
        ...baseRequest().actor,
        featurePermissions: [],
        roleLabels: ["SYSTEM_ADMIN"]
      }
    })
    assert.equal(decision.allowed, false)
    assert.equal(decision.reasonCode, "resource_operation_explicit_deny")
  }

  const unknownOperation = authorizeResourceOperation({
    ...baseRequest(),
    resourceType: "document",
    operation: "download"
  })
  assert.equal(unknownOperation.reasonCode, "resource_operation_undefined")

  const unknownResource = authorizeResourceOperation({
    ...baseRequest(),
    resourceType: "collection",
    operation: "read"
  })
  assert.equal(unknownResource.reasonCode, "resource_operation_undefined")

  const unsupportedVersion = authorizeResourceOperation({
    ...baseRequest(),
    policyVersion: "resource-operation-authorization-v2"
  })
  assert.equal(unsupportedVersion.reasonCode, "policy_version_unsupported")
  assert.equal(getResourceOperationAuthorizationCell("resource-operation-authorization-v2", "document", "read"), undefined)
})

test("SYSTEM_ADMIN role label は通常資源 policy の deny を bypass しない", () => {
  const request = permittedRequest("document", "read")
  const deniedByPolicy = authorizeResourceOperation({
    ...request,
    actor: { ...request.actor, roleLabels: ["SYSTEM_ADMIN"] },
    resourceScopes: {
      ...request.resourceScopes,
      target: scopeContext("full", { ordinaryPolicy: { status: "deny" } })
    }
  })

  assert.equal(deniedByPolicy.allowed, false)
  assert.equal(deniedByPolicy.reasonCode, "ordinary_policy_denied")

  const deniedWithoutExactFeature = authorizeResourceOperation({
    ...request,
    actor: {
      ...request.actor,
      featurePermissions: [],
      roleLabels: ["SYSTEM_ADMIN"]
    }
  })
  assert.equal(deniedWithoutExactFeature.allowed, false)
  assert.equal(deniedWithoutExactFeature.reasonCode, "feature_permission_missing")
})

test("identity・active account・exact feature・tenant・resource を固定順で論理積評価する", () => {
  const request = permittedRequest("document", "read")

  const unverified = authorizeResourceOperation({
    ...request,
    actor: {
      ...request.actor,
      identityVerified: false,
      accountStatus: "suspended",
      featurePermissions: [],
      tenantId: undefined
    }
  })
  assert.equal(unverified.reasonCode, "identity_unverified")

  const inactive = authorizeResourceOperation({
    ...request,
    actor: { ...request.actor, accountStatus: "suspended", featurePermissions: [], tenantId: undefined }
  })
  assert.equal(inactive.reasonCode, "account_not_active")

  const missingFeatureAndTenant = authorizeResourceOperation({
    ...request,
    actor: { ...request.actor, featurePermissions: [], tenantId: undefined }
  })
  assert.equal(missingFeatureAndTenant.reasonCode, "feature_permission_missing")

  const missingActorTenant = authorizeResourceOperation({
    ...request,
    actor: { ...request.actor, tenantId: undefined }
  })
  assert.equal(missingActorTenant.reasonCode, "actor_tenant_unresolved")

  const missingResourceTenant = authorizeResourceOperation({
    ...request,
    resourceScopes: {
      ...request.resourceScopes,
      target: scopeContext("full", { tenantId: undefined })
    }
  })
  assert.equal(missingResourceTenant.reasonCode, "resource_tenant_unresolved")
})

test("active same-tenant 管理主体は通常 policy deny/欠損より先に full となる", () => {
  const request = permittedRequest("document", "share")
  for (const ordinaryPolicy of [{ status: "deny" }, { status: "unreadable" }, undefined] as const) {
    const decision = authorizeResourceOperation({
      ...request,
      resourceScopes: {
        ...request.resourceScopes,
        target: scopeContext("none", { administrativePrincipal: true, ordinaryPolicy })
      }
    })
    assert.equal(decision.allowed, true)
    assert.deepEqual(decision.effectivePermissions, [{
      scope: "target",
      permission: "full",
      source: "administrativePrincipal"
    }])
  }
})

test("強制 deny は管理主体 full に優先する", () => {
  const request = permittedRequest("folder", "update")
  const inactive = authorizeResourceOperation({
    ...request,
    actor: { ...request.actor, roleLabels: ["SYSTEM_ADMIN"] },
    resourceScopes: {
      ...request.resourceScopes,
      target: scopeContext("none", {
        administrativePrincipal: true,
        lifecycle: "archived",
        ordinaryPolicy: { status: "deny" }
      })
    }
  })
  assert.equal(inactive.allowed, false)
  assert.equal(inactive.reasonCode, "resource_not_active")

  const wrongTenant = authorizeResourceOperation({
    ...request,
    resourceScopes: {
      ...request.resourceScopes,
      target: scopeContext("none", {
        administrativePrincipal: true,
        tenantId: "tenant-b",
        ordinaryPolicy: { status: "deny" }
      })
    }
  })
  assert.equal(wrongTenant.reasonCode, "tenant_mismatch")

  const invalidIntegrity = authorizeResourceOperation({
    ...request,
    resourceScopes: {
      ...request.resourceScopes,
      target: scopeContext("none", {
        administrativePrincipal: true,
        integrity: "unknown",
        ordinaryPolicy: { status: "deny" }
      })
    }
  })
  assert.equal(invalidIntegrity.reasonCode, "resource_integrity_unverified")
})

test("create の path と move の source/destination を独立して検証する", () => {
  const rootCreate = permittedRequest("document", "create", "tenantRoot")
  assert.equal(authorizeResourceOperation(rootCreate).allowed, true)

  const unknownPath = authorizeResourceOperation({ ...rootCreate, authorizationPath: "implicitRootFallback" })
  assert.equal(unknownPath.reasonCode, "authorization_path_undefined")

  const move = permittedRequest("document", "move")
  const missingDestination = authorizeResourceOperation({
    ...move,
    resourceScopes: { sourceContainer: move.resourceScopes.sourceContainer }
  })
  assert.equal(missingDestination.reasonCode, "resource_scope_missing")
  assert.equal(missingDestination.failedScope, "destinationContainer")

  const destinationReadOnly = authorizeResourceOperation({
    ...move,
    resourceScopes: {
      ...move.resourceScopes,
      destinationContainer: scopeContext("readOnly")
    }
  })
  assert.equal(destinationReadOnly.reasonCode, "resource_permission_insufficient")
  assert.equal(destinationReadOnly.failedScope, "destinationContainer")
})

test("ordinary policy unknown/read failure と追加 guard 欠損を許可へ変換しない", () => {
  const update = permittedRequest("document", "update")
  for (const ordinaryPolicy of [{ status: "unknown" }, { status: "unreadable" }, undefined] as const) {
    const unavailable = authorizeResourceOperation({
      ...update,
      resourceScopes: {
        ...update.resourceScopes,
        target: scopeContext("full", { ordinaryPolicy })
      }
    })
    assert.equal(unavailable.allowed, false)
    assert.equal(unavailable.reasonCode, "ordinary_policy_unavailable")
  }

  const share = permittedRequest("folder", "share")
  const missingGuard = authorizeResourceOperation({
    ...share,
    satisfiedGuards: share.satisfiedGuards.filter((guard) => guard !== "administrativePrincipalPreserved")
  })
  assert.equal(missingGuard.allowed, false)
  assert.equal(missingGuard.reasonCode, "additional_guard_missing")
  assert.equal(missingGuard.missingGuard, "administrativePrincipalPreserved")

  const malformedFeatureEvidence = {
    ...share,
    actor: { ...share.actor, featurePermissions: undefined }
  } as unknown as ResourceOperationAuthorizationRequest
  assert.equal(authorizeResourceOperation(malformedFeatureEvidence).reasonCode, "feature_permission_missing")

  const malformedGuardEvidence = {
    ...share,
    satisfiedGuards: undefined
  } as unknown as ResourceOperationAuthorizationRequest
  assert.equal(authorizeResourceOperation(malformedGuardEvidence).reasonCode, "additional_guard_missing")
})

function baseRequest(): ResourceOperationAuthorizationRequest {
  return {
    policyVersion: RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION,
    resourceType: "document",
    operation: "read",
    authorizationPath: "target",
    actor: {
      identityVerified: true,
      accountStatus: "active",
      tenantId: "tenant-a",
      featurePermissions: ["document.read"]
    },
    resourceScopes: { target: scopeContext("full") },
    satisfiedGuards: ["responseAllowlistApplied"]
  }
}

function permittedRequest(
  resourceType: ProtectedResourceType,
  operation: ProtectedResourceOperation,
  authorizationPath?: string
): ResourceOperationAuthorizationRequest {
  const cell = getResourceOperationAuthorizationCell(
    RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION,
    resourceType,
    operation
  )
  assert.ok(cell?.enabled, `${resourceType}:${operation} is not enabled`)
  const path = authorizationPath
    ? cell.authorizationPaths.find((candidate) => candidate.key === authorizationPath)
    : cell.authorizationPaths[0]
  assert.ok(path, `${resourceType}:${operation}:${authorizationPath ?? "default"} path is not defined`)

  const resourceScopes: Partial<Record<ResourcePermissionScope, ResourcePermissionScopeContext>> = {}
  for (const requirement of path.permissions) {
    resourceScopes[requirement.scope] = scopeContext("full")
  }

  return {
    policyVersion: RESOURCE_OPERATION_AUTHORIZATION_POLICY_VERSION,
    resourceType,
    operation,
    authorizationPath: path.key,
    actor: {
      identityVerified: true,
      accountStatus: "active",
      tenantId: "tenant-a",
      featurePermissions: [cell.featurePermission]
    },
    resourceScopes,
    satisfiedGuards: cell.requiredGuards
  }
}

function scopeContext(
  permission: ResourcePermissionLevel,
  overrides: Partial<ResourcePermissionScopeContext> = {}
): ResourcePermissionScopeContext {
  return {
    tenantId: "tenant-a",
    lifecycle: "active",
    integrity: "valid",
    administrativePrincipal: false,
    ordinaryPolicy: { status: "allow", permission },
    ...overrides
  }
}
