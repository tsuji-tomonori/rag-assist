# Chapter To Requirement Map

Phase A 範囲のみを最新化する。Phase A 外の章は後続 Phase で TBD とする。

## Phase A

| 章 | 章名 | 既存 REQ / SPEC | 既存 docs | 実装・テスト根拠 | 対応状態 |
|---|---|---|---|---|---|
| 0 | 全体方針 | `REQ-SEC-001`, `SPEC-SEC-001`, `REQ-DEV-001`, `REQ-PROJ-001` | `docs/spec-recovery/06_requirements.md`, `docs/spec-recovery/07_specifications.md`, `docs/DOCS_STRUCTURE.md`, `docs/1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_001.md` | `apps/api/src/app.ts`, `apps/api/src/authorization.ts`, `apps/api/src/security/access-control-policy.test.ts`, `Taskfile.yml`, `package.json` | partially covered |
| 1 | 共通概念 | `REQ-SEC-001`, `REQ-ADM-001`, `SPEC-SEC-001`, `SPEC-ADM-001` | `docs/spec-recovery/01_report_facts.md`, `docs/spec-recovery/03_acceptance_criteria.md`, `docs/spec-recovery/07_specifications.md` | `apps/api/src/auth.ts`, `apps/api/src/authorization.ts`, `apps/api/src/types.ts`, `apps/api/src/adapters/user-directory.ts`, `apps/api/src/adapters/document-group-store.ts`, `apps/web/src/app/hooks/usePermissions.ts` | partially covered |
| 1A | 認証・アカウント | `REQ-AUTH-001`, `REQ-ADM-001`, `SPEC-AUTH-001`, `SPEC-ADM-001` | `docs/spec-recovery/03_acceptance_criteria.md`, `docs/spec-recovery/04_e2e_scenarios.md`, `docs/spec-recovery/07_specifications.md`, `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/08_認証・認可・管理・監査/01_通常利用者セルフサインアップ/REQ_FUNCTIONAL_025.md` | `apps/api/src/auth.ts`, `apps/api/src/adapters/user-directory.ts`, `apps/api/src/routes/admin-routes.ts`, `apps/web/src/features/auth/components/LoginPage.tsx`, `apps/web/src/authClient.ts` | partially covered |
| 2 | フォルダ管理 | `REQ-DOC-001`, `REQ-SEC-001`, `SPEC-DOC-001`, `SPEC-SEC-001` | `docs/spec-recovery/06_requirements.md`, `docs/spec-recovery/07_specifications.md`, `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/01_文書・知識ベース管理/07_スコープ付き資料グループ管理/REQ_FUNCTIONAL_041.md` | `apps/api/src/schemas.ts`, `apps/api/src/types.ts`, `apps/api/src/routes/document-routes.ts`, `apps/api/src/rag/memorag-service.ts`, `apps/api/src/adapters/document-group-store.ts`, `apps/web/src/features/documents/types.ts`, `apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx` | divergent |
| 3 | 文書管理 | `REQ-DOC-001`, `REQ-DOC-002`, `REQ-SEC-001`, `SPEC-DOC-001`, `SPEC-SEC-001` | `docs/spec-recovery/01_report_facts.md`, `docs/spec-recovery/03_acceptance_criteria.md`, `docs/spec-recovery/07_specifications.md`, `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/01_文書・知識ベース管理/01_文書登録/REQ_FUNCTIONAL_001.md`, `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/01_文書・知識ベース管理/02_文書のQA利用可能化/REQ_FUNCTIONAL_002.md` | `apps/api/src/schemas.ts`, `apps/api/src/types.ts`, `apps/api/src/routes/document-routes.ts`, `apps/api/src/rag/memorag-service.ts`, `apps/api/src/document-ingest-run-worker.ts`, `apps/web/src/features/documents/api/documentsApi.ts`, `apps/web/src/features/documents/hooks/useDocuments.ts` | partially covered |
| 6 | お気に入り | `REQ-HIST-001`, `SPEC-HIST-002` | `docs/spec-recovery/01_report_facts.md`, `docs/spec-recovery/03_acceptance_criteria.md`, `docs/spec-recovery/07_specifications.md`, `docs/spec-recovery/09_gap_analysis.md` | `apps/api/src/types.ts`, `apps/api/src/routes/conversation-history-routes.ts`, `apps/web/src/features/history/types.ts`, `apps/web/src/features/history/hooks/useConversationHistory.ts`, `apps/web/src/features/history/components/HistoryWorkspace.tsx`, `apps/web/src/features/history/utils/conversationHistorySearch.ts` | divergent |
| 24 | 最終まとめ | `REQ-RAG-*`, `REQ-SEC-001`, `REQ-DEV-001`, `SPEC-RAG-*`, `SPEC-SEC-001`, `SPEC-DEV-001` | `docs/spec-recovery/06_requirements.md`, `docs/spec-recovery/07_specifications.md`, `docs/spec-recovery/08_traceability_matrix.md`, `docs/spec-recovery/09_gap_analysis.md`, `docs/ARCHITECTURE.md` | `apps/api/src/agent/graph.ts`, `apps/api/src/agent/nodes/sufficient-context-gate.ts`, `apps/api/src/agent/nodes/validate-citations.ts`, `apps/api/src/agent/nodes/verify-answer-support.ts`, `apps/api/src/agent/runtime-policy.ts`, `apps/api/src/openapi-doc-quality.ts`, `packages/contract/src/`, `benchmark/` | partially covered |

## Phase A 踏襲挙動トレース

| 挙動 | 主な根拠 | 関連章 |
|---|---|---|
| ChatRAG follow-up perf: compact follow-up の query expansion 抑制、refusal / generic answer preamble の topic 汚染除外、不要 computation skip | commit `2c10256e`, `reports/working/20260512-1342-chatrag-latency-followup.md`, `apps/api/src/agent/nodes/build-conversation-state.ts`, `apps/api/src/agent/graph.test.ts` | 0 / 24 |
| required fact planning 汎化: fixed vocabulary slot rule 追加ではなく signal phrase primary fact と value signal gate を維持 | commit `c438009c`, commit `01bb1bff`, `reports/working/20260512-2046-generalize-required-fact-planning.md`, `reports/working/20260512-2329-remove-rule-based-required-facts.md`, `apps/api/src/agent/graph.ts` | 0 / 24 |
| policy computation gate 汎化: 金額・日本語可否語の固定 gate ではなく intent / required fact / 比較可能な値 signal で実行判定 | commit `71782905`, `reports/working/20260512-2017-generalize-policy-computation-gate.md`, `apps/api/src/agent/graph.ts`, `apps/api/src/agent/policy-computation.ts` | 0 / 24 |
| S3 Vectors metadata budget: filterable metadata 2048 bytes を守り、rich drawing metadata を vector metadata へ複製しない | `reports/working/20260511-2327-s3-vectors-metadata-budget.md`, `apps/api/src/adapters/s3-vectors-store.ts`, `apps/api/src/rag/memorag-service.ts`, `benchmark/corpus.ts` | 3 / 24 |
| Lambda quota / timeout: Document ingest worker と Heavy API は 3008MB memory、Document ingest timeout は 15 分上限 | `reports/working/20260510-2240-ingest-lambda-timeout-limit.md`, `reports/working/20260511-1937-adjust-heavy-api-lambda-quota.md`, `infra/lib/memorag-mvp-stack.ts`, `infra/test/memorag-mvp-stack.test.ts` | 3 / 24 |
| API coverage 閾値: API coverage gate は statements/functions/lines 90%、branches 85% | `reports/working/20260510-1238-api-c1-coverage-partial.md`, `apps/api/package.json`, `.github/workflows/memorag-ci.yml`, commit `1865d193` | 0 / 24 |

## Phase 外章

| 章 | 章名 | 状態 |
|---|---|---|
| 3A | 取り込み・抽出・チャンク化 | TBD: Phase B/C で更新 |
| 3B | ナレッジ品質・RAG利用可否 | TBD: Phase B/C で更新 |
| 3C | 高度文書解析・構造化抽出 | TBD: Phase B/C で更新 |
| 4 | チャット | TBD |
| 4A | チャット内RAG・回答生成 | TBD |
| 4B | チャット内オーケストレーション・ツール実行 | TBD |
| 4C | 非同期エージェント実行 | TBD |
| 5 | 履歴 | TBD |
| 6A | 個人設定 | TBD |
| 7 以降 | 問い合わせ、検索改善、評価、管理、運用、権限、不変条件など | TBD |
