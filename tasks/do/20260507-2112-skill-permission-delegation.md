# GitHubApps と Taskfile/Test 実行の skill 整備

保存先: `tasks/do/20260507-2112-skill-permission-delegation.md`

状態: do

## 背景

ユーザーから、GitHubApps の操作、Taskfile のコマンド実行、テスト周りについて、skill を作成し、適切に権限委譲を行い、ユーザーへの確認を抑制するよう依頼された。

既存の `AGENTS.md` と `skills/worktree-task-pr-flow/SKILL.md` には GitHub Apps 優先や検証実行の基本ルールがあるが、GitHub Apps 操作、Taskfile コマンド、テスト実行時の権限委譲と確認抑制を専門に扱う skill は不足している。

## 目的

GitHub Apps 操作、Taskfile コマンド実行、テスト実行/再実行を担当する repository-local skill を追加し、既存 workflow から自然に起動できるようにする。

## 対象範囲

- `skills/github-apps-pr-operator/`
- `skills/taskfile-command-runner/`
- `skills/repository-test-runner/`
- `skills/worktree-task-pr-flow/SKILL.md`
- `skills/implementation-test-selector/SKILL.md`
- `AGENTS.md`
- `reports/working/`

## 方針

- 既存の `worktree-task-pr-flow` を親 workflow とし、新 skill は専門的な実行手順として接続する。
- GitHub Apps が利用可能な PR 作成/更新/コメントでは GitHub Apps を優先し、不可の場合は理由を明記して blocked または代替手段を選ぶ。
- Taskfile とテスト実行では、承認済み prefix を使い、sandbox/network 由来の失敗時は `require_escalated` と再利用可能な `prefix_rule` を使って確認回数を抑える。
- 破壊的操作、不可逆操作、外部に大きな影響がある操作では確認を残す。
- 実行していないテストや GitHub 操作を実施済みとして書かない。

## 必要情報

- `AGENTS.md`
- `skills/worktree-task-pr-flow/SKILL.md`
- `skills/implementation-test-selector/SKILL.md`
- `skills/japanese-pr-title-comment/SKILL.md`
- `skills/pr-review-self-review/SKILL.md`
- `skills/post-task-fit-report/SKILL.md`
- `/home/t-tsuji/.codex/skills/.system/skill-creator/SKILL.md`

## 実行計画

1. 既存 skill と `AGENTS.md` の重複・不足を確認する。
2. GitHub Apps PR 操作用 skill を追加する。
3. Taskfile コマンド実行用 skill を追加する。
4. テスト実行/再実行用 skill を追加または既存 test selector と連携させる。
5. `AGENTS.md` と既存 workflow skill から新 skill を参照する。
6. Markdown/YAML と差分を検証する。
7. 作業レポートを作成し、commit/push/PR/comment/task done 更新を行う。

## ドキュメントメンテナンス計画

- Repository-wide agent behavior の変更であるため、`AGENTS.md` と `skills/worktree-task-pr-flow/SKILL.md` を更新する。
- 実装や API 動作は変更しないため、`memorag-bedrock-mvp/docs/`、API examples、OpenAPI、運用手順の更新は不要と判断する。
- PR 本文と作業レポートに、未実施検証と GitHub Apps/権限に関する制約があれば明記する。

## 受け入れ条件

- [ ] GitHub Apps 操作の skill が追加され、PR 作成/更新/コメント/セルフレビューで GitHub Apps 優先と不可時の blocked/代替判断が明記されている。
- [ ] Taskfile コマンド実行の skill が追加され、承認済み prefix、`require_escalated`、`prefix_rule`、確認抑制、破壊的操作の例外が明記されている。
- [ ] テスト周りの skill が追加または整理され、変更範囲に応じた検証選定、失敗時修正、再実行、未実施理由の記録が明記されている。
- [ ] `AGENTS.md` と `skills/worktree-task-pr-flow/SKILL.md` から新 skill が参照され、通常の repository work で適用される。
- [ ] `git diff --check` と対象 Markdown/YAML の目視/機械的確認が通る。
- [ ] 作業レポート、commit、push、PR 作成、受け入れ条件確認コメント、セルフレビューコメント、task done 更新が完了する。

## 検証計画

- `git diff --check`
- `find skills/github-apps-pr-operator skills/taskfile-command-runner skills/repository-test-runner -maxdepth 3 -type f -print`
- `rg -n "github-apps-pr-operator|taskfile-command-runner|repository-test-runner" AGENTS.md skills/worktree-task-pr-flow/SKILL.md skills/implementation-test-selector/SKILL.md`
- `pre-commit run --files <changed-files>` は利用可能なら実行する。利用できない場合は理由を記録する。

## PRレビュー観点

- 新 skill の起動条件が広すぎず狭すぎないこと。
- ユーザー確認を抑制する条件が、不可逆操作や破壊的操作の確認義務を弱めていないこと。
- GitHub Apps 優先が明記され、Apps 不可時に実施済み扱いしないこと。
- Taskfile とテスト実行の権限委譲が sandbox ルールと整合していること。
- docs と実装の同期、RAG の根拠性・認可境界、benchmark 固有 shortcut 混入が非該当または維持されていること。

## 未決事項・リスク

- 決定事項: 新 skill は `skills/` 配下に置き、`agents/openai.yaml` を併設する。
- 決定事項: テスト選定は既存 `implementation-test-selector` を残し、新 skill は実行/再実行/権限委譲に寄せる。
- リスク: GitHub Apps connector が利用できない場合、PR 作成やコメントは blocked または `gh` 代替となる。実施済み扱いにはしない。
