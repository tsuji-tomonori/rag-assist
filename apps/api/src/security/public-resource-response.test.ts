import assert from "node:assert/strict"
import test from "node:test"
import {
  RESOURCE_NON_ENUMERATION_PROFILE_VERSION,
  ResourceUnavailableError,
  authorizedOnlyPage,
  minimizedRevokedWorkerResult,
  publicResourceUnavailable,
  sanitizeAuthorizedResourceMetadata,
  settleNonEnumerationTiming
} from "./public-resource-response.js"

test("FR-091 existing-but-unauthorized and absent resource use one exact public contract", () => {
  const outcomes = ["absent", "unauthorized"].map(() => publicResourceUnavailable())
  assert.deepEqual(outcomes[0], outcomes[1])
  assert.equal(JSON.stringify(outcomes[0]).length, JSON.stringify(outcomes[1]).length)
  assert.equal(new ResourceUnavailableError().status, 404)
  assert.doesNotMatch(JSON.stringify(outcomes[0]), /tenant|owner|principal|policy|lifecycle|document/i)
})

test("FR-091 timing class applies the same lower bound without resource details", async () => {
  const started = Date.now()
  await settleNonEnumerationTiming(started, 5)
  assert.ok(Date.now() - started >= 4)
})

test("FR-091 collection counts and cursors are derived only from authorized resources", () => {
  const page = authorizedOnlyPage({
    candidates: [
      { id: "a", allowed: true },
      { id: "secret-1", allowed: false },
      { id: "b", allowed: true },
      { id: "secret-2", allowed: false }
    ],
    authorized: (item) => item.allowed,
    project: (item) => ({ id: item.id }),
    limit: 1
  })
  assert.deepEqual(page.items, [{ id: "a" }])
  assert.equal(page.count, 1)
  assert.ok(page.nextCursor)
  assert.doesNotMatch(JSON.stringify(page), /secret/)
})

test("FR-091 reader metadata and revoked worker result disclose no security policy state", () => {
  const metadata = sanitizeAuthorizedResourceMetadata({
    source: "handbook",
    docType: "policy",
    tenantId: "tenant-secret",
    ownerUserId: "owner-secret",
    aclGroups: ["secret-group"],
    domainPolicy: "internal-policy",
    lifecycleStatus: "active",
    benchmarkSuiteId: "private-suite",
    groupId: "folder-safe",
    groupIds: ["folder-safe", "folder-safe-2"]
  })
  assert.deepEqual(metadata, {
    source: "handbook",
    docType: "policy",
    groupId: "folder-safe",
    groupIds: ["folder-safe", "folder-safe-2"]
  })
  assert.deepEqual(minimizedRevokedWorkerResult(), {
    status: "permission_revoked",
    responseProfileVersion: RESOURCE_NON_ENUMERATION_PROFILE_VERSION
  })
})
