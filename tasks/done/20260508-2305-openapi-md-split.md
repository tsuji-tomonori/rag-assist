# OpenAPI Markdown split by operation

- 状態: done
- 作成日: 2026-05-08
- 対象: `memorag-bedrock-mvp`

## 背景

生成済み API reference は `docs/generated/openapi.md` 1 ファイルに全 API 詳細を含めている。また `docs/generated/openapi.json` も commit 対象になっている。API 単位でレビューしやすい Markdown 構成にし、JSON は repository に commit しない方針へ変更する。

## 目的

OpenAPI 由来の Markdown reference を上位 index と API ごとの詳細ファイルに分割し、生成済み JSON を git 管理対象から外す。

## Scope

- `docs/generated/openapi.md` を上位 index とし、API 一覧と詳細ファイルへのリンクを置く。
- 各 API の詳細を `docs/generated/openapi/` 配下の個別 Markdown に出力する。
- `docs/generated/openapi.json` を commit 対象から外し、生成 script / workflow / docs から JSON commit 前提を取り除く。
- README、設計 docs、workflow、task、report、PR コメントを更新する。

## Plan

- generator の出力先と renderer を分割形式に変更する。
- stale な generated JSON と旧 operation ファイルが残らないよう生成時の掃除を入れる。
- `.gitignore` と GitHub Actions の `add-paths` を Markdown 生成物に合わせる。
- docs を新しい運用に更新し、必要な検証を実行する。

## Documentation Maintenance Plan

- `memorag-bedrock-mvp/README.md` の OpenAPI 生成物説明を更新する。
- `memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_001.md` の OpenAPI 生成ドキュメント方針を更新する。

## 受け入れ条件

- [x] `docs/generated/openapi.md` が上位ドキュメントとして API 一覧と個別ファイルへのリンクを持つ。
- [x] API ごとの詳細 Markdown が `docs/generated/openapi/` 配下に生成される。
- [x] 各 API 詳細 Markdown は headers、path parameters、query parameters、data、responses を表形式で記載する。
- [x] `docs/generated/openapi.json` が git 管理対象から外れ、生成 script / workflow が JSON commit を前提にしない。
- [x] `docs:openapi:check` は引き続き説明不足を検出する。
- [x] 生成物、docs、task、report、PR コメントが更新される。

## Validation Plan

- `npm --prefix memorag-bedrock-mvp run docs:openapi:check`
- `npm --prefix memorag-bedrock-mvp run docs:openapi`
- `task docs:openapi`
- `task docs:openapi:check`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`
- `git diff --check`

## PR Review Points

- API 詳細ファイル名が deterministic でリンク切れしないこと。
- JSON を commit しない方針が workflow と docs に反映されていること。
- 新規 API 追加時に quality gate が引き続き機能すること。

## Risks

- 既存 `openapi.md` への外部リンクは残るが、operation 詳細の anchor link は個別ファイルへ変わる。
- 生成済み JSON を git 管理対象から外すため、JSON の確認は runtime `/openapi.json` または一時生成ではなく quality gate で行う。

## 完了メモ

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/194
- 受け入れ条件確認コメント: 投稿済み
- 実行した検証:
  - `npm --prefix memorag-bedrock-mvp run docs:openapi:check`: pass
  - `npm --prefix memorag-bedrock-mvp run docs:openapi`: pass
  - `task docs:openapi`: pass
  - `task docs:openapi:check`: pass
  - `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
  - `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`: pass
  - `git diff --check`: pass
  - `openapi.md` の `openapi/*.md` リンク先存在確認: pass
  - `test ! -e memorag-bedrock-mvp/docs/generated/openapi.json`: pass
