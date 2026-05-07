# app.ts OpenAPI route 分割 作業レポート

## 指示

- `memorag-bedrock-mvp/apps/api/src/app.ts` が大きく、特に OpenAPI 定義が集中して競合しやすいため、ファイル分割または委譲で薄くしたい。
- 既存 API の挙動や認証・認可境界は維持する。

## 要件整理

| 要件ID | 要件 | 対応 |
|---|---|---|
| R1 | `app.ts` から OpenAPI route 定義を切り出す | 対応 |
| R2 | endpoint、request/response、認証境界を変えない | 対応 |
| R3 | 静的 policy test が分割後も route-level permission を検証する | 対応 |
| R4 | 変更範囲に応じた検証を実行する | 対応 |
| R5 | docs / agent rule の参照先を更新する | 対応 |

## 検討・判断

- ユーザーの「openai」は現行コード上の OpenAI SDK ではなく、`@hono/zod-openapi` による OpenAPI route 定義集中を指すと判断した。
- 今回は API 仕様を変えないリファクタとして、全 route 登録を `src/routes/api-routes.ts` に移し、`app.ts` は依存生成、CORS、auth middleware、route 登録呼び出し、OpenAPI doc、error handler に限定した。
- `authorizeDocumentDelete` は移動後に module global の `service` へ依存しないよう、`MemoRagService` を引数で受け取る形に調整した。
- `access-control-policy.test.ts` は `app.ts` と `routes/api-routes.ts` の両方を読んで、分割後も保護 route と permission を静的検証できるようにした。
- 公開 API の path、schema、status code は変更していないため、API 仕様 docs の更新は不要と判断した。一方で `app.ts` 固定の実装参照が残る docs と `AGENTS.md` は更新した。

## 実施作業

- `memorag-bedrock-mvp/apps/api/src/routes/api-routes.ts` を追加し、既存 OpenAPI route 定義と関連 helper を移動。
- `memorag-bedrock-mvp/apps/api/src/app.ts` を 76 行まで縮小し、`registerApiRoutes(app, deps, service)` へ委譲。
- 既存 test import 互換のため、benchmark seed helper exports を `app.ts` から再 export。
- `memorag-bedrock-mvp/apps/api/src/security/access-control-policy.test.ts` を分割後の route source 読み取りに対応。
- `AGENTS.md` と NFR docs の route 実装参照を `src/routes/` も含む形に更新。

## 成果物

| 成果物 | 内容 |
|---|---|
| `memorag-bedrock-mvp/apps/api/src/app.ts` | API app の組み立てに責務を限定 |
| `memorag-bedrock-mvp/apps/api/src/routes/api-routes.ts` | OpenAPI route 定義と route helper の移動先 |
| `memorag-bedrock-mvp/apps/api/src/security/access-control-policy.test.ts` | 分割後の静的 permission policy 検証 |
| `AGENTS.md` | route 変更時の policy test 対象更新 |
| `REQ_NON_FUNCTIONAL_010.md`, `REQ_NON_FUNCTIONAL_011.md` | 実装参照先の更新 |

## 検証

- `npm ci`: pass。既存依存で moderate vulnerability 1 件の audit 警告あり。今回の変更範囲外のため未対応。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass。162 tests pass。
- `git diff --check`: pass
- `pre-commit run --files ...`: pass
- `task docs:check:changed`: 未実施。Task が存在しなかったため、`git diff --check` と `pre-commit` で Markdown を含む変更ファイルを確認した。

## Security / Access-Control Review

- 新規 public endpoint は追加していない。
- 保護対象 route の path、method、permission は変更していない。
- `authMiddleware` の対象 path は `protectedApiPaths` として `app.ts` に残し、静的 policy test で継続確認する。
- route-level permission は `routes/api-routes.ts` に移動したため、静的 policy test は複数 source を連結して検証する形にした。
- RAG の根拠性、認可境界、benchmark dataset 固有分岐は変更していない。

## Fit 評価

総合fit: 4.8 / 5.0（約96%）

理由: `app.ts` は 1694 行から 76 行になり、OpenAPI route 定義は委譲できた。既存 API test と typecheck は通過し、認可境界の静的検証も維持した。満点でない理由は、今回は route 定義を domain ごとの複数 file まで細分化せず、まず `routes/api-routes.ts` へ移動する段階に留めたため。

## 未対応・制約・リスク

- `routes/api-routes.ts` はまだ大きい。次の段階では `routes/admin-routes.ts`、`routes/document-routes.ts`、`routes/chat-routes.ts`、`routes/benchmark-routes.ts` などに分ける余地がある。
- `npm ci` により audit moderate 1 件が表示されたが、今回のリファクタ範囲外として対応していない。
- GitHub CI の結果は PR 作成後に確認が必要。
