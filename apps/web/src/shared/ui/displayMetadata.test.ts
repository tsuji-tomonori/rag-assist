import { describe, expect, it } from "vitest"
import {
  agentAvailabilityPresentation,
  agentRunStatusPresentation,
  aliasStatusPresentation,
  benchmarkModeLabel,
  benchmarkRunnerLabel,
  benchmarkRunStatusPresentation,
  debugRunStatusPresentation,
  debugStepStatusPresentation,
  documentLifecycleStatusPresentation,
  documentPermissionLabel,
  factCoverageStatusPresentation,
  managedUserStatusPresentation,
  principalTypeLabel,
  questionPriorityPresentation,
  questionStatusPresentation,
  reindexMigrationStatusPresentation
} from "./displayMetadata.js"

describe("displayMetadata", () => {
  it("domain status の全候補を日本語 label と semantic tone へ変換する", () => {
    const presentations = [
      ...(["active", "suspended", "deleted"] as const).map(managedUserStatusPresentation),
      ...(["open", "in_progress", "waiting_requester", "answered", "resolved"] as const).map(questionStatusPresentation),
      ...(["urgent", "high", "normal"] as const).map(questionPriorityPresentation),
      ...(["queued", "running", "succeeded", "failed", "timed_out", "cancelled"] as const).map(benchmarkRunStatusPresentation),
      ...(["disabled", "not_configured", "provider_unavailable", "available"] as const).map(agentAvailabilityPresentation),
      ...(["queued", "preparing_workspace", "running", "waiting_for_approval", "completed", "failed", "blocked", "cancelled", "expired"] as const).map(agentRunStatusPresentation),
      ...(["active", "staging", "superseded"] as const).map(documentLifecycleStatusPresentation),
      ...(["staged", "cutover", "rolled_back"] as const).map(reindexMigrationStatusPresentation),
      ...(["draft", "approved", "disabled"] as const).map(aliasStatusPresentation),
      ...(["success", "warning", "error"] as const).map(debugStepStatusPresentation),
      ...(["answered", "refused", "warning", "error"] as const).map(debugRunStatusPresentation),
      ...(["supported", "missing", "conflicting", "unknown"] as const).map(factCoverageStatusPresentation)
    ]

    expect(presentations.every(({ label, tone }) => label.length > 0 && ["neutral", "info", "success", "warning", "danger"].includes(tone))).toBe(true)
    expect(presentations.map(({ label }) => label)).not.toContain("queued")
    expect(presentations.map(({ label }) => label)).not.toContain("running")
  })

  it("mode、runner、権限、共有先種別は approved vocabulary を使う", () => {
    expect(benchmarkModeLabel("agent")).toBe("エージェント評価")
    expect(benchmarkModeLabel()).toBe("利用不可")
    expect(benchmarkRunnerLabel("codebuild")).toBe("CodeBuild")
    expect(documentPermissionLabel("readOnly")).toBe("閲覧のみ")
    expect(documentPermissionLabel("deny")).toBe("権限なし")
    expect(principalTypeLabel("group")).toBe("グループ")
  })
})
