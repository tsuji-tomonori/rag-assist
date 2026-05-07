## 障害レポート

**保存先:** `reports/bugs/20260508-0049-main-merge-deploy-not-triggered.md`

**概要:** `main` へ PR をマージしても `Deploy MemoRAG MVP` workflow が自動起動しない。現行の `.github/workflows/memorag-deploy.yml` は `workflow_dispatch` のみを定義しており、`push` to `main` の trigger が存在しない。

**重大度:** `S1_high`

**状態:** `mitigated`

**影響:** `main` に取り込んだアプリ/infra 変更が自動で dev 環境へ deploy されない。手動 `workflow_dispatch` では実行可能な余地があるが、main merge を契機とした CD 経路は停止している。

**原因仮説:** 2026-05-07 21:58:56 +0900 の commit `999eaac` が `.github/workflows/memorag-deploy.yml` から `on.push.branches: [main]` を削除したため、GitHub Actions が main push イベントで deploy workflow をスケジュールしなくなった。後続の commit `f86f9ea` で job guard と checkout ref は `main` 固定になったが、workflow 自体の `push` trigger は復元されていない。

**現在の対応:** deploy workflow に `push.branches: [main]` を復元した。任意ブランチ実行リスクを抑える既存の `jobs.deploy.if: github.ref == 'refs/heads/main'` と checkout ref 固定は維持している。

**次のアクション:**

- `.github/workflows/memorag-deploy.yml` の `on:` に `push.branches: [main]` を追加する。
- YAML/Markdown 差分を検証する。
- PR merge 後に GitHub Actions 上で `Deploy MemoRAG MVP` が起動することを確認する。

```json failure_report
{
  "schema_version": "1.0.0",
  "report_id": "FR-20260508-004900-MAIN-DEPLOY",
  "created_at": "2026-05-08T00:49:00+09:00",
  "incident_type": "artifact_defect",
  "failure_mode": "incomplete_output",
  "severity": "S1_high",
  "status": "mitigated",
  "summary": "main merge does not trigger the MemoRAG deploy workflow because the workflow only listens to workflow_dispatch.",
  "user_request": "mainへマージしてもデプロイされないのは何故? 障害レポートを作成したうえでなぜ分析を行い修正して",
  "expected": "Merging a PR into main creates a push event on main and schedules the Deploy MemoRAG MVP workflow for dev deployment.",
  "actual": "The current deploy workflow has only workflow_dispatch under on, so a push event on main is not a matching event for the workflow.",
  "impact": "Changes merged to main are not automatically deployed. Operators must manually dispatch the workflow or the environment remains behind main.",
  "evidence": [
    {
      "type": "file",
      "ref": ".github/workflows/memorag-deploy.yml",
      "detail": "The on section defines workflow_dispatch only; there is no push trigger for main."
    },
    {
      "type": "git_commit",
      "ref": "999eaaccae30fc246e74109a4579c5a024bbed62",
      "detail": "Removed three lines: on.push.branches main from .github/workflows/memorag-deploy.yml."
    },
    {
      "type": "git_commit",
      "ref": "f86f9eacc5f5d2f97f5747e458734e635bc8c57f",
      "detail": "Added a job-level refs/heads/main guard and checkout ref fixed to refs/heads/main, but did not restore the push trigger."
    },
    {
      "type": "report",
      "ref": "reports/working/20260502-0000-disable-auto-deploy-workflow.md",
      "detail": "Records that the push trigger was intentionally removed and workflow_dispatch was left as the only trigger."
    }
  ],
  "suspected_root_cause": {
    "confidence": "high",
    "detail": "The deploy workflow event trigger no longer includes push to main. GitHub Actions does not run workflows for events not declared under on."
  },
  "actions_taken": [
    {
      "owner": "codex",
      "action": "Inspected deploy workflow triggers and related change history.",
      "status": "done"
    },
    {
      "owner": "codex",
      "action": "Prepared a targeted workflow fix to restore push on main while preserving main-only job guard.",
      "status": "done"
    }
  ],
  "corrective_actions": [
    {
      "owner": "codex",
      "action": "Restore on.push.branches main in .github/workflows/memorag-deploy.yml.",
      "due": "2026-05-08",
      "status": "done"
    },
    {
      "owner": "maintainer",
      "action": "After merging the fix, confirm that a main push schedules Deploy MemoRAG MVP in GitHub Actions.",
      "due": "unknown",
      "status": "not_started"
    }
  ],
  "open_questions": [
    "Whether GitHub environment approvals, repository Actions settings, or AWS OIDC secrets would block the job after it is triggered is outside the repository-static evidence and requires a real workflow run."
  ],
  "confidence": "high",
  "tags": [
    "github-actions",
    "deploy",
    "main",
    "memorag"
  ],
  "environment": {
    "repository": "rag-assist",
    "branch": "codex/fix-main-deploy-trigger",
    "base": "origin/main"
  },
  "affected_artifacts": [
    ".github/workflows/memorag-deploy.yml"
  ],
  "reproduction": [
    "Inspect .github/workflows/memorag-deploy.yml on origin/main.",
    "Observe that on.workflow_dispatch exists and on.push does not.",
    "Merge or push to main; the deploy workflow has no matching push trigger."
  ],
  "validation": [
    "Static workflow trigger inspection before fix: no push trigger present.",
    "Post-fix validation planned: git diff --check and pre-commit for changed files if available."
  ],
  "timeline": [
    {
      "time": "2026-05-07T21:58:56+09:00",
      "event": "Commit 999eaac removed the main push trigger."
    },
    {
      "time": "2026-05-07T22:00:04+09:00",
      "event": "Commit f86f9ea added main-only job guard and checkout ref pinning."
    },
    {
      "time": "2026-05-08T00:49:00+09:00",
      "event": "Incident analysis started from user report."
    }
  ],
  "prevention": [
    "Keep main deploy requirements explicit in task acceptance criteria when changing deploy workflow triggers.",
    "When disabling an automatic deploy path for security reasons, add an alternative safe trigger or clearly record that main merge deploy is intentionally disabled."
  ],
  "related_reports": [
    "reports/working/20260502-0000-disable-auto-deploy-workflow.md",
    "reports/working/20260502-0310-fix-deploy-workflow-branch-guard.md"
  ],
  "redactions": []
}
```
