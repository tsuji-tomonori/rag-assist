#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
export const manualA11yEvidenceContractPath = path.join(moduleDirectory, "manual-a11y-evidence-contract.json")
export const defaultManualA11yEvidencePath = "reports/working/issue-345-manual-a11y-evidence-baseline.json"

export function readManualA11yEvidenceContract() {
  return JSON.parse(fs.readFileSync(manualA11yEvidenceContractPath, "utf8"))
}

function issue(code, subject, message) {
  return { code, subject, message }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}

function isIsoDate(value) {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value)) && value.includes("T")
}

function duplicateValues(values) {
  const seen = new Set()
  const duplicates = new Set()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates]
}

function validateStringArray(value, subject, field, issues) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => !isNonEmptyString(item))) {
    issues.push(issue("missing-field", subject, `${field} は非空文字列の配列である必要があります。`))
  }
}

function validateRepositoryPath(repoRoot, repositoryPath, subject, code, issues) {
  if (!repoRoot || !isNonEmptyString(repositoryPath)) return
  if (path.isAbsolute(repositoryPath)) {
    issues.push(issue(code, subject, `repository-relative path が必要です: ${repositoryPath}`))
    return
  }
  const resolved = path.resolve(repoRoot, repositoryPath)
  const relative = path.relative(repoRoot, resolved)
  if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    issues.push(issue(code, subject, `参照先ファイルが存在しません: ${repositoryPath}`))
  }
}

function validateOwner(owner, subject, contract, issues, { requireAssigned = false } = {}) {
  if (!owner || !contract.ownerAssignmentStatuses.includes(owner.assignmentStatus)) {
    issues.push(issue("invalid-owner", subject, "owner.assignmentStatus は assigned/unassigned のいずれかである必要があります。"))
    return
  }
  if (requireAssigned && owner.assignmentStatus !== "assigned") {
    issues.push(issue("unassigned-owner", subject, "実施済み結果には assigned owner が必要です。"))
  }
  if (owner.assignmentStatus === "assigned" && !isNonEmptyString(owner.role)) {
    issues.push(issue("invalid-owner", subject, "assigned owner には非空の role が必要です。"))
  }
  if (owner.assignmentStatus === "unassigned" && owner.role !== null) {
    issues.push(issue("invalid-owner", subject, "unassigned owner の role は null である必要があります。"))
  }
}

function validateScope(check, subject, issues) {
  const scope = check.scope
  if (!scope || typeof scope !== "object") {
    issues.push(issue("missing-scope", subject, "scope が必要です。"))
    return
  }
  validateStringArray(scope.personas, subject, "scope.personas", issues)
  validateStringArray(scope.journeys, subject, "scope.journeys", issues)
  validateStringArray(scope.inputs, subject, "scope.inputs", issues)
  if (scope.zoomPercent !== null && ![200, 400].includes(scope.zoomPercent)) {
    issues.push(issue("invalid-zoom", subject, "scope.zoomPercent は null、200、400 のいずれかである必要があります。"))
  }
  if (scope.viewport !== null) {
    const width = scope.viewport?.width
    const height = scope.viewport?.height
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
      issues.push(issue("invalid-viewport", subject, "scope.viewport には正の整数 width/height が必要です。"))
    }
  }
}

function validateExecutionAndEnvironment(check, subject, issues) {
  const execution = check.execution
  if (execution?.mode !== "manual" || !isIsoDate(execution.executedAt) || !isNonEmptyString(execution.executorRole)) {
    issues.push(issue("invalid-manual-execution", subject, "pass/fail には mode=manual、executedAt、executorRole が必要です。"))
  }

  const environment = check.environment
  if (!environment || !isNonEmptyString(environment.os?.name) || !isNonEmptyString(environment.os?.version)
    || !isNonEmptyString(environment.browser?.name) || !isNonEmptyString(environment.browser?.version)
    || !isNonEmptyString(environment.device?.category)) {
    issues.push(issue("invalid-environment", subject, "pass/fail には OS、browser、device category を含む完全な environment が必要です。"))
    return
  }

  if (check.evidenceClass === "screen_reader"
    && (!isNonEmptyString(environment.assistiveTechnology?.name) || !isNonEmptyString(environment.assistiveTechnology?.version))) {
    issues.push(issue("missing-assistive-technology", subject, "screen_reader の pass/fail には assistiveTechnology name/version が必要です。"))
  }
  if (check.evidenceClass === "real_device"
    && (environment.device.category === "emulated" || !isNonEmptyString(environment.device.name))) {
    issues.push(issue("invalid-real-device", subject, "real_device の pass/fail には non-emulated の named device が必要です。"))
  }
}

function validateManualEvidence(check, subject, contract, repoRoot, issues) {
  if (!Array.isArray(check.evidence) || check.evidence.length === 0) {
    issues.push(issue("missing-manual-evidence", subject, "pass/fail には manual evidence が 1 件以上必要です。"))
    return
  }
  for (const evidence of check.evidence) {
    if (!contract.manualEvidenceKinds.includes(evidence?.kind)) {
      issues.push(issue("invalid-evidence-kind", subject, `manual evidence として使えない kind です: ${String(evidence?.kind)}`))
    }
    if (!isNonEmptyString(evidence?.path)) {
      issues.push(issue("missing-manual-evidence", subject, "evidence.path が必要です。"))
    } else {
      validateRepositoryPath(repoRoot, evidence.path, subject, "missing-manual-evidence", issues)
    }
  }
}

function validateDefects(check, subject, contract, repoRoot, issues) {
  if (!Array.isArray(check.defects) || check.defects.length === 0) {
    issues.push(issue("missing-defect-trace", subject, "fail には defect trace が 1 件以上必要です。"))
    return
  }
  for (const defect of check.defects) {
    if (!isNonEmptyString(defect?.id) || !contract.defectSeverities.includes(defect?.severity)
      || !contract.retestStatuses.includes(defect?.retestStatus) || !isNonEmptyString(defect?.task)) {
      issues.push(issue("invalid-defect-trace", subject, "defect には id、severity、task、retestStatus が必要です。"))
      continue
    }
    validateOwner(defect.owner, `${subject}/defect:${defect.id}`, contract, issues, { requireAssigned: true })
    validateRepositoryPath(repoRoot, defect.task, subject, "missing-defect-task", issues)
  }
}

function validatePendingResult(check, subject, contract, repoRoot, issues) {
  if (check.execution !== null || check.environment !== null) {
    issues.push(issue("unexpected-execution", subject, "blocked/not_run の execution/environment は null である必要があります。"))
  }
  const blocker = check.blocker
  if (!blocker || !isNonEmptyString(blocker.reason) || !isNonEmptyString(blocker.risk)
    || !isNonEmptyString(blocker.nextAction) || !isNonEmptyString(blocker.task)) {
    issues.push(issue("missing-blocker-trace", subject, "blocked/not_run には reason、risk、nextAction、task が必要です。"))
    return
  }
  validateOwner(blocker.owner, `${subject}/blocker`, contract, issues)
  validateStringArray(blocker.openQuestionIds, subject, "blocker.openQuestionIds", issues)
  validateRepositoryPath(repoRoot, blocker.task, subject, "missing-blocker-task", issues)
  if (Array.isArray(check.evidence) && check.evidence.length > 0) {
    issues.push(issue("unexpected-manual-evidence", subject, "未実施の blocked/not_run に manual result evidence を設定できません。"))
  }
}

function validateNotApplicable(check, subject, issues) {
  if (!check.decision || !isNonEmptyString(check.decision.reason)
    || !isNonEmptyString(check.decision.approvedByRole) || !isIsoDate(check.decision.decidedAt)) {
    issues.push(issue("missing-na-decision", subject, "not_applicable には reason、approvedByRole、decidedAt が必要です。"))
  }
}

export function validateManualA11yEvidence(record, { repoRoot, contract = readManualA11yEvidenceContract() } = {}) {
  const issues = []
  if (record?.schemaVersion !== contract.recordSchemaVersion) {
    issues.push(issue("invalid-schema-version", "record", `schemaVersion は ${contract.recordSchemaVersion} である必要があります。`))
  }
  if (record?.evidenceId !== contract.evidenceId) {
    issues.push(issue("invalid-evidence-id", "record", `evidenceId は ${contract.evidenceId} である必要があります。`))
  }
  if (!isIsoDate(record?.recordedAt)) issues.push(issue("invalid-recorded-at", "record", "recordedAt は ISO date-time である必要があります。"))
  if (!record?.releaseReference || !isNonEmptyString(record.releaseReference.kind)
    || !isNonEmptyString(record.releaseReference.reference) || !/^[0-9a-f]{7,40}$/.test(record.releaseReference.sourceCommit ?? "")) {
    issues.push(issue("invalid-release-reference", "record", "releaseReference に kind、reference、sourceCommit が必要です。"))
  }
  validateStringArray(record?.requirementRefs, "record", "requirementRefs", issues)

  const matrix = record?.matrix
  if (!matrix || !contract.matrixApprovalStatuses.includes(matrix.approvalStatus)) {
    issues.push(issue("invalid-matrix", "record", "matrix.approvalStatus が不正です。"))
  } else {
    validateOwner(matrix.owner, "record/matrix", contract, issues, { requireAssigned: matrix.approvalStatus === "approved" })
    if (matrix.approvalStatus === "approved" && !isNonEmptyString(matrix.cadence)) {
      issues.push(issue("invalid-matrix", "record", "approved matrix には cadence が必要です。"))
    }
    if (matrix.approvalStatus !== "approved") validateStringArray(matrix.openQuestionIds, "record", "matrix.openQuestionIds", issues)
  }

  if (!Array.isArray(record?.checks) || record.checks.length === 0) {
    issues.push(issue("missing-checks", "record", "checks が 1 件以上必要です。"))
    return issues
  }
  for (const duplicate of duplicateValues(record.checks.map((check) => check?.id))) {
    issues.push(issue("duplicate-check-id", String(duplicate), "check ID が重複しています。"))
  }
  for (const evidenceClass of contract.requiredEvidenceClasses) {
    if (!record.checks.some((check) => check?.required === true && check?.evidenceClass === evidenceClass)) {
      issues.push(issue("missing-required-class", evidenceClass, "required evidence class の check が必要です。"))
    }
  }

  for (const check of record.checks) {
    const subject = `check:${String(check?.id)}`
    if (!isNonEmptyString(check?.id) || !/^MANUAL-UI-[A-Z0-9-]+-\d+$/.test(check.id)) {
      issues.push(issue("invalid-check-id", subject, "check ID の形式が不正です。"))
    }
    if (!contract.requiredEvidenceClasses.includes(check?.evidenceClass)) {
      issues.push(issue("invalid-evidence-class", subject, `evidenceClass が不正です: ${String(check?.evidenceClass)}`))
    }
    if (typeof check?.required !== "boolean") issues.push(issue("missing-field", subject, "required boolean が必要です。"))
    if (!contract.statuses.includes(check?.status)) {
      issues.push(issue("invalid-status", subject, `status が不正です: ${String(check?.status)}`))
      continue
    }
    validateScope(check, subject, issues)

    if (check.status === "pass" || check.status === "fail") {
      validateExecutionAndEnvironment(check, subject, issues)
      validateManualEvidence(check, subject, contract, repoRoot, issues)
      validateOwner(check.owner, `${subject}/result`, contract, issues, { requireAssigned: true })
      if (check.evidenceClass === "manual_keyboard" && !check.scope?.inputs?.includes("keyboard")) {
        issues.push(issue("invalid-input-scope", subject, "manual_keyboard の pass/fail には keyboard input が必要です。"))
      }
      if (check.evidenceClass === "browser_zoom" && ![200, 400].includes(check.scope?.zoomPercent)) {
        issues.push(issue("invalid-zoom", subject, "browser_zoom の pass/fail には 200% または 400% が必要です。"))
      }
      if (check.status === "fail") validateDefects(check, subject, contract, repoRoot, issues)
      if (check.status === "pass" && Array.isArray(check.defects) && check.defects.length > 0) {
        issues.push(issue("unexpected-defect", subject, "pass に unresolved defect を設定できません。"))
      }
    } else if (check.status === "blocked" || check.status === "not_run") {
      validatePendingResult(check, subject, contract, repoRoot, issues)
    } else {
      validateNotApplicable(check, subject, issues)
    }
  }
  return issues
}

export function summarizeManualA11yEvidence(record, { contract = readManualA11yEvidenceContract() } = {}) {
  const checks = Array.isArray(record?.checks) ? record.checks : []
  const statusCounts = Object.fromEntries(contract.statuses.map((status) => [status, checks.filter((check) => check?.status === status).length]))
  const requiredChecks = checks.filter((check) => check?.required === true)
  const missingRequiredClasses = contract.requiredEvidenceClasses.filter((evidenceClass) => !requiredChecks.some((check) => check?.evidenceClass === evidenceClass))
  const ready = record?.matrix?.approvalStatus === "approved"
    && missingRequiredClasses.length === 0
    && requiredChecks.length > 0
    && requiredChecks.every((check) => check.status === "pass")
  return {
    evidenceId: record?.evidenceId ?? null,
    matrixApprovalStatus: record?.matrix?.approvalStatus ?? null,
    requiredCheckCount: requiredChecks.length,
    statusCounts,
    missingRequiredClasses,
    ready
  }
}

export function readManualA11yEvidence(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function runCli() {
  const args = process.argv.slice(2)
  const requirePass = args.includes("--require-pass")
  const recordArgument = args.find((arg) => !arg.startsWith("--")) ?? defaultManualA11yEvidencePath
  const repoRoot = process.cwd()
  const recordPath = path.resolve(repoRoot, recordArgument)
  let record
  try {
    record = readManualA11yEvidence(recordPath)
  } catch (error) {
    console.error(JSON.stringify({ error: "manual evidence record を読み込めません。", detail: String(error) }, null, 2))
    process.exitCode = 1
    return
  }

  const issues = validateManualA11yEvidence(record, { repoRoot })
  const summary = summarizeManualA11yEvidence(record)
  if (issues.length > 0) {
    console.error(JSON.stringify({ summary, issues }, null, 2))
    process.exitCode = 1
    return
  }
  console.log(JSON.stringify(summary, null, 2))
  if (requirePass && !summary.ready) {
    console.error("required manual a11y evidence が pass ではないため、release / Issue completion readiness を拒否しました。")
    process.exitCode = 2
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli()
