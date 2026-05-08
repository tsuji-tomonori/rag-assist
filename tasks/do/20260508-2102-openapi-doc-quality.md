# OpenAPI document quality gate and table renderer

- 状態: doing
- 作成日: 2026-05-08
- 対象: `memorag-bedrock-mvp`

## 背景

生成済み `openapi.md` が schema dump 中心で、operation summary / description や各項目説明が不足している。API reference として読めるよう、header / path parameter / query parameter / data / response を表形式で出し、不足時は CI で検出する必要がある。

## 目的

Hono OpenAPI 仕様から生成する Markdown を日本語説明付きの表形式へ変更し、summary / description / field description の不足を CI で fail させる。

## Scope

- Markdown renderer を schema dump ではなく表形式に変更する。
- OpenAPI operation と schema field の説明を日本語で補完・検証する。
- `docs:openapi:check` を npm / Taskfile / CI に追加する。
- 生成済み `docs/generated/openapi.json` と `docs/generated/openapi.md` を再生成する。
- README / API 設計 docs / PR コメント / 作業レポートを更新する。

## 受け入れ条件

- [ ] `openapi.md` が header、path parameters、query parameters、data、responses を表形式で記載する。
- [ ] 各 operation に日本語 summary / description がある。
- [ ] parameter、request body、response body の各 field に日本語 description がある。
- [ ] description 不足時に `docs:openapi:check` が exit 1 になる。
- [ ] `memorag-ci.yml` と OpenAPI docs workflow で `docs:openapi:check` が実行される。
- [ ] 生成物、docs、task、report、PR コメントが更新される。

## Validation Plan

- `npm --prefix memorag-bedrock-mvp run docs:openapi`
- `npm --prefix memorag-bedrock-mvp run docs:openapi:check`
- `task docs:openapi`
- `task docs:openapi:check`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`
- `git diff --check`

## Risks

- OpenAPI schema のすべての field に個別の業務説明を手入力すると差分が大きくなるため、共通 metadata / heuristic 補完で説明漏れを防ぐ。
- CI での検証は生成済み OpenAPI に対する品質 gate とし、GitHub Actions の実行結果は PR checks で確認する。
