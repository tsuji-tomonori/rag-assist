# FR-053 API契約・OpenAPI品質ゲート

- 種別: `REQ_FUNCTIONAL`
- 状態: planning
- 仕様参照: `docs/spec/2026-chapter-spec.md` 14B 章
- FR-053: REST、oRPC、shared contract、OpenAPI、生成 Markdown docs の関係を管理し、`GET /openapi.json` を runtime source of truth として API drift と docs quality を検出できること。

## 要求

REST、oRPC、shared contract、OpenAPI、生成 Markdown docs の関係を管理し、`GET /openapi.json` を runtime source of truth として API drift と docs quality を検出できること。

## 受け入れ条件

- [ ] `GET /openapi.json` が runtime source of truth として扱われる。
- [ ] 生成 Markdown docs は派生成果物として扱われる。
- [ ] API drift と docs quality gate が CI で検出される。

## 備考

Phase J1 で詳細化する。
