import fs from "node:fs"
import path from "node:path"

export const uiQualityMatrixPath = "tools/web-inventory/ui-quality-matrix.json"
export const uiQualityMatrixOutputPath = "docs/generated/web-ui-quality-matrix.md"

const validStatuses = new Set(["pass", "fail", "blocked", "not_applicable"])

function issue(code, subject, message) {
  return { code, subject, message }
}

function sorted(values) {
  return [...values].sort()
}

function duplicateValues(values) {
  const seen = new Set()
  const duplicates = new Set()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return sorted(duplicates)
}

function repositoryFileExists(repoRoot, repositoryPath) {
  if (typeof repositoryPath !== "string" || repositoryPath.length === 0 || path.isAbsolute(repositoryPath)) return false
  const resolved = path.resolve(repoRoot, repositoryPath)
  const relative = path.relative(repoRoot, resolved)
  return !relative.startsWith("..") && !path.isAbsolute(relative) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()
}

export function deriveOverallStatus({ automated, manual }, methods) {
  const requiredStatuses = []
  if (methods.automated.required) requiredStatuses.push(automated)
  if (methods.manual.required) requiredStatuses.push(manual)
  if (requiredStatuses.includes("fail")) return "fail"
  if (requiredStatuses.includes("blocked")) return "blocked"
  if (requiredStatuses.length > 0 && requiredStatuses.every((status) => status === "not_applicable")) return "not_applicable"
  return "pass"
}

export function readUiQualityMatrix(repoRoot) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, uiQualityMatrixPath), "utf8"))
}

export function validateUiQualityMatrix({ repoRoot, matrix, traceManifest }) {
  const issues = []
  if (matrix?.schemaVersion !== 1) issues.push(issue("invalid-schema", "matrix", "schemaVersion は 1 である必要があります。"))
  if (matrix?.requirement !== "SQ-016") issues.push(issue("invalid-requirement", "matrix", "requirement は SQ-016 である必要があります。"))

  const axes = Array.isArray(matrix?.axes) ? matrix.axes : []
  const axisIds = axes.map((axis) => axis?.id)
  const expectedAxisIds = Array.from({ length: 8 }, (_, index) => `AC-SQ016-00${index + 1}`)
  for (const duplicate of duplicateValues(axisIds)) issues.push(issue("duplicate-axis", String(duplicate), "quality axis が重複しています。"))
  for (const axisId of expectedAxisIds.filter((axisId) => !axisIds.includes(axisId))) {
    issues.push(issue("missing-axis", axisId, "SQ-016 acceptance criterion がmatrixにありません。"))
  }
  for (const axisId of axisIds.filter((axisId) => !expectedAxisIds.includes(axisId))) {
    issues.push(issue("orphan-axis", String(axisId), "SQ-016に存在しないquality axisです。"))
  }

  for (const axis of axes) {
    const subject = `axis:${String(axis?.id)}`
    if (!axis?.label || !axis?.automated || !axis?.manual) {
      issues.push(issue("invalid-axis", subject, "label、automated、manual ownershipが必要です。"))
      continue
    }
    for (const evidencePath of axis.automated.evidence ?? []) {
      if (!repositoryFileExists(repoRoot, evidencePath)) issues.push(issue("missing-evidence", subject, `automated evidenceが存在しません: ${evidencePath}`))
    }
    if (axis.manual.required && !repositoryFileExists(repoRoot, axis.manual.task)) {
      issues.push(issue("missing-task", subject, `manual owner taskが存在しません: ${String(axis.manual.task)}`))
    }
  }

  const traceViews = Array.isArray(traceManifest?.views) ? traceManifest.views : []
  const traceViewIds = traceViews.map((view) => view.view)
  const matrixViews = Array.isArray(matrix?.views) ? matrix.views : []
  const matrixViewIds = matrixViews.map((view) => view?.view)
  for (const duplicate of duplicateValues(matrixViewIds)) issues.push(issue("duplicate-view", String(duplicate), "viewが重複しています。"))
  for (const viewId of traceViewIds.filter((viewId) => !matrixViewIds.includes(viewId))) {
    issues.push(issue("missing-view", viewId, "canonical screen inventoryに対応するmatrix rowがありません。"))
  }
  for (const viewId of matrixViewIds.filter((viewId) => !traceViewIds.includes(viewId))) {
    issues.push(issue("orphan-view", String(viewId), "canonical screen inventoryに存在しないviewです。"))
  }

  for (const view of matrixViews) {
    const criteria = view?.criteria ?? {}
    for (const axis of axes) {
      const subject = `view:${String(view?.view)}/${String(axis.id)}`
      const state = criteria[axis.id]
      if (!state) {
        issues.push(issue("missing-state", subject, "quality axisのevidence stateがありません。"))
        continue
      }
      for (const key of ["automated", "manual", "overall"]) {
        if (!validStatuses.has(state[key])) issues.push(issue("invalid-status", subject, `${key} statusが不正です: ${String(state[key])}`))
      }
      if (state.manual === "pass" && axis.manual.required && !(axis.manual.evidence ?? []).some((entry) => repositoryFileExists(repoRoot, entry))) {
        issues.push(issue("manual-pass-without-evidence", subject, "manual required scopeをevidenceなしでpassにできません。"))
      }
      const expectedOverall = deriveOverallStatus(state, axis)
      if (state.overall !== expectedOverall) {
        issues.push(issue("overall-status-mismatch", subject, `overall=${String(state.overall)} expected=${expectedOverall}`))
      }
    }
    for (const criterionId of Object.keys(criteria).filter((criterionId) => !axisIds.includes(criterionId))) {
      issues.push(issue("orphan-state", `view:${String(view?.view)}/${criterionId}`, "matrixに存在しないquality axisのstateです。"))
    }
  }

  return issues
}

export function formatUiQualityIssues(issues) {
  return issues.map(({ code, subject, message }) => `[${code}] ${subject}: ${message}`).join("\n")
}

function cell(value) {
  if (Array.isArray(value)) return value.map((entry) => `\`${entry}\``).join("<br>") || "-"
  return String(value ?? "-").replaceAll("|", "\\|")
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`)
  ].join("\n")
}

export function renderUiQualityMatrix({ matrix, traceManifest }) {
  const traceByView = new Map(traceManifest.views.map((view) => [view.view, view]))
  return `# Web UI cross-screen quality evidence matrix

> 自動生成: \`tools/web-inventory/generate-ui-quality-matrix.mjs\`
> generated family registration: \`tools/web-inventory/generate-web-inventory.mjs\`
>
> \`pass\` は指定methodのevidenceが揃った場合だけ使用します。\`blocked\` は未検証またはmanual dependency、\`fail\` は確認済みdefect、\`not_applicable\` は根拠付き非該当です。automatedだけでmanual required scopeをpassへ読み替えません。

## 品質軸とevidence owner

${table(
  ["AC", "品質軸", "automated owner", "automated evidence", "manual owner", "manual task"],
  matrix.axes.map((axis) => [
    axis.id,
    axis.label,
    axis.automated.owner,
    axis.automated.evidence,
    axis.manual.owner,
    axis.manual.task
  ])
)}

## 画面・persona・journey

${table(
  ["view", "route", "permission", "persona", "primary journey"],
  matrix.views.map((view) => {
    const trace = traceByView.get(view.view)
    return [
      view.view,
      trace?.canonicalUrl,
      trace?.access?.guards?.length ? trace.access.guards : "なし",
      trace?.personas ?? [],
      trace?.jobs?.map((job) => `${job.id}: ${job.summary}`) ?? []
    ]
  })
)}

## evidence state

${table(
  ["view", "AC", "automated", "manual", "overall", "note"],
  matrix.views.flatMap((view) => matrix.axes.map((axis) => {
    const state = view.criteria[axis.id]
    return [view.view, axis.id, state.automated, state.manual, state.overall, state.note]
  }))
)}

## Phase boundary

- Phase A: matrix、drift validator、computed DOM audit reportをownerとします。
- Phase B: AppShell / RailNavのtarget、focus、reflow remediationをownerとします。
- Phase C以降: feature batchごとのremediationとcontent extremesをownerとします。
- manual evidence task: representative screen reader、実browser 200% / 400% zoom、touch / real-deviceをownerとします。
`
}
