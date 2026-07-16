# FR-053 API契約・OpenAPI品質ゲート

- 種別: `REQ_FUNCTIONAL`
- 状態: Draft（部分実装・部分検証）
- 仕様参照: `docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md` 14B 章
- gap 参照: `docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md`
- FR-053: REST、oRPC、shared contract、OpenAPI、生成 Markdown docs の関係を管理し、`GET /openapi.json` を runtime source of truth として API drift と docs quality を検出できること。

## 要求

REST、oRPC、shared contract、OpenAPI、生成 Markdown docs の関係を管理し、`GET /openapi.json` を runtime source of truth として API drift と docs quality を検出できること。

## 受け入れ条件

- [x] `GET /openapi.json` が runtime source of truth として扱われる。
- [x] 生成 Markdown docs は派生成果物として扱われ、freshness check で stale を検出する。
- [x] runtime OpenAPI、生成 docs freshness、docs quality と代表 oRPC mapping の drift が CI で検出される。
- [x] 互換同期 API は `x-memorag-lifecycle` で compatibility と replacement を表現し、長時間・大容量用途では非同期 API へ誘導される。
- [ ] REST endpoint、oRPC procedure、shared contract、OpenAPI の drift 検出範囲と未検出範囲が PR / CI / docs で明示される。

## 備考

Phase J1 pre-gap で現状を `docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md` に整理した。2026-05-14 時点では、runtime `/openapi.json`、生成 Markdown、summary / description / field description / authorization metadata の docs quality gate、主要 response schema contract test は確認済み。一方で、REST / oRPC / shared contract の網羅的 drift gate、generated Markdown stale を PR CI で fail する gate、機械可読 API lifecycle / deprecated metadata、breaking change 承認 flow は未整備であり、後続 `J1-openapi-runtime-source` の scope とする。

J1-openapi-runtime-source では `npm run docs:openapi:check` に generated Markdown freshness、互換同期 API の `x-memorag-lifecycle` metadata、`packages/contract` に定義された代表 oRPC route と runtime OpenAPI の mapping 検査を追加する。全 REST/oRPC schema equivalence、breaking change 判定、削除予定日を含む lifecycle registry は後続 task の範囲として残す。

## 実装・検証トレース

- `confirmed`: `apps/api/src/openapi-runtime-source.test.ts` は runtime OpenAPI source、派生 Markdown、lifecycle replacement、代表 oRPC mapping を検証する。
- `confirmed`: `apps/api/src/openapi-doc-quality.test.ts` と `apps/api/src/validate-openapi-docs.ts` は docs quality と generated Markdown freshness を検証する。
- `confirmed`: `.github/workflows/memorag-ci.yml` は OpenAPI/docs check を CI gate として実行する。
- `inferred`: 代表 oRPC mapping は drift 検知の有効な subset だが、全 REST/oRPC/shared contract schema equivalence の証拠ではない。
- `open_question`: 全量 drift、breaking-change 承認、削除予定日を含む lifecycle registry は `tasks/todo/20260713-2302-api-lifecycle-common-middleware.md` で追跡する。
