import assert from "node:assert/strict"
import test from "node:test"
import type { AppUser } from "../auth.js"
import {
  calculateEffectiveDocumentPermission,
  canMoveDocument,
  canShareDocument,
  validateDocumentMoveRequest,
  validateDocumentShareRequest
} from "./document-permission-service.js"

const manager: AppUser = {
  userId: "user-a",
  email: "a@example.com",
  cognitoGroups: ["RAG_GROUP_MANAGER"]
}

test("calculateEffectiveDocumentPermission adds direct document grants to folder permission", () => {
  assert.equal(calculateEffectiveDocumentPermission("readOnly", "none"), "readOnly")
  assert.equal(calculateEffectiveDocumentPermission("none", "readOnly"), "readOnly")
  assert.equal(calculateEffectiveDocumentPermission("readOnly", "full"), "full")
  assert.equal(calculateEffectiveDocumentPermission("full", "readOnly"), "full")
})

test("document share and move guards require full document permission and operation permission", () => {
  assert.equal(canShareDocument("full", manager), true)
  assert.equal(canShareDocument("readOnly", manager), false)
  assert.equal(canMoveDocument("full", "full", manager), true)
  assert.equal(canMoveDocument("full", "readOnly", manager), false)
  assert.equal(canMoveDocument("readOnly", "full", manager), false)
})

test("document share and move request validators require reason and destination", () => {
  assert.throws(() => validateDocumentShareRequest([], ""), /reason/)
  assert.doesNotThrow(() => validateDocumentShareRequest([{ principalType: "user", principalId: "user-b", permissionLevel: "readOnly" }], "確認依頼"))
  assert.throws(() => validateDocumentMoveRequest({ reason: "整理" }), /destinationFolderId/)
  assert.throws(() => validateDocumentMoveRequest({ destinationFolderId: "folder-1" }), /reason/)
})
