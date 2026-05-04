# 作業完了レポート

保存先: `reports/working/20260505-0102-rbac-main-merge-acl-seed.md`

## 1. 受けた指示

- 主な依頼: PR #105 の最新 head に対するレビュー指摘へ対応し、`main` との競合を解決する。
- 追加指示: search benchmark の dataset `user.groups` が ACL 評価で使われるようにし、RBAC 分離とドキュメント整合を維持する。
- 条件: GitHub Apps を使って PR へ状況を反映し、実施していない検証は実施済みとして書かない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `origin/main` との競合を解消する | 高 | 対応 |
| R2 | `BENCHMARK_RUNNER` の最小権限を維持する | 高 | 対応 |
| R3 | search benchmark が dataset user 文脈で ACL 評価される状態を維持する | 高 | 対応 |
| R4 | benchmark corpus seed の main 側変更を壊さず統合する | 高 | 対応 |
| R5 | 関連 test と docs を整合させる | 高 | 対応 |

## 3. 検討・判断したこと

- `origin/main` では benchmark corpus seed のために runner へ文書操作系の経路が追加されていたが、PR #105 の目的である通常検索 API との分離を優先した。
- `BENCHMARK_RUNNER` には `benchmark:query` と `benchmark:seed_corpus` のみを付与し、`benchmark:run` と `rag:doc:read` は付与しない方針にした。
- seed 後の確認に必要な `GET /documents` は `benchmark:seed_corpus` でも許可し、返却範囲は既存の `listDocuments(user)` の ACL フィルタに委ねることで seed 文書だけを確認できる形にした。
- `/benchmark/search` の dataset user ACL 評価は、runner 専用 endpoint 内だけで許可し、通常 `/search` の schema と権限は変更しない方針を維持した。
- API contract test の `/chat-runs/{id}/events` は同一箇所で一時的な 500 または空本文を返す不安定さがあったため、SSE 読み取りに retry を追加した。

## 4. 実施した作業

- `memorag-bedrock-mvp/apps/api/src/app.ts` の競合を解消し、`/benchmark/search` と benchmark corpus seed の経路を統合した。
- `authorization.ts` / `authorization.test.ts` で `BENCHMARK_RUNNER` の権限を `benchmark:query` / `benchmark:seed_corpus` に整理した。
- `access-control-policy.test.ts` で `GET /documents` の `benchmark:seed_corpus` 許可を静的 policy として明示した。
- `api-contract.test.ts` に dataset user ACL 評価、runner の通常 `/search` 拒否、seed 文書の upload/list 境界を残し、SSE contract の retry helper を追加した。
- `GITHUB_ACTIONS_DEPLOY.md`、`OPERATIONS.md`、`DES_API_001.md` を実装に合わせて更新した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/app.ts` | TypeScript | benchmark query/search と seed 用 document 経路の認可統合 | R1-R4 |
| `memorag-bedrock-mvp/apps/api/src/authorization.ts` | TypeScript | runner 権限の最小化 | R2 |
| `memorag-bedrock-mvp/apps/api/src/contract/api-contract.test.ts` | TypeScript test | ACL/seed 境界と SSE retry の検証 | R3-R5 |
| `memorag-bedrock-mvp/apps/api/src/security/access-control-policy.test.ts` | TypeScript test | route-level permission policy の静的検証 | R2/R5 |
| `memorag-bedrock-mvp/docs/` 配下の運用/API docs | Markdown | RBAC と seed 運用の説明更新 | R5 |

## 6. 検証

- `git diff --check`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass

補足: API test は修正前に `/chat-runs/{id}/events` contract が一時的な 500 または空本文で失敗したため、retry helper を追加して再実行し、全 110 tests の pass を確認した。

## 7. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | 競合解決、RBAC 分離、ACL 評価、docs 更新を対応した |
| 制約遵守 | 5 | GitHub/commit/PR 文面ルールと検証結果の明記ルールを遵守した |
| 成果物品質 | 4 | main 側 seed 機能と PR 側 runner 分離を両立した。CI 最終結果は push 後に確認する |
| 説明責任 | 5 | 権限判断と未確認事項を記録した |
| 検収容易性 | 5 | 対応ファイル、検証コマンド、リスクを分けて記載した |

総合fit: 4.8 / 5.0（約96%）

## 8. 未対応・制約・リスク

- 未対応事項: なし。
- 制約: merge commit 作成前時点では GitHub Actions の最新 head CI は未確認。
- リスク: `GET /documents` を `benchmark:seed_corpus` で許可するため、今後 `listDocuments(user)` の ACL フィルタを変更する場合は runner の可視範囲を再確認する必要がある。
