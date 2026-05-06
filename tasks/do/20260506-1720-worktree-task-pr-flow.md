# Worktree task PR flow skill

保存先: `tasks/do/20260506-1720-worktree-task-pr-flow.md`

## 状態

- do

## 背景

リポジトリ作業を行う際に、専用 worktree で作業し、作業前にタスクファイルと受け入れ条件を明記し、commit と main 向け PR 作成まで進める手順を標準化する必要がある。

## 目的

Codex / AI agent が同様の依頼を受けたときに、worktree、tasks 状態管理、commit、GitHub Apps による PR 作成、PR コメントでの受け入れ条件確認、完了時の task 移動を一貫して実行できるようにする。

## 対象範囲

- `AGENTS.md`
- `skills/worktree-task-pr-flow/SKILL.md`
- `skills/worktree-task-pr-flow/agents/openai.yaml`
- `tasks/todo/`
- `tasks/do/`
- `tasks/done/`
- `reports/working/`

## 方針

- 新しい repository-local skill として `worktree-task-pr-flow` を追加する。
- `AGENTS.md` に、作業開始時の task 作成、状態ディレクトリ移動、PR 作成後の受け入れ条件確認コメント、完了後の `tasks/done` 移動を明記する。
- 既存の commit message、PR 文面、post-task report、test selection のルールと矛盾しないようにする。

## 必要情報

- Git commit message は `skills/japanese-git-commit-gitmoji/SKILL.md` に従う。
- PR タイトル、本文、コメントは `skills/japanese-pr-title-comment/SKILL.md` に従う。
- 実作業後のレポートは `skills/post-task-fit-report/SKILL.md` に従う。
- 検証選定は `skills/implementation-test-selector/SKILL.md` に従う。
- PR 作成は GitHub Apps を優先し、必要時のみ `gh` を補助に使う。

## 実行計画

1. 専用 worktree と作業ブランチを `origin/main` から作成する。
2. `tasks/todo`, `tasks/do`, `tasks/done` を作成し、このタスクを `tasks/do` に置く。
3. `skills/worktree-task-pr-flow` を追加する。
4. `AGENTS.md` に workflow 適用ルールを追加する。
5. Markdown/YAML と差分を検証する。
6. 作業レポートを `reports/working/` に作成する。
7. 変更を commit し、remote branch に push する。
8. GitHub Apps で main 向け PR を作成する。
9. PR コメントに受け入れ条件の充足確認を記載する。
10. このタスクファイルを `tasks/done` に移動し、完了状態へ更新して追加 commit / push する。

## ドキュメントメンテナンス計画

- Repository-wide agent behavior の変更として `AGENTS.md` を更新する。
- workflow の実行手順は skill に集約する。
- アプリケーションコード、API、運用環境、`memorag-bedrock-mvp/docs` には影響しないため更新しない。
- PR 本文にドキュメント影響範囲と未実施確認を明記する。

## 受け入れ条件

- `tasks/todo`, `tasks/do`, `tasks/done` の状態ディレクトリが存在する。
- 作業前に作成されたこの task md に、目的、実行計画、受け入れ条件、検証計画が記載されている。
- `skills/worktree-task-pr-flow/SKILL.md` が追加され、worktree 作成、task md 作成、受け入れ条件明記、commit、GitHub Apps による main 向け PR 作成、PR コメントでの受け入れ条件確認、完了時の `tasks/done` 移動を指示している。
- `AGENTS.md` に、新 workflow skill を該当作業で使用するルールが追加されている。
- commit message、PR タイトル、PR 本文、PR コメントの日本語運用と既存 skill 参照が維持されている。
- Markdown/YAML の構文、パス、末尾空白、差分チェックで既知の未解決失敗がない。
- main 向け PR が作成され、PR コメントに受け入れ条件の確認結果が記載されている。
- PR コメント後にこの task md が `tasks/done` に移動され、状態が `done` に更新されている。

## 検証計画

- `git diff --name-only`
- `git diff --check`
- `pre-commit run --files <changed-files>` が利用可能なら実行する。
- `sed` または `rg` で `AGENTS.md` と skill に必要語句が含まれることを確認する。
- PR 作成後、PR URL と PR コメント作成結果を確認する。

## PRレビュー観点

- `blocking`: 新 workflow が既存の commit / PR / report / test selection ルールと矛盾していないこと。
- `blocking`: 作業前 task md と受け入れ条件の明記が必須手順として読めること。
- `should fix`: tasks の状態遷移が `todo` / `do` / `done` として明確で、完了後の移動まで含まれていること。
- `should fix`: GitHub Apps 優先の PR 作成と、PR コメントでの受け入れ条件確認が明記されていること。
- `suggestion`: skill の本文が冗長すぎず、実行時に迷わない粒度になっていること。

## 未決事項・リスク

- 決定事項: `tasks/` は `reports/tasks/` とは別の状態管理ディレクトリとして扱う。
- 決定事項: PR は user request が別指定しない限り `main` を base にする。
- リスク: GitHub Apps の tool が利用できない場合、PR 作成または PR コメントが blocked になる。その場合は未完了として報告し、`gh` fallback は user / skill の制約と矛盾しない範囲でのみ使う。
