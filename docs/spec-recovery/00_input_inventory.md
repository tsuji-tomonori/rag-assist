# Input Inventory

## 方針

この初版では、全作業レポートの逐次読解ではなく、既存仕様・設計・API・静的認可テスト・代表的な作業/障害レポートを高信頼ソースとして採用する。未読の作業レポート群は `GAP-010` と `Q-010` で追跡する。

| ID | 種別 | 日付 | 入力ソース | 信頼度 | 採用理由 |
|---|---|---|---|---|---|
| SRC-001 | product docs | 2026-05-01 | `memorag-bedrock-mvp/docs/REQUIREMENTS.md` | high | FR/NFR/SQ/TC の索引、ASR 対応、受け入れ観点の正規入口。 |
| SRC-002 | architecture docs | 2026-05-01 | `memorag-bedrock-mvp/docs/ARCHITECTURE.md` | high | RAG runtime、認証認可、評価、運用の ASR と構成方針。 |
| SRC-003 | API design docs | 2026-05-01 | `memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_001.md` | high | API surface、request/response、認可、SSE、検索経路。 |
| SRC-004 | API examples | 2026-05-01 | `memorag-bedrock-mvp/docs/API_EXAMPLES.md` | high | 文書登録、非同期 chat run、検索、debug、削除の利用例。 |
| SRC-005 | static policy test | current | `memorag-bedrock-mvp/apps/api/src/security/access-control-policy.test.ts` | high | route-level permission と所有者/seed 例外の静的保証。 |
| SRC-006 | code | current | `memorag-bedrock-mvp/apps/api/src/authorization.ts` | high | role と permission の現行定義。 |
| SRC-007 | work report | 2026-05-01 | `reports/working/20260501-0253-authn-authz-cognito-rbac-abac.md` | medium | Cognito JWT、RBAC、ログイン画面、ABAC 未実装の経緯。 |
| SRC-008 | work report | 2026-05-02 | `reports/working/20260502-1208-search-api-hybrid-retriever.md` | medium | `POST /search`、BM25/vector/RRF、metadata/ACL filter。 |
| SRC-009 | work report | 2026-05-02 | `reports/working/20260502-1136-sufficient-context-gate.md` | medium | sufficient context gate、回答不能制御、trace。 |
| SRC-010 | work report | 2026-05-02 | `reports/working/20260502-1354-answer-support-verifier.md` | medium | 回答後引用支持検証、不支持文拒否、trace。 |
| SRC-011 | work report | 2026-05-04 | `reports/working/20260504-0205-rest-api-streaming-chat.md` | medium | `POST /chat-runs`、SSE、永続 run/event、Web streaming。 |
| SRC-012 | work report | 2026-05-02 | `reports/working/20260502-1051-history-db-storage.md` | medium | 会話履歴 DB 永続化、userId 分離、DynamoDB item size リスク。 |
| SRC-013 | work report | 2026-05-03 | `reports/working/20260503-1145-favorites-implementation.md` | medium | 会話履歴お気に入り、既存 route 内の所有者境界。 |
| SRC-014 | work report | 2026-05-04 | `reports/working/20260504-1120-question-answer-notifications.md` | medium | 問い合わせ回答確認、履歴通知、本人向け詳細、internalMemo 非公開。 |
| SRC-015 | work report | 2026-05-02 | `reports/working/20260502-1235-debug-trace-access-redaction.md` | medium | debug trace の管理者限定、機微フィールド redaction。 |
| SRC-016 | work report | 2026-05-02 | `reports/working/20260502-1432-retrieval-evaluator.md` | medium | retrieval evaluator、検索品質分類、未実装 query rewrite。 |
| SRC-017 | work report | 2026-05-02 | `reports/working/20260502-1500-benchmark-runner-auth.md` | medium | benchmark runner service user、手動 token 不要化、実 AWS 未検証。 |
| SRC-018 | bug report | 2026-05-02 | `reports/bugs/20260502-1135-question-escalation-forbidden.md` | high | 通常ユーザーの問い合わせ後 403、権限付き list/debug の不要取得。 |
| SRC-019 | bug report | 2026-05-06 | `reports/bugs/20260506-2303-role-assignment-access-denied.md` | high | role 付与と Cognito group 同期、BENCHMARK_OPERATOR 分離。 |
| SRC-020 | bug report | 2026-05-07 | `reports/bugs/20260507-2029-mmrag-textract-timeout.md` | medium | PDF OCR timeout、benchmark corpus skip、AWS rerun 未検証。 |
| SRC-021 | bug report | 2026-05-08 | `reports/bugs/20260508-0902-cdk-benchmark-context-required.md` | high | CDK benchmark source context 省略時 failure と default/test。 |
| SRC-022 | tests | current | `memorag-bedrock-mvp/apps/web/src/app/AppRoutes.tsx`, `usePermissions.ts`, feature hooks/tests | medium | UI view と permission-gated navigation の現行推定根拠。 |

## ソース範囲外または未読代表外

- `reports/working/` には 200 件超の作業レポートがある。初版では RAG/認可/UI/benchmark/運用に関係する代表レポートのみ本文を確認した。
- `memorag-bedrock-mvp/docs/1_要求_REQ/` 配下の個別 FR/NFR ファイルは索引と設計との整合確認に留め、全ファイルの受け入れ条件までは精査していない。
