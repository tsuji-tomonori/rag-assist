# OpenAPI Markdown generation by GitHub Actions

- 状態: doing
- 作成日: 2026-05-08
- 対象: `memorag-bedrock-mvp`

## 背景

Hono + `@hono/zod-openapi` で生成している OpenAPI 仕様から、GitHub Actions によって Markdown ファイルを機械的に生成・反映する方法を実装する。

## 目的

OpenAPI JSON と Markdown API reference を再現可能なコマンドで生成し、CI / GitHub Actions から生成差分を検出または PR 化できるようにする。

## Scope

- `memorag-bedrock-mvp` の API workspace に OpenAPI docs 生成スクリプトを追加する。
- npm script / Taskfile から生成処理を実行できるようにする。
- GitHub Actions workflow を追加し、main への反映後または手動実行で生成 docs 更新 PR を作成できるようにする。
- 生成 docs の運用を README / API 設計 docs に追記する。

## Plan

1. 既存の `/openapi.json` 生成経路と package / Taskfile / workflow を確認する。
2. API app から OpenAPI JSON を取得し、Markdown に変換して `docs/generated/` に出力するスクリプトを追加する。
3. npm script と Taskfile task を追加する。
4. GitHub Actions workflow を追加する。
5. 生成 docs と運用 docs を更新する。
6. 生成コマンド、型チェック、diff check を実行する。

## Documentation Maintenance Plan

- `memorag-bedrock-mvp/README.md` に生成コマンドと GitHub Actions 運用を追記する。
- `memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_001.md` に OpenAPI docs 生成の source of truth を追記する。

## 受け入れ条件

- [ ] `npm run docs:openapi` または Taskfile から OpenAPI JSON と Markdown を生成できる。
- [ ] 生成先が `memorag-bedrock-mvp/docs/generated/` に固定され、手作業編集ではなく再生成できることが分かる。
- [ ] GitHub Actions で生成 docs の更新 PR を作成できる。
- [ ] README または設計 docs に運用方法が記載されている。
- [ ] 変更範囲に見合う検証が実行され、未実施項目があれば理由が記録されている。

## Validation Plan

- `npm --prefix memorag-bedrock-mvp run docs:openapi`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `git diff --check`

## PR Review Points

- 生成スクリプトが AWS や外部サービスに依存せずローカルモードで動くこと。
- 生成 Markdown が OpenAPI path / method / summary / auth / schema を最低限レビュー可能に表現すること。
- GitHub Actions が PR context で直接 push せず、main push / 手動実行から更新 PR を作ること。

## Risks

- OpenAPI schema の詳細表現は簡易 Markdown 生成であり、将来的に Redocly 等の専用 renderer に置き換える余地がある。
- GitHub Actions の PR 作成は repository permissions と branch protection に依存する。
