import assert from "node:assert/strict"
import test from "node:test"
import {
  APPLICATION_ROLES,
  COGNITO_SESSION_INVALID_AT_ATTRIBUTE_NAME,
  COGNITO_SESSION_INVALID_AT_USER_ATTRIBUTE,
  APPLICATION_ROLE_DISPLAY_CATALOG,
  DEFAULT_APPLICATION_ROLE,
  RESOURCE_OPERATION_FEATURE_PERMISSIONS,
  ROLE_CATALOG_VERSION,
  ROLE_PERMISSION_CATALOG,
  UNASSIGNED_APPLICATION_PERMISSIONS,
  isApplicationRole
} from "./access-control.js"

test("Cognito session revocation attribute stays within the service name limit", () => {
  assert.equal(COGNITO_SESSION_INVALID_AT_ATTRIBUTE_NAME, "session_invalid_at")
  assert.ok(COGNITO_SESSION_INVALID_AT_ATTRIBUTE_NAME.length <= 20)
  assert.equal(COGNITO_SESSION_INVALID_AT_USER_ATTRIBUTE, "custom:session_invalid_at")
})

test("canonical role catalog has a version and exactly one definition for every role", () => {
  assert.match(ROLE_CATALOG_VERSION, /^memorag-access-role-catalog-v\d+$/)
  assert.equal(new Set(APPLICATION_ROLES).size, APPLICATION_ROLES.length)
  assert.deepEqual(Object.keys(ROLE_PERMISSION_CATALOG), [...APPLICATION_ROLES])
  assert.deepEqual(Object.keys(APPLICATION_ROLE_DISPLAY_CATALOG), [...APPLICATION_ROLES])

  for (const role of APPLICATION_ROLES) {
    const permissions = ROLE_PERMISSION_CATALOG[role]
    assert.equal(new Set(permissions).size, permissions.length, `${role} permissions must be unique`)
    assert.notEqual(APPLICATION_ROLE_DISPLAY_CATALOG[role].displayName.trim(), "")
    assert.notEqual(APPLICATION_ROLE_DISPLAY_CATALOG[role].description.trim(), "")
  }
})

test("role resolution fails closed for unknown values", () => {
  assert.equal(isApplicationRole(DEFAULT_APPLICATION_ROLE), true)
  assert.equal(isApplicationRole("UNKNOWN_ROLE"), false)
  assert.equal(isApplicationRole("TEAM_A"), false)
})

test("declared but unassigned permissions do not accidentally grant capabilities", () => {
  const assignedPermissions = new Set<string>(Object.values(ROLE_PERMISSION_CATALOG).flat())
  for (const permission of UNASSIGNED_APPLICATION_PERMISSIONS) {
    assert.equal(assignedPermissions.has(permission), false, permission)
  }
})

test("resource operation feature catalog は enabled 19 セルだけを一意に定義する", () => {
  assert.equal(RESOURCE_OPERATION_FEATURE_PERMISSIONS.length, 19)
  assert.equal(new Set(RESOURCE_OPERATION_FEATURE_PERMISSIONS).size, 19)
  const permissions = new Set<string>(RESOURCE_OPERATION_FEATURE_PERMISSIONS)
  assert.equal(permissions.has("resourceGroup.move"), false)
  assert.equal(permissions.has("resourceGroup.share"), false)
})

test("resource operation feature は least privilege の role だけへ割り当てる", () => {
  const readSearchPermissions = new Set<string>([
    "document.read",
    "document.useInSearch",
    "folder.read",
    "folder.useInSearch",
    "resourceGroup.read",
    "resourceGroup.useInSearch"
  ])
  const benchmarkDocumentPermissions = new Set<string>([
    "document.create",
    "document.read",
    "document.delete",
    "document.useInSearch"
  ])

  for (const permission of RESOURCE_OPERATION_FEATURE_PERMISSIONS) {
    const roles = APPLICATION_ROLES.filter((role) => (ROLE_PERMISSION_CATALOG[role] as readonly string[]).includes(permission))
    const expectedRoles = readSearchPermissions.has(permission)
      ? ["CHAT_USER", "RAG_GROUP_MANAGER", ...(benchmarkDocumentPermissions.has(permission) ? ["BENCHMARK_RUNNER"] : []), "SYSTEM_ADMIN"]
      : ["RAG_GROUP_MANAGER", ...(benchmarkDocumentPermissions.has(permission) ? ["BENCHMARK_RUNNER"] : []), "SYSTEM_ADMIN"]
    assert.deepEqual(
      roles,
      expectedRoles,
      permission
    )
  }

  const legacyDocumentReaders = APPLICATION_ROLES.filter((role) => (ROLE_PERMISSION_CATALOG[role] as readonly string[]).includes("rag:doc:read"))
  assert.deepEqual(legacyDocumentReaders, ["CHAT_USER", "RAG_GROUP_MANAGER", "SYSTEM_ADMIN"])
})

test("source governance approval permission は審査責任を持つ role だけへ割り当てる", () => {
  const roles = APPLICATION_ROLES.filter((role) => (
    ROLE_PERMISSION_CATALOG[role] as readonly string[]
  ).includes("rag:source:approve"))
  assert.deepEqual(roles, ["RAG_GROUP_MANAGER", "SYSTEM_ADMIN"])
})

test("security audit quarantine redrive permission は system recovery role だけへ割り当てる", () => {
  const roles = APPLICATION_ROLES.filter((role) => (
    ROLE_PERMISSION_CATALOG[role] as readonly string[]
  ).includes("access:audit:redrive"))
  assert.deepEqual(roles, ["SYSTEM_ADMIN"])
  assert.equal(ROLE_CATALOG_VERSION, "memorag-access-role-catalog-v3")
})
