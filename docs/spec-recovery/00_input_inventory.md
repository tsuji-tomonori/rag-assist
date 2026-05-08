# Input Inventory

## 方針

この版では、既存仕様・設計・API・静的認可テスト・代表的な作業/障害レポートを高信頼ソースとして本文確認し、さらに `reports/working/*.md` と `reports/bugs/*.md` を本文ベースで全量棚卸しした。

commit、PR 作成、merge/rebase、競合解消、CI コメント投稿、task acceptance 確認だけを扱うレポートは、ユーザー価値や observable behavior へ直接つながる task としては扱わない。これらは process/audit evidence として分類し、機能・挙動・品質・運用に関係する report category から task family を抽出する。

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
| SRC-023 | report sweep | 2026-05-08 | `reports/working/*.md` 384 件、`reports/bugs/*.md` 7 件 | medium | 全量ファイル分類。commit/PR/merge only を除外し、仕様化対象カテゴリを確認。 |
| SRC-024 | report category | 2026-05-08 | auth/RBAC/security 系 29 件 | medium | Cognito、login、password、role、permission、OIDC、CORS、self signup、admin permission 境界。 |
| SRC-025 | report category | 2026-05-08 | chat/RAG answer/question 系 21 件 | medium | 非同期 chat、回答可能性 gate、回答支持検証、質問エスカレーション、担当者 UI。 |
| SRC-026 | report category | 2026-05-08 | search/retrieval 系 26 件 | medium | hybrid/fulltext/search cycle、semantic chunking、retrieval evaluator、adoption gate。 |
| SRC-027 | report category | 2026-05-08 | debug/trace 系 10 件 | medium | debug JSON/Markdown、timeline、sentence assessment、S3/direct download、redaction。 |
| SRC-028 | report category | 2026-05-08 | history/favorite/UI 系 14 件 | medium | 履歴保存・検索・sort、favorite、copy、send shortcut、loading/visual/UI polish。 |
| SRC-029 | report category | 2026-05-08 | documents/ingest/OCR/upload 系 9 件 | medium | PDF classification、upload size、S3 upload、async ingest、OCR fallback、APIGW timeout/quota。 |
| SRC-030 | report category | 2026-05-08 | benchmark/evaluation 系 21 件 | medium | benchmark run/admin、LLM judge、Allganize/MMRAG/NeoAI dataset、metrics、artifact、timeout。 |
| SRC-031 | report category | 2026-05-08 | API/infra/ops 系 11 件 | medium | API contract、OpenAPI/route split、APIGW request validation、cost/tag/anomaly、CodeBuild/CDK。 |
| SRC-032 | report category | 2026-05-08 | docs/requirements/process 系 32 件 | low | docs/requirements/skill/process 改善。product behavior の根拠になるものだけ仕様へ反映。 |
| SRC-033 | report reading inventory | 2026-05-08 | `docs/spec-recovery/12_report_reading_inventory.md` | medium | `reports/working/*.md` と `reports/bugs/*.md` の本文確認済み inventory。個別 `RPT-*` ID と分類、対象外理由、関連 task を記録。 |

## 作業レポート本文精読結果

| 分類 | 件数 | task 化方針 |
|---|---:|---|
| commit/PR/merge/CI コメント/競合解消/task acceptance のみ | 90 | 原則 task 化しない。workflow/process evidence として扱う。 |
| docs/requirements/process | 51 | product behavior に関係するものだけ `TASK-023` / `TASK-024` と traceability に反映する。 |
| auth/RBAC/security | 24 | 認証、role、permission、所有者境界、self signup/OIDC/CORS として task 化する。 |
| chat/RAG answer/question | 63 | chat run、回答可能性、回答支持、人手問い合わせとして task 化する。 |
| search/retrieval | 20 | hybrid search、search cycle、semantic chunking、retrieval evaluator として task 化する。 |
| debug/trace | 9 | trace 調査、download、redaction、timeline replay として task 化する。 |
| history/favorite/UI | 47 | 履歴、お気に入り、UI 操作性、loading/copy/send shortcut として task 化する。 |
| documents/ingest/OCR/upload | 7 | upload、async ingest、PDF/OCR fallback、size/timeout/quota として task 化する。 |
| benchmark/evaluation | 44 | benchmark run、dataset/corpus、metric、artifact、CI/AWS 実行として task 化する。 |
| API/infra/ops | 38 | API 契約、route 分割、request validation、cost/ops guard として task 化する。 |

本文確認済み report は 393 件である。ユーザーが指摘した 391 件に、PR #189 の直前追加作業レポート 1 件と、この本文精読作業の完了レポート 1 件が加わっているためである。個別確認候補は 0 件で、すべて `yes`、`partial`、`no` のいずれかに分類した。

## ソース範囲外または未読代表外

- `reports/working/` と `reports/bugs/` は本文確認済み。個別 `RPT-*` ID と分類結果は `12_report_reading_inventory.md` に記録した。
- `memorag-bedrock-mvp/docs/1_要求_REQ/` 配下の個別 FR/NFR ファイルは索引と設計との整合確認に留め、全ファイルの受け入れ条件までは精査していない。
