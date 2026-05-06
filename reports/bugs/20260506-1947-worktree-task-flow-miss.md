# 障害レポート

**保存先:** `reports/bugs/20260506-1947-worktree-task-flow-miss.md`
**概要:** PR #128 の前回作業で、repository-local の `worktree-task-pr-flow` が求める作業前 task file 作成と PR コメントでの受け入れ条件確認が行われていなかった。実装・検証・commit・GitHub Apps による PR 作成は完了していたが、プロセス成果物が不足していた。
**重大度:** S2_medium
**状態:** mitigated
**影響:** PR レビュー時に、事前に定義した受け入れ条件と実装結果の対応が追跡しづらくなった。作業フロー遵守の証跡が PR 作成時点では不足した。
**原因仮説:** 初回対応時に、明示リクエストの「worktree + commit + PR」に対して `worktree-task-pr-flow` skill をローカル skill として探索・適用しなかったため。結果として、一般的な commit/PR/report ルールは適用したが、task 状態管理と PR acceptance comment の追加手順を見落とした。
**現在の対応:** 是正 task を `tasks/do/` に作成し、受け入れ条件レビューと本障害レポートを追加した。PR #128 に受け入れ条件確認コメントを投稿し、投稿後に task を `tasks/done/` へ移動する。
**次のアクション:** 今後の worktree + PR 依頼では、作業前に `skills/worktree-task-pr-flow/SKILL.md` を必ず読み、task file を `tasks/do/` に作成してから実装へ進む。

## なぜなぜ分析

1. なぜ task file と PR 受け入れ条件コメントが作成されなかったか
   - 前回対応時に `worktree-task-pr-flow` を適用せず、task 状態管理と PR acceptance comment の手順を実行しなかったため。
2. なぜ `worktree-task-pr-flow` を適用しなかったか
   - 利用可能 skill 一覧に表示されていた汎用 skill と、AGENTS.md の共通ルールを優先し、ローカル `skills/worktree-task-pr-flow/SKILL.md` の探索に進まなかったため。
3. なぜローカル skill 探索に進まなかったか
   - 「worktree + commit + PR」という依頼を、既存の `github:yeet` と commit/PR/report ルールで十分に満たせると判断し、repository-local のより具体的なフロー skill がある可能性を確認しなかったため。
4. なぜ十分だと判断してしまったか
   - 完了条件を実装成果物、検証、commit、PR 作成に寄せており、「task file 作成」と「PR コメントでの受け入れ条件確認」を Done 条件に含めなかったため。
5. なぜ Done 条件に含められなかったか
   - 作業開始前チェックリストで AGENTS.md の「実作業前にチェックリストと Done 条件を明示する」は満たしたが、`worktree-task-pr-flow` の追加手順を反映していなかったため。

## 修正内容

- `tasks/do/20260506-1947-assignee-kanban-flow-correction.md`
  - 是正 task と受け入れ条件を作成。
- `reports/working/20260506-1947-assignee-kanban-acceptance-review.md`
  - PR #128 の実装が受け入れ条件を満たすかレビュー。
- `reports/bugs/20260506-1947-worktree-task-flow-miss.md`
  - フロー未実施の原因、影響、なぜなぜ分析、再発防止策を記録。
- PR #128
  - GitHub Apps で受け入れ条件確認コメントを追加予定。

## 再発防止策

- worktree、commit、push、PR 作成が含まれる依頼では、初手で `rg -n "worktree|PR|pull request|受け入れ条件" skills .agents/skills` 相当の探索を行う。
- 作業前 Done 条件には、実装・検証だけでなく、task file、PR acceptance comment、task done 移動の有無を含める。
- 最終回答前に、`tasks/do` に残った task がないか確認する。

```json failure_report
{
  "schema_version": "1.0.0",
  "report_id": "FR-20260506-194756-WTPR",
  "created_at": "2026-05-06T10:47:56Z",
  "incident_type": "instruction_miss",
  "failure_mode": "incomplete_output",
  "severity": "S2_medium",
  "status": "mitigated",
  "summary": {
    "title": "worktree task PR flow の一部未実施",
    "description": "PR #128 の前回作業で task file 作成と PR 受け入れ条件コメントが行われなかった。",
    "detected_by": "user",
    "detected_at": "2026-05-06T10:47:56Z"
  },
  "user_request": {
    "original_request_excerpt": "worktree を作成して、以下の作業を行い、git commit + PR create to main PR作成はGitHubApps を利用して。",
    "interpreted_goal": "専用 worktree で UI 実装、検証、commit、push、GitHub Apps による main 向け PR 作成まで行う。",
    "explicit_constraints": [
      "worktree を作成する",
      "git commit を行う",
      "main 向け PR を作成する",
      "PR 作成は GitHub Apps を利用する"
    ],
    "implicit_constraints": [
      "repository-local workflow skill がある場合は適用する",
      "作業前に task と受け入れ条件を明示する",
      "PR コメントで受け入れ条件を確認する"
    ]
  },
  "expected": {
    "success_criteria": [
      "作業前に task file を tasks/do に作成する",
      "task file に受け入れ条件と検証計画を記載する",
      "実装と検証を行う",
      "GitHub Apps で PR を作成する",
      "PR に受け入れ条件確認コメントを投稿する",
      "PR コメント後に task file を tasks/done に移動する"
    ],
    "expected_output": "実装差分、検証結果、作業レポート、task file、PR、PR acceptance comment が揃う。",
    "expected_format": "Markdown task/report files and GitHub PR comment"
  },
  "actual": {
    "observed_output": "実装差分、検証結果、作業レポート、commit、PR は作成済み。task file と PR acceptance comment は未作成だった。",
    "observed_behavior": "worktree-task-pr-flow の task 状態管理手順を実行しないまま最終回答した。",
    "deviation_from_expected": [
      "tasks/do の作業前 task file がなかった",
      "PR #128 の Conversation に受け入れ条件確認コメントがなかった",
      "task を tasks/done へ移動する完了ステップがなかった"
    ]
  },
  "impact": {
    "user_impact": "受け入れ条件と実装結果の対応を PR 上で追跡しづらい。",
    "artifact_impact": "PR #128 のプロセス証跡が初回作成時点で不足した。",
    "scope": "workflow",
    "blocked": false
  },
  "affected_artifacts": [
    {
      "type": "document",
      "name": "task file",
      "path_or_identifier": "tasks/do/20260506-1947-assignee-kanban-flow-correction.md",
      "status": "fixed"
    },
    {
      "type": "document",
      "name": "acceptance review",
      "path_or_identifier": "reports/working/20260506-1947-assignee-kanban-acceptance-review.md",
      "status": "fixed"
    },
    {
      "type": "document",
      "name": "failure report",
      "path_or_identifier": "reports/bugs/20260506-1947-worktree-task-flow-miss.md",
      "status": "fixed"
    },
    {
      "type": "link",
      "name": "PR #128 acceptance comment",
      "path_or_identifier": "https://github.com/tsuji-tomonori/rag-assist/pull/128",
      "status": "fixed"
    }
  ],
  "environment": {
    "tools_used": [
      "rg",
      "git",
      "GitHub Apps connector"
    ],
    "runtime": "local git worktree",
    "platform": "repository workflow",
    "dependencies": [
      "skills/worktree-task-pr-flow/SKILL.md",
      "skills/task-file-writer/SKILL.md",
      "skills/failure-report/SKILL.md"
    ],
    "external_services": [
      "GitHub"
    ]
  },
  "evidence": [
    {
      "kind": "git",
      "source": "git show --stat --oneline HEAD",
      "content": "47ec80e included implementation files and reports/working/20260506-1940-assignee-kanban-ui.md, but no tasks/* file.",
      "timestamp": "2026-05-06T10:47:56Z"
    },
    {
      "kind": "repository",
      "source": "skills/worktree-task-pr-flow/SKILL.md",
      "content": "The skill requires creating a task file before implementation and commenting acceptance criteria after PR creation.",
      "timestamp": "2026-05-06T10:47:56Z"
    },
    {
      "kind": "user_request",
      "source": "current follow-up",
      "content": "User requested task creation, acceptance review, failure report, why analysis, and correction.",
      "timestamp": "2026-05-06T10:47:56Z"
    }
  ],
  "suspected_root_cause": {
    "category": "local_skill_not_applied",
    "description": "The initial task used general worktree/commit/PR handling but did not discover and apply the repository-local worktree-task-pr-flow skill.",
    "confidence": "high",
    "supporting_evidence": [
      "The previous commit had no task file.",
      "The repository contains skills/worktree-task-pr-flow/SKILL.md with explicit required workflow.",
      "The user identified the missing task and acceptance review flow."
    ]
  },
  "actions_taken": [
    {
      "action": "Created corrective task file in tasks/do.",
      "owner": "assistant",
      "status": "done",
      "timestamp": "2026-05-06T10:47:56Z"
    },
    {
      "action": "Created acceptance criteria review report.",
      "owner": "assistant",
      "status": "done",
      "timestamp": "2026-05-06T10:47:56Z"
    },
    {
      "action": "Created this failure report with why analysis.",
      "owner": "assistant",
      "status": "done",
      "timestamp": "2026-05-06T10:47:56Z"
    }
  ],
  "corrective_actions": [
    {
      "action": "Post acceptance criteria review comment to PR #128 using GitHub Apps.",
      "owner": "assistant",
      "due": "2026-05-06",
      "status": "in_progress"
    },
    {
      "action": "Move corrective task file from tasks/do to tasks/done after PR comment.",
      "owner": "assistant",
      "due": "2026-05-06",
      "status": "not_started"
    },
    {
      "action": "For future worktree + PR requests, discover local workflow skills before implementation.",
      "owner": "assistant",
      "due": "ongoing",
      "status": "not_started"
    }
  ],
  "open_questions": [],
  "confidence": "high",
  "tags": [
    "worktree",
    "task-flow",
    "acceptance-criteria",
    "pr-comment",
    "process"
  ],
  "validation": {
    "checks_performed": [],
    "checks_failed": [],
    "checks_not_performed": [
      "JSON validation and git diff check will be executed after file creation."
    ],
    "known_uncertainties": []
  },
  "prevention": {
    "recommended_controls": [
      "Add task file and PR acceptance comment to the initial Done conditions for worktree + PR requests.",
      "Search local skills for workflow-specific rules before implementation.",
      "Check tasks/do before final response."
    ]
  }
}
```
