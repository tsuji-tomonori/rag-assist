# 作業完了レポート

保存先: `reports/working/20260508-2355-openapi-role-access-docs.md`

## 1. 受けた指示

- 自動生成される API ドキュメントに、API ごとの実行可能 role、エラーになる role、エラー時の返却内容を明記する。
- その情報は Markdown 生成スクリプト側で推測せず、できる限り Hono + zod-openapi の OpenAPI 側で対応する。
- API 別 Markdown では response 一覧を先に載せ、その後に各 response 詳細を書く。
- `/plan` 後の `go` 指示により、実装・検証・PR workflow まで進める。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | OpenAPI 側に API ごとの認可情報を持たせる | 高 | 対応 |
| R2 | 生成 Markdown に実行可能 role / エラー role / エラー body を出す | 高 | 対応 |
| R3 | `Responses` を一覧先出し、詳細後続の構成にする | 高 | 対応 |
| R4 | protected API の 401 / 403 を OpenAPI 上に明示する | 高 | 対応 |
| R5 | metadata 欠落や policy とのズレを検証できる | 高 | 対応 |
| R6 | 関連検証を実行し、未実施を実施済みにしない | 高 | 対応 |

## 3. 検討・判断したこと

- 既存 handler の `requirePermission` を個別に重複記述するのではなく、API runtime 側の `authorization.ts` に route authorization policy を集約した。
- `looseRoute` が route config 作成時に `x-memorag-authorization` と標準 401 / 403 response を付与する構成にし、Markdown 生成器は OpenAPI extension を整形するだけにした。
- 所有者条件、requester 条件、benchmark seed 例外、debug 追加権限などは単純な role allow/deny だけでは表せないため、`mode`、`conditionalPermissions`、`conditionalDeniedRoles`、`notes` として明示した。
- 既存の静的 access-control test の policy 重複を減らし、OpenAPI metadata と policy の一致を検証するテストを追加した。

## 4. 実施した作業

- `authorization.ts` に route authorization policy と metadata 生成関数を追加した。
- `route-utils.ts` で route config に `x-memorag-authorization` と 401 / 403 response を注入するようにした。
- `generate-openapi-docs.ts` で `Authorization` セクションと response 一覧表を出力するようにした。
- `openapi-doc-quality.ts` で protected API の authorization metadata と 401 / 403 response を検証するようにした。
- `access-control-policy.test.ts` で route policy を共通 source から参照し、OpenAPI metadata と一致することを確認するテストを追加した。
- `docs/generated/openapi/*.md` を再生成し、全 API 詳細に role / permission / error 情報と response 一覧を追加した。
- `DES_API_001.md` に OpenAPI extension と生成 Markdown 構成の運用説明を追記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/authorization.ts` | TypeScript | role permission と route authorization policy / metadata | OpenAPI 側 source of truth |
| `memorag-bedrock-mvp/apps/api/src/routes/route-utils.ts` | TypeScript | zod-openapi route config への metadata / 401 / 403 注入 | Hono route 定義側対応 |
| `memorag-bedrock-mvp/apps/api/src/generate-openapi-docs.ts` | TypeScript | Authorization 表示と response 一覧先出し | Markdown 生成要件 |
| `memorag-bedrock-mvp/apps/api/src/openapi-doc-quality.ts` | TypeScript | metadata / 401 / 403 欠落検証 | 回帰防止 |
| `memorag-bedrock-mvp/apps/api/src/security/access-control-policy.test.ts` | TypeScript test | policy と OpenAPI metadata の一致検証 | セキュリティ回帰防止 |
| `memorag-bedrock-mvp/docs/generated/openapi/*.md` | Markdown | API 別 role / error / response 一覧 | 自動生成 docs |
| `memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_001.md` | Markdown | OpenAPI 生成 docs 運用説明 | durable docs 更新 |

## 6. 指示への fit 評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | role、error role、error body、response 一覧先出しを実装した。 |
| 制約遵守 | 5 | Markdown 生成器で推測せず、OpenAPI extension を route config 側で付与した。 |
| 成果物品質 | 4.5 | 条件付き認可は notes と conditional role で表現した。複雑条件は自然文補足を併用している。 |
| 説明責任 | 5 | durable docs、task md、作業レポートに方針と検証を記録した。 |
| 検収容易性 | 5 | 生成 Markdown とテストで変更結果を確認できる。 |

総合fit: 4.9 / 5.0（約98%）

## 7. 実行した検証

- `npm --prefix memorag-bedrock-mvp run docs:openapi`: pass
- `npm --prefix memorag-bedrock-mvp run docs:openapi:check`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: fail -> `ownedRun` 静的テストの判定を既存 inline 所有者チェックに合わせて修正後 pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass

## 8. セキュリティ確認

- protected route は既存 `authMiddleware` 境界を維持している。
- route-level permission は既存 handler の `requirePermission` / `hasPermission` と route authorization policy を対応させた。
- 所有者・requester・benchmark seed 例外は `mode` と `notes` で OpenAPI metadata に残した。
- `OpenAPI authorization metadata matches route authorization policies` テストで OpenAPI 上の metadata と policy のズレを検出する。
- RAG の根拠性、認可境界、benchmark dataset 固有分岐の実装には変更を加えていない。

## 9. 未対応・制約・リスク

- `npm ci` 実行後に npm audit が 1 moderate vulnerability を報告したが、本作業の依存追加ではないため未対応。
- 生成 Markdown の変更量は大きいが、`npm run docs:openapi` による機械生成差分である。
- 条件付き認可は入力値やリソース所有者に依存するため、role 表だけでなく補足文を併記している。
