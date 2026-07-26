import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { deriveOverallStatus, validateUiQualityMatrix } from "./ui-quality-matrix.mjs"

const createdRoots = []

function writeFile(repoRoot, repositoryPath, content = "evidence\n") {
  const filePath = path.join(repoRoot, repositoryPath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

function fixture() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ui-quality-matrix-"))
  createdRoots.push(repoRoot)
  writeFile(repoRoot, "apps/web/e2e/audit.spec.ts")
  writeFile(repoRoot, "tasks/todo/manual.md")
  const axes = Array.from({ length: 8 }, (_, index) => ({
    id: `AC-SQ016-00${index + 1}`,
    label: `axis ${index + 1}`,
    automated: {
      required: index !== 7,
      owner: "automation",
      evidence: index === 7 ? [] : ["apps/web/e2e/audit.spec.ts"]
    },
    manual: {
      required: true,
      owner: "manual",
      task: "tasks/todo/manual.md",
      evidence: []
    }
  }))
  const criteria = Object.fromEntries(axes.map((axis, index) => [
    axis.id,
    {
      automated: index === 7 ? "not_applicable" : "blocked",
      manual: "blocked",
      overall: "blocked",
      note: "pending"
    }
  ]))
  return {
    repoRoot,
    traceManifest: { views: [{ view: "chat" }] },
    matrix: { schemaVersion: 1, requirement: "SQ-016", axes, views: [{ view: "chat", criteria }] }
  }
}

function codes(issues) {
  return new Set(issues.map((entry) => entry.code))
}

test.after(() => {
  for (const repoRoot of createdRoots) fs.rmSync(repoRoot, { recursive: true, force: true })
})

test("NONUI-UI-QUALITY-MATRIX-001 canonical viewと8 ACのblocked baselineを受理する", () => {
  const input = fixture()
  assert.deepEqual(validateUiQualityMatrix(input), [])
})

test("NONUI-UI-QUALITY-MATRIX-002 view/axis driftと不正statusを分類する", () => {
  const input = fixture()
  input.matrix.axes.pop()
  input.matrix.views[0].view = "ghost"
  input.matrix.views[0].criteria["AC-SQ016-001"].automated = "pending"
  const resultCodes = codes(validateUiQualityMatrix(input))
  assert.ok(resultCodes.has("missing-axis"))
  assert.ok(resultCodes.has("missing-view"))
  assert.ok(resultCodes.has("orphan-view"))
  assert.ok(resultCodes.has("invalid-status"))
})

test("NONUI-UI-QUALITY-MATRIX-003 manual evidenceなしのpassとoverall偽装を拒否する", () => {
  const input = fixture()
  input.matrix.views[0].criteria["AC-SQ016-001"] = {
    automated: "pass",
    manual: "pass",
    overall: "blocked",
    note: "false pass"
  }
  const resultCodes = codes(validateUiQualityMatrix(input))
  assert.ok(resultCodes.has("manual-pass-without-evidence"))
  assert.ok(resultCodes.has("overall-status-mismatch"))
})

test("deriveOverallStatusはfail、blocked、pass、not_applicableを区別する", () => {
  const hybrid = { automated: { required: true }, manual: { required: true } }
  assert.equal(deriveOverallStatus({ automated: "fail", manual: "blocked" }, hybrid), "fail")
  assert.equal(deriveOverallStatus({ automated: "pass", manual: "blocked" }, hybrid), "blocked")
  assert.equal(deriveOverallStatus({ automated: "pass", manual: "pass" }, hybrid), "pass")
  assert.equal(deriveOverallStatus(
    { automated: "not_applicable", manual: "not_applicable" },
    hybrid
  ), "not_applicable")
})
