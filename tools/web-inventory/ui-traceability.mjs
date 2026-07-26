import fs from "node:fs"
import path from "node:path"

export const uiTraceManifestPath = "tools/web-inventory/ui-traceability.json"
const requirementRoot = "docs/1_要求_REQ"
const validVerificationStatuses = new Set(["implemented", "planned", "manual"])
const validImplementationStatuses = new Set(["implemented", "partial", "planned"])

function issue(code, subject, message) {
  return { code, subject, message }
}

function sortedUnique(values) {
  return [...new Set(values)].sort()
}

function duplicateValues(values) {
  const seen = new Set()
  const duplicates = new Set()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates].sort()
}

function walkMarkdownFiles(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return walkMarkdownFiles(entryPath)
    return entry.isFile() && entry.name.endsWith(".md") ? [entryPath] : []
  })
}

function collectExecutableE2eIds(repoRoot) {
  const e2eRoot = path.join(repoRoot, "apps/web/e2e")
  if (!fs.existsSync(e2eRoot)) return []

  const sourceFiles = fs.readdirSync(e2eRoot, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(e2eRoot, entry.name)
    return entry.isFile() && entry.name.endsWith(".spec.ts") ? [entryPath] : []
  })

  return sortedUnique(sourceFiles.flatMap((filePath) => (
    [...fs.readFileSync(filePath, "utf8").matchAll(/\bE2E-[A-Z0-9-]+-\d+\b/g)].map((match) => match[0])
  )))
}

function buildRequirementIndex(repoRoot) {
  const index = new Map()
  for (const filePath of walkMarkdownFiles(path.join(repoRoot, requirementRoot))) {
    const content = fs.readFileSync(filePath, "utf8")
    const requirementMatch = content.match(/^- 要件ID: `([A-Z]+-\d+)`/m)
    if (!requirementMatch?.[1]) continue
    const acceptanceCriteria = new Set([...content.matchAll(/`(AC-[A-Z]+\d+-\d+)`/g)].map((match) => match[1]))
    index.set(requirementMatch[1], {
      path: path.relative(repoRoot, filePath).replaceAll(path.sep, "/"),
      acceptanceCriteria
    })
  }
  return index
}

function resolveRepositoryPath(repoRoot, repositoryPath) {
  if (typeof repositoryPath !== "string" || repositoryPath.length === 0 || path.isAbsolute(repositoryPath)) return null
  const resolved = path.resolve(repoRoot, repositoryPath)
  const relative = path.relative(repoRoot, resolved)
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null
  return resolved
}

function validateRepositoryFile(repoRoot, repositoryPath, subject, code, issues) {
  const resolved = resolveRepositoryPath(repoRoot, repositoryPath)
  if (!resolved) {
    issues.push(issue(code, subject, `repository-relative path が不正です: ${String(repositoryPath)}`))
    return null
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    issues.push(issue(code, subject, `参照先ファイルが存在しません: ${repositoryPath}`))
    return null
  }
  return resolved
}

function validateRequirementReferences(references, subject, requirementIndex, issues) {
  if (!Array.isArray(references) || references.length === 0) {
    issues.push(issue("missing-requirement", subject, "canonical requirement が 1 件以上必要です。"))
    return
  }
  for (const reference of references) {
    const requirementId = reference?.id
    const indexed = requirementIndex.get(requirementId)
    if (!indexed) {
      issues.push(issue("missing-requirement", subject, `canonical requirement が見つかりません: ${String(requirementId)}`))
      continue
    }
    if (!Array.isArray(reference.acceptanceCriteria) || reference.acceptanceCriteria.length === 0) {
      issues.push(issue("missing-acceptance", `${subject}/${requirementId}`, "requirement-local acceptance criteria が必要です。"))
      continue
    }
    for (const acceptanceId of reference.acceptanceCriteria) {
      if (!indexed.acceptanceCriteria.has(acceptanceId)) {
        issues.push(issue("acceptance-mismatch", `${subject}/${requirementId}`, `${acceptanceId} は ${indexed.path} に存在しません。`))
      }
    }
  }
}

function validateVerification(verification, subject, repoRoot, issues) {
  const verificationId = verification?.id
  const verificationSubject = `${subject}/${String(verificationId)}`
  if (typeof verificationId !== "string" || !/^(E2E|NONUI)-[A-Z0-9-]+-\d+$/.test(verificationId)) {
    issues.push(issue("invalid-verification", verificationSubject, "verification ID の形式が不正です。"))
  }
  if (!validVerificationStatuses.has(verification?.status)) {
    issues.push(issue("invalid-verification-status", verificationSubject, `status が不正です: ${String(verification?.status)}`))
    return
  }

  const evidence = Array.isArray(verification.evidence) ? verification.evidence : []
  const resolvedEvidence = evidence
    .map((evidencePath) => validateRepositoryFile(repoRoot, evidencePath, verificationSubject, "missing-evidence", issues))
    .filter(Boolean)

  if (verification.status === "implemented") {
    if (evidence.length === 0) {
      issues.push(issue("missing-evidence", verificationSubject, "implemented verification には test evidence が必要です。"))
      return
    }
    const idFound = resolvedEvidence.some((filePath) => fs.readFileSync(filePath, "utf8").includes(verificationId))
    if (!idFound) {
      issues.push(issue("missing-test-id", verificationSubject, "verification ID が evidence source 内に見つかりません。"))
    }
  }

  if (verification.status === "planned") {
    validateRepositoryFile(repoRoot, verification.task, verificationSubject, "missing-task", issues)
  }

  if (verification.status === "manual" && evidence.length === 0 && !verification.task) {
    issues.push(issue("missing-manual-evidence", verificationSubject, "manual verification には evidence または未完了 task が必要です。"))
  } else if (verification.status === "manual" && verification.task) {
    validateRepositoryFile(repoRoot, verification.task, verificationSubject, "missing-task", issues)
  }
  if (verification.status === "manual" && resolvedEvidence.length > 0) {
    const idFound = resolvedEvidence.some((filePath) => fs.readFileSync(filePath, "utf8").includes(verificationId))
    if (!idFound) issues.push(issue("missing-manual-evidence", verificationSubject, "verification ID が manual evidence record 内に見つかりません。"))
  }
}

export function readUiTraceManifest(repoRoot) {
  const manifestFile = path.join(repoRoot, uiTraceManifestPath)
  return JSON.parse(fs.readFileSync(manifestFile, "utf8"))
}

export function validateUiTraceability({ repoRoot, manifest, screens }) {
  const issues = []
  const sourceScreens = Array.isArray(screens) ? screens : []
  const sourceViews = sourceScreens.map((screen) => screen.view)
  const sourceViewSet = new Set(sourceViews)
  const sourceGuards = new Set(sourceScreens.flatMap((screen) => screen.permissions ?? []))
  const personas = Array.isArray(manifest?.personas) ? manifest.personas : []
  const views = Array.isArray(manifest?.views) ? manifest.views : []
  const qualityRequirements = Array.isArray(manifest?.qualityRequirements) ? manifest.qualityRequirements : []
  const crossViewVerifications = Array.isArray(manifest?.crossViewVerifications) ? manifest.crossViewVerifications : []
  const requirementIndex = buildRequirementIndex(repoRoot)

  if (manifest?.schemaVersion !== 1) issues.push(issue("invalid-schema", "manifest", "schemaVersion は 1 である必要があります。"))

  for (const duplicate of duplicateValues(sourceViews)) {
    issues.push(issue("duplicate-source-view", String(duplicate), "production AppView が重複しています。"))
  }

  const personaIds = personas.map((persona) => persona?.id)
  for (const duplicate of duplicateValues(personaIds)) {
    issues.push(issue("duplicate-persona", String(duplicate), "persona ID が重複しています。"))
  }
  const personaIdSet = new Set(personaIds)
  for (const persona of personas) {
    if (!persona?.id || !persona?.label || !persona?.jobContext) {
      issues.push(issue("invalid-persona", String(persona?.id), "id、label、jobContext が必要です。"))
    }
  }

  const manifestViews = views.map((view) => view?.view)
  for (const duplicate of duplicateValues(manifestViews)) {
    issues.push(issue("duplicate-view", String(duplicate), "view trace が重複しています。"))
  }
  for (const view of sortedUnique(sourceViews.filter((sourceView) => !manifestViews.includes(sourceView)))) {
    issues.push(issue("missing-view", view, "production AppView に対応する trace がありません。"))
  }
  for (const view of sortedUnique(manifestViews.filter((manifestView) => !sourceViewSet.has(manifestView)))) {
    issues.push(issue("orphan-view", String(view), "production AppView に存在しない trace です。"))
  }

  const allJobIds = []
  const allVerifications = [...crossViewVerifications]
  for (const viewTrace of views) {
    const viewId = viewTrace?.view
    const subject = `view:${String(viewId)}`
    const sourceScreen = sourceScreens.find((screen) => screen.view === viewId)

    if (!viewTrace?.canonicalUrl || !Array.isArray(viewTrace?.urlPatterns) || !viewTrace.urlPatterns.includes(viewTrace.canonicalUrl)) {
      issues.push(issue("invalid-url", subject, "canonicalUrl は urlPatterns に含まれる必要があります。"))
    }
    for (const duplicate of duplicateValues(viewTrace?.urlPatterns ?? [])) {
      issues.push(issue("duplicate-reference", subject, `URL pattern が重複しています: ${duplicate}`))
    }
    for (const urlPattern of viewTrace?.urlPatterns ?? []) {
      if (typeof urlPattern !== "string" || !urlPattern.startsWith("/")) {
        issues.push(issue("invalid-url", subject, `URL pattern が不正です: ${String(urlPattern)}`))
      }
    }

    const configuredGuards = sortedUnique(viewTrace?.access?.guards ?? [])
    const actualGuards = sortedUnique(sourceScreen?.permissions ?? [])
    for (const guard of configuredGuards.filter((guard) => !sourceGuards.has(guard))) {
      issues.push(issue("invalid-permission", subject, `production route に存在しない guard です: ${guard}`))
    }
    if (configuredGuards.join(",") !== actualGuards.join(",")) {
      issues.push(issue("permission-mismatch", subject, `guard が source と一致しません。expected=${actualGuards.join(",") || "none"} actual=${configuredGuards.join(",") || "none"}`))
    }

    if (!Array.isArray(viewTrace?.personas) || viewTrace.personas.length === 0) {
      issues.push(issue("missing-persona", subject, "persona が 1 件以上必要です。"))
    }
    for (const duplicate of duplicateValues(viewTrace?.personas ?? [])) {
      issues.push(issue("duplicate-reference", subject, `persona reference が重複しています: ${duplicate}`))
    }
    for (const personaId of viewTrace?.personas ?? []) {
      if (!personaIdSet.has(personaId)) issues.push(issue("invalid-persona-ref", subject, `未定義の persona です: ${personaId}`))
    }

    if (!Array.isArray(viewTrace?.jobs) || viewTrace.jobs.length === 0) {
      issues.push(issue("missing-job", subject, "主要 job が 1 件以上必要です。"))
    }
    for (const job of viewTrace?.jobs ?? []) {
      allJobIds.push(job?.id)
      if (!job?.id || !job?.summary) issues.push(issue("invalid-job", subject, "job の id と summary が必要です。"))
    }

    const requirementReferences = Array.isArray(viewTrace?.requirements) ? viewTrace.requirements : []
    for (const duplicate of duplicateValues(requirementReferences.map((reference) => reference?.id))) {
      issues.push(issue("duplicate-requirement-ref", subject, `requirement reference が重複しています: ${duplicate}`))
    }
    for (const reference of requirementReferences) {
      for (const duplicate of duplicateValues(reference?.acceptanceCriteria ?? [])) {
        issues.push(issue("duplicate-acceptance-ref", `${subject}/${String(reference?.id)}`, `acceptance reference が重複しています: ${duplicate}`))
      }
    }
    validateRequirementReferences(requirementReferences, subject, requirementIndex, issues)

    if (!validImplementationStatuses.has(viewTrace?.implementationStatus)) {
      issues.push(issue("invalid-implementation-status", subject, `implementationStatus が不正です: ${String(viewTrace?.implementationStatus)}`))
    }
    const gapTasks = Array.isArray(viewTrace?.gapTasks) ? viewTrace.gapTasks : []
    if (viewTrace?.implementationStatus !== "implemented" && gapTasks.length === 0) {
      issues.push(issue("missing-task", subject, "未完了 view trace には gap task が必要です。"))
    }
    for (const duplicate of duplicateValues(gapTasks)) {
      issues.push(issue("duplicate-reference", subject, `gap task が重複しています: ${duplicate}`))
    }
    for (const taskPath of gapTasks) {
      validateRepositoryFile(repoRoot, taskPath, subject, "missing-task", issues)
      if (typeof taskPath === "string" && taskPath.startsWith("tasks/done/")) {
        issues.push(issue("completed-task-mismatch", subject, `未完了 trace が done task を参照しています: ${taskPath}`))
      }
    }

    const implementationEvidence = Array.isArray(viewTrace?.implementationEvidence) ? viewTrace.implementationEvidence : []
    if (implementationEvidence.length === 0) issues.push(issue("missing-evidence", subject, "implementation evidence が必要です。"))
    for (const duplicate of duplicateValues(implementationEvidence)) {
      issues.push(issue("duplicate-reference", subject, `implementation evidence が重複しています: ${duplicate}`))
    }
    for (const evidencePath of implementationEvidence) validateRepositoryFile(repoRoot, evidencePath, subject, "missing-evidence", issues)

    const verifications = Array.isArray(viewTrace?.verifications) ? viewTrace.verifications : []
    if (verifications.length === 0) issues.push(issue("missing-verification", subject, "verification が 1 件以上必要です。"))
    if (!verifications.some((verification) => verification?.status === "implemented")) {
      issues.push(issue("missing-implemented-verification", subject, "implemented executable verification が 1 件以上必要です。"))
    }
    allVerifications.push(...verifications)
    for (const verification of verifications) validateVerification(verification, subject, repoRoot, issues)
  }

  for (const duplicate of duplicateValues(allJobIds)) {
    issues.push(issue("duplicate-job", String(duplicate), "job ID が重複しています。"))
  }

  for (const duplicate of duplicateValues(qualityRequirements.map((reference) => reference?.id))) {
    issues.push(issue("duplicate-requirement-ref", "quality", `quality requirement reference が重複しています: ${duplicate}`))
  }
  for (const qualityReference of qualityRequirements) {
    const appliesTo = qualityReference?.appliesTo ?? []
    if (!Array.isArray(appliesTo) || appliesTo.length === 0) {
      issues.push(issue("missing-view", `quality:${String(qualityReference?.id)}`, "appliesTo が必要です。"))
    }
    for (const viewId of appliesTo) {
      if (viewId !== "*" && !sourceViewSet.has(viewId)) issues.push(issue("orphan-view", `quality:${String(qualityReference?.id)}`, `appliesTo の view が存在しません: ${viewId}`))
    }
    validateRequirementReferences([qualityReference], `quality:${String(qualityReference?.id)}`, requirementIndex, issues)
  }

  for (const verification of crossViewVerifications) validateVerification(verification, "cross-view", repoRoot, issues)
  const verificationIds = allVerifications.map((verification) => verification?.id)
  for (const duplicate of duplicateValues(verificationIds)) {
    issues.push(issue("duplicate-verification", String(duplicate), "verification ID が重複しています。"))
  }
  const registeredVerificationIds = new Set(verificationIds)
  for (const executableE2eId of collectExecutableE2eIds(repoRoot)) {
    if (!registeredVerificationIds.has(executableE2eId)) {
      issues.push(issue("missing-verification-trace", executableE2eId, "実行可能E2E IDがcanonical UI traceに登録されていません。"))
    }
  }

  return issues
}

export function formatUiTraceIssues(issues) {
  return issues.map(({ code, subject, message }) => `[${code}] ${subject}: ${message}`).join("\n")
}

export function findStaleGeneratedFiles(outputs, {
  existsSync = fs.existsSync,
  readFileSync = (filePath) => fs.readFileSync(filePath, "utf8")
} = {}) {
  return Object.entries(outputs)
    .filter(([filePath, content]) => !existsSync(filePath) || readFileSync(filePath) !== content)
    .map(([filePath]) => filePath)
}

export function enrichInventoryWithUiTrace(inventory, manifest) {
  const traceByView = new Map(manifest.views.map((viewTrace) => [viewTrace.view, viewTrace]))
  return {
    ...inventory,
    traceability: {
      generatedFrom: uiTraceManifestPath,
      schemaVersion: manifest.schemaVersion,
      personas: manifest.personas,
      qualityRequirements: manifest.qualityRequirements,
      crossViewVerifications: manifest.crossViewVerifications
    },
    screens: inventory.screens.map((screen) => {
      const trace = traceByView.get(screen.view)
      return {
        ...screen,
        routePath: trace.canonicalUrl,
        routeKind: trace.routeKind,
        trace
      }
    })
  }
}
