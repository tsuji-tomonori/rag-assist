import assert from "node:assert/strict"
import test from "node:test"
import { requirePermission } from "./authorization.js"

test("SYSTEM_ADMIN は任意の権限チェックを通過する", () => {
  const user = { userId: "u1", cognitoGroups: ["SYSTEM_ADMIN"] }
  assert.doesNotThrow(() => requirePermission(user, "access:role:assign"))
  assert.doesNotThrow(() => requirePermission(user, "chat:create"))
})

test("CHAT_USER は許可外権限で403になる", () => {
  const user = { userId: "u2", cognitoGroups: ["CHAT_USER"] }
  assert.throws(() => requirePermission(user, "access:role:assign"))
})

test("ANSWER_EDITOR は担当者質問の回答権限を通過する", () => {
  const user = { userId: "u3", cognitoGroups: ["ANSWER_EDITOR"] }
  assert.doesNotThrow(() => requirePermission(user, "answer:edit"))
  assert.throws(() => requirePermission(user, "user:read"))
})
