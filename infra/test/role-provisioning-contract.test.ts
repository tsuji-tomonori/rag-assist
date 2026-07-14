import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { APPLICATION_ROLES } from "../../packages/contract/src/access-control.js"

test("FR-079 Cognito provisioning accepts every canonical application role", async () => {
  const script = await readFile(path.resolve(__dirname, "../scripts/create-cognito-user.sh"), "utf-8")

  for (const role of APPLICATION_ROLES) {
    assert.match(script, new RegExp(`\\b${role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`), `${role} is missing from provisioning script`)
    assert.match(script, new RegExp(`^[ \\t]*${role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} [^\\n]*\\) echo "${role}"`, "m"), `${role} is not normalized by provisioning script`)
  }
})
