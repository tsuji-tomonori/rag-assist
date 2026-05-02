# Repository Agent Instructions

このリポジトリで作業する Codex / AI agent は、以下を守る。

## 共通
- 指定 skill が利用可能一覧に出ない場合も、リポジトリローカルの明示ルールとして該当 `SKILL.md` を読む。
- `git diff`、`git status`、変更ファイル一覧、ステージ済み差分、PR 内容、作業レポートから文面を作る場合も該当 skill を適用する。
- `reports/working/*.md`、`reports/bugs/*.md`、同等の作業・障害レポートが関係する場合は本文を確認し、commit message / PR 本文に要点を反映する。
- 実施していないテスト、確認、検証を実施済みとして書かない。

## Git Commit Message
- 対象: Git commit message、コミットメッセージ、コミットコメント、git comment、`git commit`。ユーザーの「コメント」も Git 文脈では commit message と扱う。
- 必読: `skills/japanese-git-commit-gitmoji/SKILL.md`
- commit 前に `git diff --cached --name-only` でステージ済みファイルを確認する。
- 変更目的が複数に分かれる場合は、1 commit にまとめず目的別分割を検討する。
- 1 行目は原則 `<emoji> <type>(<scope>): <日本語の要約>`。scope 不要または不明なら省略可。
- 既存 commit message がこの形式でなくても、新規 commit ではこのルールを優先する。

## Pull Request Title and Comment
- 対象: Pull Request、PR、PR タイトル、PR 本文、PR コメント、レビューコメント、`gh pr create`。
- 必読: `skills/japanese-pr-title-comment/SKILL.md`
- PR タイトル、PR 本文、PR コメント、レビューコメントは日本語で書く。
- ブランチ名、ファイルパス、コマンド、API 名、型名、関数名、issue 番号は原文維持可。
- PR 本文は `.github/pull_request_template.md` の見出しを優先する。

## Post Task Work Report
- 対象: ファイル編集、コマンド実行、調査、検証、ドキュメント作成など、リポジトリへの実作業。ユーザーが「レポート不要」「reports には出さないで」などと明示した場合のみ省略可。
- 必読: `skills/post-task-fit-report/SKILL.md`
- 主作業完了後かつ最終回答前に、タスクごとに作業完了レポートを 1 件残す。
- 保存先は原則 `reports/working/` の Markdown。なければ作成する。
- ファイル名は `YYYYMMDD-HHMM-<task-summary>.md`。summary は ASCII 小文字とハイフンで短く表す。
- レポートには、受けた指示、要件整理、検討・判断の要約、実施作業、成果物、指示への fit 評価、未対応・制約・リスクを簡潔に含める。
- 最終回答では生成したレポートの保存先パスを明示する。

## Implementation Docs Maintenance
- 対象: 実装、修正、リファクタ、設定変更、API 変更、運用手順変更など、コードまたは挙動に影響する作業。
- 必読（必要に応じて）: `skills/implementation-docs-maintainer/SKILL.md`
- 作業前後に、README、`docs/`、`memorag-bedrock-mvp/docs/`、API 例、運用手順、`AGENTS.md` への影響を確認する。
- ドキュメント更新が必要なら同じ作業範囲で更新する。不要なら最終回答または作業レポートで理由を簡潔に示す。
- `memorag-bedrock-mvp/docs` を更新する場合は下記 Docs Update Policy を優先する。

## Implementation Test Selection
- 対象: 実装、修正、リファクタ、設定変更、ドキュメント変更の完了前。
- 必読: `skills/implementation-test-selector/SKILL.md`
- `git diff --name-only` などで変更範囲を確認し、最小十分な lint、typecheck、test、build、smoke、docs check を選ぶ。
- 実行できる検証は実行する。省略した場合は、コマンド名と理由を最終回答または作業レポートに記載する。

## Security Access-Control Review
- 対象: API route、middleware、認証・認可、RBAC、所有者境界、管理 API、外部公開設定、機微データを返す schema/store の追加・変更。
- 必読: `skills/security-access-control-reviewer/SKILL.md`
- 新規 route は、認証境界、route-level permission、所有者・担当者制約、返却 schema の機微フィールド、store の list/get/update/delete 範囲を確認する。
- `memorag-bedrock-mvp/apps/api/src/app.ts` の保護対象 route を追加・変更する場合は、`memorag-bedrock-mvp/apps/api/src/security/access-control-policy.test.ts` の静的 policy も更新し、API test を実行する。
- 意図的な public endpoint は、理由、返却データが非機微である根拠、濫用対策を PR 本文または作業レポートに明記する。

## Docs Update Policy for `memorag-bedrock-mvp/docs`
- 更新依頼では `skills/docs-swebok-template-writer/SKILL.md` を参照し、SWEBOK-lite の体裁に合わせる。
- 要求は原子性（1 要件 = 1 検証可能条件）を保つ。
- 要件ドキュメントは「1 要件 = 1 ファイル」とし、受け入れ条件を同一ファイル内に明記する。
- 新規/大規模更新は `memorag-bedrock-mvp/docs/DOCS_STRUCTURE.md` の構成方針に合わせる。
- 既存単一ファイル（例: `REQUIREMENTS.md`, `ARCHITECTURE.md`）を更新する場合も、将来移行しやすいように種別メタ情報と要件IDを維持する。
- 以降の docs 修正では、可能な限り REQ/ARC/DES/OPS のディレクトリに分割して追記・修正する。
