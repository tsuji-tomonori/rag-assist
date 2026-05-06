# 既存 reports tasks の状態ディレクトリ移行

保存先: `tasks/do/20260506-1736-migrate-existing-tasks.md`

## 状態

- do

## 背景

新しい task 運用では `tasks/todo/`、`tasks/do/`、`tasks/done/` を状態ディレクトリとして使う。一方、既存の未着手 task は `reports/tasks/` に残っているため、運用ルールと実体がずれている。

## 目的

既存の task Markdown を状態に合わせて `tasks/todo/` へ移動し、今後の task 作成 skill も `tasks/` 状態ディレクトリを既定にする。

## 対象範囲

- `reports/tasks/20260506-1203-*.md`
- `tasks/todo/`
- `tasks/do/`
- `tasks/done/`
- `skills/task-file-writer/SKILL.md`
- `skills/task-file-writer/agents/openai.yaml`
- `reports/working/`
- PR #123

## 方針

- 既存 7 task は実装完了や進行中を示す状態記載がないため、未着手として `tasks/todo/` に移動する。
- 各 task の `保存先` と相互参照を新パスへ更新する。
- `task-file-writer` skill の既定出力先を `tasks/todo/` に変更し、状態遷移のルールを追記する。
- この移行作業自体は `tasks/do/` で管理し、PR コメントと追加 commit 後に `tasks/done/` へ移動する。

## 必要情報

- `AGENTS.md` の Worktree Task PR Flow は task md を状態に応じて `tasks/todo/`、`tasks/do/`、`tasks/done/` に置くよう指示している。
- 既存 7 task は `reports/tasks/` にあり、`保存先` や前提タスク参照も旧パスを指している。
- PR #123 はすでに GitHub Apps connector で作成済み。

## 実行計画

1. 既存 `reports/tasks/20260506-1203-*.md` の状態記載を確認する。
2. 既存 7 task を `tasks/todo/` へ `git mv` する。
3. 移動した task 内の `保存先` と旧 `reports/tasks/` 参照を `tasks/todo/` へ更新する。
4. `skills/task-file-writer/SKILL.md` と `agents/openai.yaml` を新しい状態ディレクトリ運用へ更新する。
5. Markdown/YAML、末尾空白、差分を検証する。
6. 作業レポートを作成または更新する。
7. commit / push し、PR #123 の本文とコメントに移行結果を追記する。
8. この task md を `tasks/done/` へ移動し、状態を `done` に更新して追加 commit / push する。

## ドキュメントメンテナンス計画

- Repository-local task 運用の変更として `skills/task-file-writer/SKILL.md` を更新する。
- `AGENTS.md` は既に `tasks/todo` / `tasks/do` / `tasks/done` 運用を記載済みのため、追加更新は必要な場合のみ行う。
- アプリケーションコード、API、UI、インフラ、`memorag-bedrock-mvp/docs` には影響しない。
- PR 本文と PR コメントに移行結果、検証、未実施確認を追記する。

## 受け入れ条件

- 既存 `reports/tasks/20260506-1203-*.md` 7 件が `tasks/todo/` に移動されている。
- 移動した 7 task の `保存先` が `tasks/todo/...` に更新されている。
- 移動した 7 task 内の相互参照が `reports/tasks/...` から `tasks/todo/...` に更新されている。
- `reports/tasks/` に tracked task md が残っていない。
- `skills/task-file-writer/SKILL.md` が `tasks/todo/` を既定出力先とし、`todo` / `do` / `done` の状態ディレクトリ運用を説明している。
- Markdown/YAML の構文、パス、末尾空白、差分チェックで既知の未解決失敗がない。
- PR #123 に移行結果が反映されている。
- この task md が PR コメント後に `tasks/done/` へ移動され、状態が `done` に更新されている。

## 検証計画

- `find reports/tasks tasks -maxdepth 3 -type f -print`
- `rg -n "reports/tasks" tasks skills/task-file-writer reports/working/20260506-*.md`
- `git diff --check`
- `pre-commit run --files <changed-files>`

## PRレビュー観点

- `blocking`: 既存 task の意味や内容が移動以外に変わっていないこと。
- `blocking`: `reports/tasks` と `tasks/todo` の二重運用が残っていないこと。
- `should fix`: `task-file-writer` skill の既定出力先が新しい `tasks/todo/` と一致していること。
- `should fix`: 移動した task の相互参照が新パスへ更新されていること。
- `suggestion`: 既存作業レポート内の過去記録は履歴として旧パスのまま残すか、新パスを補足するかが分かること。

## 未決事項・リスク

- 決定事項: 状態不明の既存 task は、実装完了記録がないため `todo` として扱う。
- 決定事項: 過去の作業レポート本文は履歴記録として原則書き換えず、今回の移行レポートで新パスを明示する。
- リスク: 外部 PR や古いレポートが旧 `reports/tasks` パスを参照している可能性があるため、今回の PR 本文で移行を明記する。
