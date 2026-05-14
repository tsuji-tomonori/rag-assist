# FR-053 API契約・OpenAPI品質ゲート

- 種別: `REQ_FUNCTIONAL`
- 状態: planning
- 仕様参照: `docs/spec/2026-chapter-spec.md` 14B 章
- gap 参照: `docs/spec/gap-phase-j1.md`
- FR-053: REST、oRPC、shared contract、OpenAPI、生成 Markdown docs の関係を管理し、`GET /openapi.json` を runtime source of truth として API drift と docs quality を検出できること。

## 要求

REST、oRPC、shared contract、OpenAPI、生成 Markdown docs の関係を管理し、`GET /openapi.json` を runtime source of truth として API drift と docs quality を検出できること。

## 受け入れ条件

- [ ] `GET /openapi.json` が runtime source of truth として扱われる。
- [ ] 生成 Markdown docs は派生成果物として扱われる。
- [ ] API drift と docs quality gate が CI で検出される。
- [ ] 互換同期 API は deprecated / compatibility として表現され、長時間・大容量用途では非同期 API へ誘導される。
- [ ] REST endpoint、oRPC procedure、shared contract、OpenAPI の drift 検出範囲と未検出範囲が PR / CI / docs で明示される。

## 備考

Phase J1 pre-gap で現状を `docs/spec/gap-phase-j1.md` に整理した。2026-05-14 時点では、runtime `/openapi.json`、生成 Markdown、summary / description / field description / authorization metadata の docs quality gate、主要 response schema contract test は確認済み。一方で、REST / oRPC / shared contract の網羅的 drift gate、generated Markdown stale を PR CI で fail する gate、機械可読 API lifecycle / deprecated metadata、breaking change 承認 flow は未整備であり、後続 `J1-openapi-runtime-source` の scope とする。

J1-openapi-runtime-source では `npm run docs:openapi:check` に generated Markdown freshness、互換同期 API の `x-memorag-lifecycle` metadata、`packages/contract` に定義された代表 oRPC route と runtime OpenAPI の mapping 検査を追加する。全 REST/oRPC schema equivalence、breaking change 判定、削除予定日を含む lifecycle registry は後続 task の範囲として残す。
