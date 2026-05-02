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

test("RAG_GROUP_MANAGER は文書一覧と文書更新権限を持つ", () => {
  const user = { userId: "u3", cognitoGroups: ["RAG_GROUP_MANAGER"] }
  assert.doesNotThrow(() => requirePermission(user, "rag:doc:read"))
  assert.doesNotThrow(() => requirePermission(user, "rag:doc:write:group"))
  assert.doesNotThrow(() => requirePermission(user, "rag:doc:delete:group"))
})

test("問い合わせ対応ロールはユーザー管理なしで回答操作できる", () => {
  const user = { userId: "u4", cognitoGroups: ["ANSWER_EDITOR"] }
  assert.doesNotThrow(() => requirePermission(user, "answer:edit"))
  assert.doesNotThrow(() => requirePermission(user, "answer:publish"))
  assert.throws(() => requirePermission(user, "user:read"))
})

test("CHAT_USER は問い合わせ管理とdebug管理権限を持たない", () => {
  const user = { userId: "u5", cognitoGroups: ["CHAT_USER"] }
  assert.throws(() => requirePermission(user, "answer:edit"))
  assert.throws(() => requirePermission(user, "answer:publish"))
  assert.throws(() => requirePermission(user, "chat:admin:read_all"))
})
