# 担当者対応カンバン PR の task / 受け入れ条件フロー是正

保存先: `tasks/done/20260506-1947-assignee-kanban-flow-correction.md`

## 状態

- done

## 背景

PR #128 の前回作業では、担当者対応 UI のカンバン化、検証、commit、GitHub Apps による PR 作成は実施した。一方で、repository-local の `worktree-task-pr-flow` が求める作業前 task file 作成、PR コメントでの受け入れ条件確認、task の done 移動が実施されていなかった。

## 目的

PR #128 に対して、欠落していた task file、受け入れ条件レビュー、障害レポート、PR コメント、task 状態更新を追加し、フロー逸脱を記録可能な形で是正する。

## 対象範囲

- `tasks/do/`
- `tasks/done/`
- `reports/working/`
- `reports/bugs/`
- GitHub PR #128 の Conversation comment

## 方針

- 前回の実装 diff は変更せず、プロセス成果物とレビュー結果を追加する。
- task file には受け入れ条件と検証計画を明記する。
- 受け入れ条件レビューは、前回実装が満たした条件、未検証の条件、制約を事実ベースで記録する。
- 障害レポートには、フロー未実施の「なぜなぜ分析」と再発防止策を含める。
- GitHub Apps で PR #128 に受け入れ条件確認コメントを投稿する。

## 必要情報

- 対象 PR: `https://github.com/tsuji-tomonori/rag-assist/pull/128`
- 対象 commit: `47ec80e`
- 前回作業レポート: `reports/working/20260506-1940-assignee-kanban-ui.md`
- 関連 skill: `skills/worktree-task-pr-flow/SKILL.md`
- 関連 skill: `skills/task-file-writer/SKILL.md`
- 関連 skill: `skills/failure-report/SKILL.md`

## 実行計画

1. この task file を `tasks/do/` に作成する。
2. 前回実装の受け入れ条件レビューを `reports/working/` に作成する。
3. フロー未実施の障害レポートを `reports/bugs/` に作成する。
4. Markdown と JSON failure report の構文を確認する。
5. 変更を commit して PR #128 branch に push する。
6. GitHub Apps で PR #128 に受け入れ条件確認コメントを投稿する。
7. この task file を `tasks/done/` に移動し、状態を `done` に更新する。
8. task 完了更新を commit して PR #128 branch に push する。

## ドキュメントメンテナンス計画

- アプリケーション挙動、API、権限、store、運用手順は変更しないため、`memorag-bedrock-mvp/docs` は更新しない。
- フロー逸脱の記録は durable docs ではなく `reports/bugs/` と `reports/working/` に残す。
- PR 本文は必要に応じて追加コメントで補完し、既存 PR body の実装説明は変更しない。

## 完了確認

- 受け入れ条件レビュー: `reports/working/20260506-1947-assignee-kanban-acceptance-review.md`
- 障害レポート: `reports/bugs/20260506-1947-worktree-task-flow-miss.md`
- PR コメント: PR #128 Conversation comment `4387272381`
- 是正記録 commit: `b479514`

## 受け入れ条件

- この是正 task file が作成され、背景、目的、実行計画、ドキュメントメンテナンス計画、受け入れ条件、検証計画、PRレビュー観点、未決事項・リスクを含むこと。
- 前回実装に対する受け入れ条件レビューが `reports/working/` に保存され、各条件の pass / not verified / constraint が明記されていること。
- フロー未実施の障害レポートが `reports/bugs/` に保存され、なぜなぜ分析、影響、対応、再発防止策、`failure_report` JSON を含むこと。
- Markdown の差分チェックで既知の未解決失敗がないこと。
- PR #128 に受け入れ条件確認コメントが投稿されていること。
- PR コメント後にこの task file が `tasks/done/` に移動され、状態が `done` になっていること。

## 検証計画

- `git diff --check`
- `python3 -m json.tool` で障害レポート内 `failure_report` JSON を検証する。
- `rg` で task / review / failure report の必須見出しを確認する。
- GitHub Apps の comment 作成結果で PR #128 の受け入れ条件確認コメントを確認する。

## PRレビュー観点

- `blocking`: フロー逸脱の原因と是正内容が障害レポートに明確に記録されていること。
- `blocking`: 受け入れ条件レビューで未実施の確認を実施済みとして扱っていないこと。
- `should fix`: task file が `worktree-task-pr-flow` の状態遷移に沿って `do` から `done` に移動されること。
- `should fix`: PR コメントで各受け入れ条件の pass / not verified が読み取れること。
- `suggestion`: 再発防止策が今後の同種作業で使える粒度になっていること。

## 未決事項・リスク

- 決定事項: 前回 UI 実装 diff はこの是正 task では変更しない。
- 決定事項: ブラウザ手動目視は前回 PR body と受け入れ条件レビューで未検証として扱う。
- リスク: GitHub Apps の comment tool が失敗した場合、task を `done` に移動せず blocked として報告する必要がある。
