import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import {
  findStaleGeneratedFiles,
  validateUiTraceability
} from "./ui-traceability.mjs"

const createdRoots = []

function writeFile(repoRoot, repositoryPath, content) {
  const filePath = path.join(repoRoot, repositoryPath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

function createFixture() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ui-traceability-"))
  createdRoots.push(repoRoot)
  writeFile(repoRoot, "docs/1_要求_REQ/ui/REQ_FUNCTIONAL_094.md", [
    "# 要件定義",
    "",
    "- 要件ID: `FR-094`",
    "- `AC-FR094-001`: 到達できること。"
  ].join("\n"))
  writeFile(repoRoot, "apps/web/src/features/chat/components/ChatView.tsx", "export function ChatView() { return null }\n")
  writeFile(repoRoot, "tests/ui.spec.ts", "test('E2E-VIEW-CHAT-001', () => {})\n")
  writeFile(repoRoot, "tasks/todo/chat.md", "# chat gap\n")
  return repoRoot
}

function baseManifest() {
  return {
    schemaVersion: 1,
    personas: [{ id: "standard-user", label: "一般利用者", jobContext: "質問する" }],
    qualityRequirements: [],
    crossViewVerifications: [],
    views: [{
      view: "chat",
      canonicalUrl: "/",
      urlPatterns: ["/"],
      routeKind: "query-state",
      access: { session: "authenticated", guards: [] },
      personas: ["standard-user"],
      jobs: [{ id: "JOB-UI-CHAT", summary: "質問する" }],
      requirements: [{ id: "FR-094", acceptanceCriteria: ["AC-FR094-001"] }],
      verifications: [{ id: "E2E-VIEW-CHAT-001", status: "implemented", evidence: ["tests/ui.spec.ts"] }],
      implementationStatus: "partial",
      implementationEvidence: ["apps/web/src/features/chat/components/ChatView.tsx"],
      gapTasks: ["tasks/todo/chat.md"]
    }]
  }
}

function screen(view = "chat", permissions = []) {
  return { view, permissions }
}

function codes(issues) {
  return new Set(issues.map((item) => item.code))
}

test.after(() => {
  for (const repoRoot of createdRoots) fs.rmSync(repoRoot, { recursive: true, force: true })
})

test("NONUI-UI-TRACE-001 complete graph validates without diagnostics", () => {
  const repoRoot = createFixture()
  const issues = validateUiTraceability({ repoRoot, manifest: baseManifest(), screens: [screen()] })
  assert.deepEqual(issues, [])
})

test("NONUI-UI-TRACE-002 broken semantic references fail with classified diagnostics", async (t) => {
  await t.test("missing, orphan, and duplicate views", () => {
    const repoRoot = createFixture()
    const manifest = baseManifest()
    manifest.views.push(structuredClone(manifest.views[0]))
    manifest.views.push({ ...structuredClone(manifest.views[0]), view: "ghost", jobs: [{ id: "JOB-UI-GHOST", summary: "ghost" }], verifications: [{ id: "E2E-VIEW-GHOST-001", status: "planned", task: "tasks/todo/chat.md" }] })
    const resultCodes = codes(validateUiTraceability({ repoRoot, manifest, screens: [screen(), screen("documents", ["canReadDocuments"])] }))
    assert.ok(resultCodes.has("duplicate-view"))
    assert.ok(resultCodes.has("missing-view"))
    assert.ok(resultCodes.has("orphan-view"))
  })

  await t.test("invalid permission and persona references", () => {
    const repoRoot = createFixture()
    const manifest = baseManifest()
    manifest.views[0].access.guards = ["canInventData"]
    manifest.views[0].personas = ["missing-persona"]
    const resultCodes = codes(validateUiTraceability({ repoRoot, manifest, screens: [screen()] }))
    assert.ok(resultCodes.has("invalid-permission"))
    assert.ok(resultCodes.has("permission-mismatch"))
    assert.ok(resultCodes.has("invalid-persona-ref"))
  })

  await t.test("missing requirement, acceptance, test ID, evidence, and task", () => {
    const repoRoot = createFixture()
    const manifest = baseManifest()
    manifest.views[0].requirements = [
      { id: "FR-094", acceptanceCriteria: ["AC-FR094-999"] },
      { id: "FR-999", acceptanceCriteria: ["AC-FR999-001"] }
    ]
    manifest.views[0].implementationEvidence = ["apps/web/src/missing.tsx"]
    manifest.views[0].gapTasks = ["tasks/todo/missing.md"]
    manifest.views[0].verifications = [
      { id: "E2E-VIEW-CHAT-001", status: "implemented", evidence: ["apps/web/src/features/chat/components/ChatView.tsx"] },
      { id: "E2E-VIEW-MISSING-001", status: "implemented", evidence: ["tests/missing.spec.ts"] },
      { id: "E2E-VIEW-PLANNED-001", status: "planned", task: "tasks/todo/missing-verification.md" }
    ]
    const resultCodes = codes(validateUiTraceability({ repoRoot, manifest, screens: [screen()] }))
    assert.ok(resultCodes.has("missing-requirement"))
    assert.ok(resultCodes.has("acceptance-mismatch"))
    assert.ok(resultCodes.has("missing-test-id"))
    assert.ok(resultCodes.has("missing-evidence"))
    assert.ok(resultCodes.has("missing-task"))
  })

  await t.test("duplicate persona, job, and verification IDs", () => {
    const repoRoot = createFixture()
    const manifest = baseManifest()
    manifest.personas.push(structuredClone(manifest.personas[0]))
    manifest.views[0].personas.push("standard-user")
    manifest.views[0].urlPatterns.push("/")
    manifest.views[0].requirements[0].acceptanceCriteria.push("AC-FR094-001")
    manifest.views[0].requirements.push(structuredClone(manifest.views[0].requirements[0]))
    manifest.views.push({ ...structuredClone(manifest.views[0]), view: "documents", canonicalUrl: "/documents", urlPatterns: ["/documents"], access: { session: "authenticated", guards: ["canReadDocuments"] } })
    const resultCodes = codes(validateUiTraceability({ repoRoot, manifest, screens: [screen(), screen("documents", ["canReadDocuments"])] }))
    assert.ok(resultCodes.has("duplicate-persona"))
    assert.ok(resultCodes.has("duplicate-job"))
    assert.ok(resultCodes.has("duplicate-verification"))
    assert.ok(resultCodes.has("duplicate-reference"))
    assert.ok(resultCodes.has("duplicate-requirement-ref"))
    assert.ok(resultCodes.has("duplicate-acceptance-ref"))
  })

  await t.test("planned-only view and completed gap task cannot be presented as covered", () => {
    const repoRoot = createFixture()
    writeFile(repoRoot, "tasks/done/chat.md", "# incorrectly completed gap\n")
    const manifest = baseManifest()
    manifest.views[0].verifications = [{ id: "E2E-VIEW-PLANNED-001", status: "planned", task: "tasks/todo/chat.md" }]
    manifest.views[0].gapTasks = ["tasks/done/chat.md"]
    const resultCodes = codes(validateUiTraceability({ repoRoot, manifest, screens: [screen()] }))
    assert.ok(resultCodes.has("missing-implemented-verification"))
    assert.ok(resultCodes.has("completed-task-mismatch"))
  })

  await t.test("executable E2E ID without canonical trace is rejected", () => {
    const repoRoot = createFixture()
    writeFile(repoRoot, "apps/web/e2e/orphan.spec.ts", "test('E2E-UI-ORPHAN-001', () => {})\n")
    const resultCodes = codes(validateUiTraceability({ repoRoot, manifest: baseManifest(), screens: [screen()] }))
    assert.ok(resultCodes.has("missing-verification-trace"))
  })

  await t.test("generated stale output is detected", () => {
    const outputs = new Map([
      ["fresh.md", "fresh\n"],
      ["stale.md", "expected\n"],
      ["missing.md", "expected\n"]
    ])
    const current = new Map([
      ["fresh.md", "fresh\n"],
      ["stale.md", "old\n"]
    ])
    const stale = findStaleGeneratedFiles(Object.fromEntries(outputs), {
      existsSync: (filePath) => current.has(filePath),
      readFileSync: (filePath) => current.get(filePath)
    })
    assert.deepEqual(stale, ["stale.md", "missing.md"])
  })
})
