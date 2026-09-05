import assert from "node:assert/strict"
import test from "node:test"
import {
  readManualA11yEvidenceContract,
  summarizeManualA11yEvidence,
  validateManualA11yEvidence
} from "./manual-a11y-evidence.mjs"

const contract = readManualA11yEvidenceContract()

function owner(role = "Accessibility QA") {
  return { assignmentStatus: "assigned", role }
}

function environment(evidenceClass) {
  return {
    os: { name: "Test OS", version: "1" },
    browser: { name: "Test Browser", version: "1" },
    device: { category: evidenceClass === "real_device" ? "mobile" : "desktop", name: evidenceClass === "real_device" ? "Test Device" : null },
    assistiveTechnology: evidenceClass === "screen_reader" ? { name: "Test Reader", version: "1" } : null
  }
}

function scope(evidenceClass) {
  return {
    personas: ["standard-user"],
    journeys: ["login-to-chat"],
    viewport: evidenceClass === "real_device" ? { width: 390, height: 844 } : { width: 1280, height: 720 },
    zoomPercent: evidenceClass === "browser_zoom" ? 400 : null,
    inputs: evidenceClass === "manual_keyboard" ? ["keyboard"] : evidenceClass === "real_device" ? ["touch"] : ["screen_reader"]
  }
}

function passingCheck(evidenceClass, index) {
  return {
    id: `MANUAL-UI-${evidenceClass.replaceAll("_", "-").toUpperCase()}-${index}`,
    evidenceClass,
    required: true,
    status: "pass",
    scope: scope(evidenceClass),
    execution: { mode: "manual", executedAt: "2026-07-17T00:00:00+09:00", executorRole: "Accessibility QA" },
    environment: environment(evidenceClass),
    owner: owner(),
    evidence: [{ kind: "manual_notes", path: "reports/working/manual.md" }],
    defects: [],
    blocker: null,
    decision: null
  }
}

function passingRecord() {
  return {
    schemaVersion: 1,
    evidenceId: "E2E-UI-MANUAL-001",
    recordedAt: "2026-07-17T00:00:00+09:00",
    releaseReference: { kind: "test", reference: "test-record", sourceCommit: "abcdef1" },
    requirementRefs: ["NFR-018/AC-NFR018-005", "SQ-016/AC-SQ016-008"],
    matrix: { approvalStatus: "approved", owner: owner(), cadence: "per release", openQuestionIds: [] },
    checks: contract.requiredEvidenceClasses.map((evidenceClass, index) => passingCheck(evidenceClass, index + 1))
  }
}

function blockedRecord() {
  const record = passingRecord()
  record.matrix = {
    approvalStatus: "open_question",
    owner: { assignmentStatus: "unassigned", role: null },
    cadence: null,
    openQuestionIds: ["OQ-UI-002"]
  }
  record.checks = contract.requiredEvidenceClasses.map((evidenceClass, index) => ({
    id: `MANUAL-UI-${evidenceClass.replaceAll("_", "-").toUpperCase()}-${index + 1}`,
    evidenceClass,
    required: true,
    status: evidenceClass === "manual_keyboard" ? "not_run" : "blocked",
    scope: scope(evidenceClass),
    execution: null,
    environment: null,
    owner: null,
    evidence: [],
    defects: [],
    blocker: {
      reason: "承認済み環境と実施者が未割り当てである。",
      risk: "実操作の適合性を証明できない。",
      owner: { assignmentStatus: "unassigned", role: null },
      nextAction: "OQ-UI-002 を決定して実測する。",
      openQuestionIds: ["OQ-UI-002"],
      task: "tasks/todo/20260714-issue-345-manual-a11y-evidence.md"
    },
    decision: null
  }))
  return record
}

function codes(record) {
  return new Set(validateManualA11yEvidence(record, { contract }).map((item) => item.code))
}

test("NONUI-UI-MANUAL-EVIDENCE-001 valid manual pass record is structurally valid and release-ready", () => {
  const record = passingRecord()
  assert.deepEqual(validateManualA11yEvidence(record, { contract }), [])
  assert.equal(summarizeManualA11yEvidence(record, { contract }).ready, true)
})

test("honest blocked record is structurally valid but never release-ready", () => {
  const record = blockedRecord()
  assert.deepEqual(validateManualA11yEvidence(record, { contract }), [])
  const summary = summarizeManualA11yEvidence(record, { contract })
  assert.equal(summary.ready, false)
  assert.deepEqual(summary.statusCounts, { pass: 0, fail: 0, blocked: 3, not_run: 1, not_applicable: 0 })
})

test("pass without evidence is rejected", () => {
  const record = passingRecord()
  record.checks[0].evidence = []
  assert.ok(codes(record).has("missing-manual-evidence"))
})

test("automation-only evidence cannot become a manual pass", () => {
  const record = passingRecord()
  record.checks[0].evidence = [{ kind: "automated_playwright", path: "playwright-report/index.html" }]
  assert.ok(codes(record).has("invalid-evidence-kind"))
})

test("fail without assigned defect trace is rejected", () => {
  const record = passingRecord()
  record.checks[0].status = "fail"
  record.checks[0].defects = []
  assert.ok(codes(record).has("missing-defect-trace"))
})

test("duplicate check ids are rejected", () => {
  const record = passingRecord()
  record.checks[1].id = record.checks[0].id
  assert.ok(codes(record).has("duplicate-check-id"))
})

test("unknown schema version and status are rejected", () => {
  const record = passingRecord()
  record.schemaVersion = 99
  record.checks[0].status = "pending"
  const resultCodes = codes(record)
  assert.ok(resultCodes.has("invalid-schema-version"))
  assert.ok(resultCodes.has("invalid-status"))
})
