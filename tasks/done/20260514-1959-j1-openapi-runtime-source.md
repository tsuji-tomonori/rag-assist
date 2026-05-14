# J1-openapi-runtime-source: runtime OpenAPI source と drift/docs gate 基盤

- 状態: done
- タスク種別: 機能追加
- branch: `codex/phase-j1-openapi-runtime-source`
- worktree: `.worktrees/phase-j1-openapi-runtime-source`
- base: `origin/main`

## 背景

Wave 4 実装の J1 として、仕様 14B/21A と `J1-pre-gap` の gap 調査をもとに、`GET /openapi.json` を runtime API contract の source of truth として明確化する。生成 Markdown は派生成果物として扱い、OpenAPI docs quality gate と drift/stale gate の最小基盤を追加する。

## 目的

- runtime `/openapi.json` が OpenAPI 生成・検証の入力であり、checked-in JSON を正本にしないことをテスト・docs・script で明確化する。
- `docs/generated/openapi.md` と `docs/generated/openapi/` が runtime OpenAPI から再生成される派生成果物であり、stale 差分を検出できるようにする。
- REST / oRPC / shared contract drift は初回として代表 use case の対応表と機械検証に限定し、過大実装を避ける。
- API lifecycle metadata の最小形を導入し、compatibility endpoint の扱いを機械可読にする。
- public `/openapi.json` の非機微性と保護 route の認可 metadata 維持を記録する。

## スコープ

- 主対象:
  - `apps/api/src/app.ts`
  - OpenAPI generation / validation scripts と関連 tests
  - `apps/api/src/security/access-control-policy.test.ts`
  - `apps/api/src/contract/api-contract.test.ts` または OpenAPI 関連の targeted test
  - OpenAPI / API contract の durable docs
  - 必要最小限の workflow / package script
- 含まない:
  - F/H 所有の chat tool registry、support ticket、search improvement 実装
  - 全 REST endpoint と全 oRPC procedure の完全 schema equivalence checker
  - API 管理画面での drift 表示
  - compatibility endpoint の削除や breaking API version 導入
  - rate limit / WAF / CDN 実装

## 作業計画

1. 現行 `/openapi.json`、OpenAPI docs generator/check、contract test、CI workflow の責務を確認する。
2. runtime source of truth を検証する最小 test と、generated Markdown stale を検出する check script を追加する。
3. API lifecycle metadata と代表 REST/oRPC 対応表を OpenAPI quality gate に組み込む。
4. public `/openapi.json` の非機微性・public allowlist・認可 metadata 維持を static/contract test と docs に残す。
5. 指定検証を実行し、作業レポートを作成する。
6. commit / push / PR 作成後、受け入れ条件コメントとセルフレビューコメントを投稿する。
7. PR コメント後に task md を `tasks/done/` へ移動し、状態を `done` にして同じ branch に commit / push する。

## ドキュメントメンテ方針

- `docs/generated/openapi*` は生成物としてのみ更新し、手編集しない。
- durable docs は OpenAPI runtime source、generated Markdown stale gate、docs quality gate、drift gate の責務差を明記する。
- public endpoint の理由・非機微性・濫用リスクは PR と作業レポートに明記する。

## 受け入れ条件

- [x] `GET /openapi.json` が runtime source of truth であることを確認する test または check が追加され、生成 Markdown が runtime JSON の派生成果物であることが docs に明記されている。
- [x] generated Markdown stale を検出する check が `npm run docs:openapi:check` または同等の CI 経路に組み込まれている。
- [x] OpenAPI docs quality gate が summary / description / field description / authorization metadata を維持しつつ、API lifecycle metadata の最小検証を行う。
- [x] REST / oRPC / shared contract drift は代表 use case の対応表または targeted check に限定して実装され、網羅的 checker は scope-out として記録されている。
- [x] `/openapi.json` が public endpoint である理由、返却データが非機微である根拠、濫用リスクと残対策が docs / PR / report に記録されている。
- [x] `apps/api/src/security/access-control-policy.test.ts` の public allowlist / protected route metadata に必要な更新が反映されている、または更新不要の理由が記録されている。
- [x] `npm run typecheck -w @memorag-mvp/api` が pass している。
- [x] `npm run docs:openapi:check` が pass している。
- [x] 関連 contract/api tests が pass している。
- [x] `git diff --check` が pass している。
- [x] `reports/working/YYYYMMDD-HHMM-j1-openapi-runtime-source.md` が作成され、指示・判断・成果物・fit・未解決リスクが記録されている。
- [x] PR が作成され、受け入れ条件確認コメントとセルフレビューコメントが日本語で投稿されている。
- [x] PR コメント後に task md が `tasks/done/` へ移動され、状態が `done` になり、同じ branch に commit / push されている。

## 検証計画

- `npm run typecheck -w @memorag-mvp/api`
- `npm run docs:openapi:check`
- 関連 contract/api tests
- workflow/script を触る場合、解決されるコマンド本文を確認して最小検証
- `git diff --check`

## PR レビュー観点

- docs と実装が `GET /openapi.json` runtime source of truth と矛盾しないこと。
- generated Markdown の stale gate が開発者に過剰な手順を強制せず、既存 CI と整合すること。
- public `/openapi.json` が認可境界を弱めず、機微データを返さないこと。
- benchmark 期待語句・QA sample 固有値・dataset 固有分岐を実装に入れていないこと。

## リスク

- `J1-pre-gap` PR が merge 前の場合、この branch には gap doc 本体を含めず参照情報として扱う可能性がある。
- generated docs の stale gate を通常 PR に入れると、OpenAPI 変更 PR では generated Markdown 更新も同時に必要になる。
- REST/oRPC drift は代表 use case のみであり、全 schema equivalence は後続 task の残リスクとして残る。
