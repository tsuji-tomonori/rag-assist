# 章別仕様 実装差分レビューとタスク化

保存先: `tasks/done/20260516-1618-chapter-spec-gap-taskification.md`

## 状態

- done

## タスク種別

- 調査

## 背景

ユーザーから `.workspace/rag-assist_仕様追加_章別定義_管理者向け構成版 (1).md` について、仕様通り実装されているかレビューし、差異がある部分をタスク化する依頼があった。

`/plan` 指示のため、このタスクでは実装修正、commit、push、PR 作成は行わない。差分レビューと `tasks/todo/` へのタスク追加までを対象にする。

## 目的

正本化済み章別仕様 `docs/spec/2026-chapter-spec.md`、章対応表、Phase gap docs、現行 task 一覧を確認し、未実装・scope-out・open question として残る差分を実装タスクへ分解する。

## 対象範囲

- 入力仕様: `.workspace/rag-assist_仕様追加_章別定義_管理者向け構成版 (1).md`
- 正本仕様: `docs/spec/2026-chapter-spec.md`
- 対応表: `docs/spec/CHAPTER_TO_REQ_MAP.md`
- Phase gap docs: `docs/spec/gap-phase-*.md`
- 既存 task: `tasks/todo/`, `tasks/done/`

## 実施内容

1. 入力仕様の存在と章構成を確認した。
2. 正本仕様と入力元の対応を確認した。
3. `docs/spec/CHAPTER_TO_REQ_MAP.md` と `docs/spec/gap-phase-*.md` の実装メモ、scope-out、open question を確認した。
4. 既存 `tasks/todo/` と重複する差分を除外した。
5. 残差分を `tasks/todo/` の実装タスクとして追加した。

## 作成したタスク

- `tasks/todo/20260516-1618-quality-confidence-rag-gate.md`
- `tasks/todo/20260516-1618-parsed-document-preview-api.md`
- `tasks/todo/20260516-1618-chat-tool-execution-audit.md`
- `tasks/todo/20260516-1618-async-agent-writeback-approval.md`
- `tasks/todo/20260516-1618-async-agent-provider-settings.md`
- `tasks/todo/20260516-1618-async-agent-benchmark-runner.md`
- `tasks/todo/20260516-1618-api-contract-lifecycle-hardening.md`
- `tasks/todo/20260516-1618-debug-replay-revocation-edge-guard.md`
- `tasks/todo/20260516-1618-admin-group-audit-quality-ops.md`

## 受け入れ条件

- [x] 入力仕様ファイルと正本仕様の関係が確認されている。
- [x] 既存 gap docs と既存 todo task を確認している。
- [x] 既存 task と重複する差分を新規 task 化しない。
- [x] 残差分を acceptance criteria 付きの task md として `tasks/todo/` に追加している。
- [x] `/plan` 指示に従い、実装修正、commit、push、PR 作成は行っていない。

## 検証計画

- Markdown 構文と末尾空白を `git diff --check` で確認する。
- 実装修正は行っていないため、API/Web のテストは対象外。

## PRレビュー観点

- タスクが仕様章・gap docs・既存実装メモに紐づいているか。
- 未実装項目を実装済み扱いしていないか。
- 既存 todo と重複していないか。
- No Mock Product UI、RAG 認可、品質 gate、debug redaction の既存制約を弱める task になっていないか。

## 未対応・制約

- `/plan` 指示のため、専用 worktree、commit、push、PR 作成、PR コメントは行っていない。
- 実装挙動の runtime test は行っていない。今回の成果物は差分レビューとタスク化である。
