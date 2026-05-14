import assert from "node:assert/strict"
import test from "node:test"
import { canManageFolder, canReadFolder, folderPermissionSatisfies, getPermissionsForGroups, hasPermission, requirePermission } from "./authorization.js"

test("SYSTEM_ADMIN は任意の権限チェックを通過する", () => {
  const user = { userId: "u1", cognitoGroups: ["SYSTEM_ADMIN"] }
  assert.doesNotThrow(() => requirePermission(user, "access:role:assign"))
  assert.doesNotThrow(() => requirePermission(user, "chat:create"))
})

test("CHAT_USER は許可外権限で403になる", () => {
  const user = { userId: "u2", cognitoGroups: ["CHAT_USER"] }
  assert.throws(() => requirePermission(user, "access:role:assign"), /Forbidden/)
})

test("停止・削除アカウントは role があっても権限チェックを通過しない", () => {
  const suspended = { userId: "u-suspended", cognitoGroups: ["SYSTEM_ADMIN"], accountStatus: "suspended" as const }
  const deleted = { userId: "u-deleted", cognitoGroups: ["SYSTEM_ADMIN"], accountStatus: "deleted" as const }

  assert.equal(hasPermission(suspended, "chat:create"), false)
  assert.equal(hasPermission(deleted, "chat:create"), false)
  assert.throws(() => requirePermission(suspended, "chat:create"), /Forbidden/)
})

test("フォルダ実効権限は none/readOnly/full の順序で評価される", () => {
  assert.equal(canReadFolder("none"), false)
  assert.equal(canReadFolder("readOnly"), true)
  assert.equal(canReadFolder("full"), true)
  assert.equal(canManageFolder("readOnly"), false)
  assert.equal(canManageFolder("full"), true)
  assert.equal(folderPermissionSatisfies("full", "readOnly"), true)
  assert.equal(folderPermissionSatisfies("readOnly", "full"), false)
})

test("RAG_GROUP_MANAGER は文書一覧と文書更新権限を持つ", () => {
  const user = { userId: "u3", cognitoGroups: ["RAG_GROUP_MANAGER"] }
  assert.doesNotThrow(() => requirePermission(user, "rag:doc:read"))
  assert.doesNotThrow(() => requirePermission(user, "rag:doc:write:group"))
  assert.doesNotThrow(() => requirePermission(user, "rag:doc:delete:group"))
  assert.doesNotThrow(() => requirePermission(user, "benchmark:read"))
  assert.doesNotThrow(() => requirePermission(user, "benchmark:run"))
  assert.throws(() => requirePermission(user, "benchmark:query"))
  assert.throws(() => requirePermission(user, "benchmark:cancel"))
})

test("BENCHMARK_OPERATOR は管理画面の性能テスト起動と履歴参照を許可される", () => {
  const user = { userId: "u7", cognitoGroups: ["BENCHMARK_OPERATOR"] }
  assert.doesNotThrow(() => requirePermission(user, "benchmark:read"))
  assert.doesNotThrow(() => requirePermission(user, "benchmark:run"))
  assert.throws(() => requirePermission(user, "benchmark:query"))
  assert.throws(() => requirePermission(user, "benchmark:seed_corpus"))
  assert.throws(() => requirePermission(user, "benchmark:cancel"))
  assert.throws(() => requirePermission(user, "benchmark:download"))
})

test("ASYNC_AGENT_USER は自分の非同期エージェントrunとpresetだけ扱える", () => {
  const user = { userId: "u-agent", cognitoGroups: ["ASYNC_AGENT_USER"] }
  assert.doesNotThrow(() => requirePermission(user, "agent:run"))
  assert.doesNotThrow(() => requirePermission(user, "agent:cancel"))
  assert.doesNotThrow(() => requirePermission(user, "agent:read:self"))
  assert.doesNotThrow(() => requirePermission(user, "agent:artifact:download"))
  assert.doesNotThrow(() => requirePermission(user, "skill:read"))
  assert.doesNotThrow(() => requirePermission(user, "agent_profile:read"))
  assert.doesNotThrow(() => requirePermission(user, "agent_preset:create:self"))
  assert.throws(() => requirePermission(user, "agent:read:managed"))
  assert.throws(() => requirePermission(user, "agent:artifact:writeback"))
  assert.throws(() => requirePermission(user, "agent:provider:manage"))
  assert.throws(() => requirePermission(user, "skill:create"))
})

test("SKILL_PROFILE_ADMIN と ASYNC_AGENT_ADMIN は責務別の agent 権限を持つ", () => {
  const skillAdmin = { userId: "u-skill-admin", cognitoGroups: ["SKILL_PROFILE_ADMIN"] }
  assert.doesNotThrow(() => requirePermission(skillAdmin, "skill:create"))
  assert.doesNotThrow(() => requirePermission(skillAdmin, "agent_profile:share"))
  assert.throws(() => requirePermission(skillAdmin, "agent:run"))

  const agentAdmin = { userId: "u-agent-admin", cognitoGroups: ["ASYNC_AGENT_ADMIN"] }
  assert.doesNotThrow(() => requirePermission(agentAdmin, "agent:read:managed"))
  assert.doesNotThrow(() => requirePermission(agentAdmin, "agent:artifact:writeback"))
  assert.doesNotThrow(() => requirePermission(agentAdmin, "agent:provider:manage"))
  assert.throws(() => requirePermission(agentAdmin, "skill:create"))
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
  assert.throws(() => requirePermission(user, "benchmark:run"))
})

test("BENCHMARK_RUNNER は benchmark query と前提資料seedだけ許可される", () => {
  const user = { userId: "u6", cognitoGroups: ["BENCHMARK_RUNNER"] }
  assert.doesNotThrow(() => requirePermission(user, "benchmark:query"))
  assert.doesNotThrow(() => requirePermission(user, "benchmark:seed_corpus"))
  assert.throws(() => requirePermission(user, "benchmark:run"))
  assert.throws(() => requirePermission(user, "rag:doc:read"))
  assert.throws(() => requirePermission(user, "benchmark:read"))
  assert.throws(() => requirePermission(user, "chat:admin:read_all"))
  assert.throws(() => requirePermission(user, "rag:doc:write:group"))
  assert.throws(() => requirePermission(user, "rag:doc:delete:group"))
})

test("role 群から重複なしの有効 permission を返す", () => {
  const permissions = getPermissionsForGroups(["CHAT_USER", "RAG_GROUP_MANAGER", "UNKNOWN_ROLE"])
  assert.equal(permissions.filter((permission) => permission === "rag:doc:read").length, 1)
  assert.ok(permissions.includes("chat:create"))
  assert.ok(permissions.includes("rag:doc:write:group"))
  assert.equal(permissions.includes("chat:admin:read_all"), false)
})
