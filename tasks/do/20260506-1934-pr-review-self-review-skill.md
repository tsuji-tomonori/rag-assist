# PRレビューセルフレビュー skill 追加

保存先: `tasks/do/20260506-1934-pr-review-self-review-skill.md`

状態: do

## 背景

`rag-assist` / `memorag-bedrock-mvp` の PR レビューでは、docs と実装の同期、変更範囲に見合うテスト、RAG の根拠性と認可境界を継続的に確認する必要がある。PR 作成時や更新時にセルフレビューを実施し、結果を PR コメントへ残す運用を repository-local skill として明文化する。

## 目的

レビュー用 skill を追加し、PR 作成・更新時にセルフレビュー結果を日本語コメントとして記録するルールを `AGENTS.md` から参照できる状態にする。

## 対象範囲

- `skills/pr-review-self-review/SKILL.md`
- `skills/pr-review-self-review/agents/openai.yaml`
- `AGENTS.md`
- `tasks/do/` から `tasks/done/` へのタスク状態更新
- `reports/working/` の作業完了レポート

## 方針

- skill 本体は、ユーザー提示チェックリストを reusable な手順に整理し、PR 全体、docs、実装層、テスト、security、RAG 品質、data/compatibility、operations、dependencies、code quality、変更種別、merge 前判断を扱う。
- 詳細チェックリストは `SKILL.md` に収めるが、実運用で読みやすいようにセルフレビュー手順とコメント書式を先頭に置く。
- `AGENTS.md` には PR 作成・更新時の必読 skill と PR コメント記録ルールを追加し、既存の Worktree Task PR Flow と矛盾しないようにする。

## 必要情報

- 既存ルール: `AGENTS.md`
- 既存 task/PR flow: `skills/worktree-task-pr-flow/SKILL.md`
- PR 文面ルール: `skills/japanese-pr-title-comment/SKILL.md`
- skill 作成ルール: `/home/t-tsuji/.codex/skills/.system/skill-creator/SKILL.md`

## 実行計画

1. タスクファイルを `tasks/do/` に作成する。
2. 既存 skill と `AGENTS.md` の構成を確認する。
3. `skills/pr-review-self-review/` を追加する。
4. `AGENTS.md` にレビュー用 skill の参照と運用ルールを追加する。
5. Markdown/YAML の差分と末尾空白を検証する。
6. 作業完了レポートを `reports/working/` に保存する。
7. commit、push、GitHub Apps による PR 作成、セルフレビューコメント投稿を実行する。
8. PR コメント後にタスクを `tasks/done/` へ移動し、完了更新を追加 commit / push する。

## ドキュメントメンテナンス計画

- Repository-wide agent behavior を変えるため `AGENTS.md` を更新する。
- Product code、API、Web、Infra、Benchmark の挙動は変えないため、`memorag-bedrock-mvp/docs/`、README、API examples、Operations docs は更新不要と判断する。
- PR 本文と作業レポートで、docs 更新の対象と不要理由を明記する。

## 受け入れ条件

- [ ] `skills/pr-review-self-review/SKILL.md` が追加され、レビュー観点チェックリストとセルフレビューコメント手順を含む。
- [ ] `skills/pr-review-self-review/agents/openai.yaml` が追加され、skill の UI metadata が `SKILL.md` と整合する。
- [ ] `AGENTS.md` に、PR 作成・更新時にレビュー用 skill を読み、セルフレビュー結果を PR コメントへ記載するルールが追加される。
- [ ] 変更範囲に対する検証が実行され、未実施事項があれば理由が記録される。
- [ ] 作業完了レポートが `reports/working/` に保存される。
- [ ] `main` 向け PR が GitHub Apps で作成され、セルフレビュー結果が日本語 PR コメントとして投稿される。
- [ ] PR コメント後に本タスクファイルが `tasks/done/` へ移動され、状態が `done` に更新される。

## 検証計画

- `git diff --check`
- 変更 Markdown/YAML の目視確認
- `pre-commit run --files <changed-files>` が利用可能なら実行する。利用できない場合は理由を記録する。

## PRレビュー観点

- PR 全体: 目的が review skill 追加に絞られており、PR 本文に背景、変更内容、影響範囲、確認内容、未確認事項があるか。
- docs: `AGENTS.md` の運用ルールが新 skill と矛盾せず、未実施検証を実施済み扱いしていないか。
- tests: Markdown/YAML 変更に見合う検証が行われているか。
- security/RAG: 実装変更を伴わないため direct risk はないが、レビュー skill が RAG 根拠性と認可境界を弱めない観点を含んでいるか。
- operations: PR 更新時のコメント運用が実行可能で、GitHub Apps 優先ルールと整合するか。

## 未決事項・リスク

- 決定事項: PR は draft として作成し、セルフレビューコメントを追加する。
- 決定事項: セルフレビューの結果は top-level PR comment として残し、未検証項目を明示する。
- リスク: GitHub Apps または push 権限が利用できない場合、PR 作成・コメント投稿は blocked として扱う。
