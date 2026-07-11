# Open Questions

## 2026-07 権限・共有・RAG 再定義

| ID | Alias | Related | Question | Why it matters | Proposed safe default | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q-013 | OQ-RD-001 | FR-056, FR-060, GAP-018 | product は single tenant か multi tenant か。authoritative tenant source は何か。 | store/query/cache/worker の partition 設計を確定するため。 | single tenant でも server config で固定し client 値を信頼しない | Product/Security | open_question |
| Q-014 | OQ-RD-002 | FR-061, FR-063, FR-077, GAP-019 | folder/direct/multi-folder grant の max/min、explicit deny、override 規則は何か。 | 同じ資源の経路別認可 drift をなくすため。 | mandatory deny と管理主体 invariant の後、残りは versioned decision | Product/Security | open_question |
| Q-015 | OQ-RD-003 | FR-063, FR-065, FR-076, FR-077, FR-087, GAP-020 | direct `full` は share/move/delete/reindex の何を許すか。 | direct share が container security boundary を越えるか決めるため。 | 危険操作は source container full を要求 | Product/Document owner | open_question |
| Q-016 | OQ-RD-004 | FR-058, FR-066, FR-072, FR-090, SQ-006 | revoke/delete propagation の max/p95/p99 は何秒か。 | exposure window と release SLO を判定するため。 | 値未承認なら pass と記録しない | Security/SRE | open_question |
| Q-017 | OQ-RD-005 | FR-075, FR-092, FR-093, SQ-007, SQ-009, SQ-010, SQ-011, SQ-012, SQ-013 | use case/slice 別 RAG quality threshold は何か。 | 平均点で重大 slice を相殺しないため。 | current baseline 測定後に業務責任者が承認 | Business owner/QA | open_question |
| Q-018 | OQ-RD-006 | FR-089, FR-091, FR-093, SQ-008, SQ-014, SQ-015 | chat/search/ingest workload と latency/availability/cost/non-enumeration target は何か。 | performance/reliability/security response 判定に必要。 | safety guard は値に関係なく省略禁止 | Product/SRE/Security | open_question |
| Q-019 | OQ-RD-007 | FR-059, GAP-019 | break-glass を導入するか。承認者、理由、期限、監査、事後 review は何か。 | SYSTEM_ADMIN normal bypass の置換方針を決めるため。 | normal route の resource bypass は禁止 | Security/Audit | open_question |
| Q-020 | OQ-RD-008 | FR-025, GAP-025 | self-signup、invite、SSO、tenant-configurable のどれを正式方針にするか。 | FR/Web/CDK/chapter spec の conflict を解消するため。 | conflict 解消まで public signup を実装済みと扱わない | Product/Identity | open_question |
| Q-021 | OQ-RD-009 | FR-066, FR-067, FR-068, FR-072, FR-078, FR-086, FR-088 | source/chunk/cache/trace/audit の retention、hard delete、legal hold は何か。 | purge と audit/recovery を両立するため。 | deny-first 後に policy-driven purge | Legal/Security/Ops | open_question |
| Q-022 | OQ-RD-010 | FR-068, FR-073, SQ-007 | source authority/effective date/conflict escalation の責任者と規則は何か。 | current/official evidence と unresolved conflict を判断するため。 | 未解消の重大矛盾は限定回答または保留 | Business owner | open_question |
| Q-023 | OQ-RD-011 | FR-041, FR-062, FR-076, FR-081, FR-085 | share audience として user、resource group、tenant-wide、guest/public link の何を許すか。 | principal validation と情報公開範囲を確定するため。 | active same-tenant user/resource group だけを許可 | Product/Security/Legal | open_question |
| Q-024 | OQ-RD-012 | FR-065, FR-076, FR-087 | move に source container `full` を必須とするか。direct document `full` だけを許す例外はあるか。 | container security boundary と既存 direct-share 挙動の conflict を解消するため。 | source と destination の両方に `full` を要求 | Product/Security | open_question |

| ID | Related | Question | Why it matters | Proposed default | Owner | Status |
|---|---|---|---|---|---|---|
| Q-001 | GAP-003, REQ-DOC-001, FR-068, FR-082 | 対応 mime type の正式リストは何か。PDF/Markdown/text 以外を許可するか。 | upload validation、E2E fixture、運用案内に必要。 | `text/plain`, `text/markdown`, `application/pdf` から開始 | PO/Tech Lead | open |
| Q-002 | GAP-003, REQ-DOC-001, FR-068, FR-082, FR-083, FR-092, SQ-015 | ファイルサイズ上限、ページ数上限、OCR timeout/retry、chunk budget の本番値は何か。 | 巨大/破損 PDF と chunk 境界の受け入れ値、cost guard に必要。 | versioned profile で上限管理し、超過時は明示エラーまたは quarantine | PO/Ops | open |
| Q-003 | GAP-004, REQ-RAG-001, REQ-SEC-001, FR-071, FR-075 | prompt injection 文書の標準テスト corpus と期待拒否文言をどう定義するか。 | RAG セキュリティを benchmark/E2E に組み込むため。 | 悪意命令を含む小規模 corpus を seed する | Security/QA | open |
| Q-004 | GAP-005, REQ-HIST-001 | 会話履歴の保持期間、最大件数、pagination、favorite 専用 index は必要か。 | DynamoDB item size、費用、UX に影響する。 | 初期は最大件数と pagination を追加検討 | PO/Tech Lead | open |
| Q-005 | GAP-006, REQ-OPS-001, OQ-RD-006, SQ-008, SQ-014, SQ-015 | chat latency、heartbeat 間隔、benchmark cost、UI a11y の受け入れ基準値は何か。 | 非機能要件の合否判定に必要。 | SQ/NFR から代表値を再利用 | PO/QA | open |
| Q-006 | GAP-011, REQ-BENCH-001 | CodeBuild 上で runner auth、MMRAG DocQA corpus skip、artifact download は再確認済みか。 | local test では AWS 依存挙動を保証できない。 | 次回 benchmark run 結果を入力ソースに追加 | Ops | open |
| Q-007 | REQ-ADM-001, SPEC-ADM-001, FR-079, FR-080, GAP-RD-022 | 既存環境のユーザーに `BENCHMARK_OPERATOR` など新 role をどう移行するか。 | role 定義修正後も既存ユーザーの group 付け替えが必要。 | 管理画面から再付与、必要なら one-shot migration | Ops/Admin | open |
| Q-008 | GAP-007, SPEC-SRCH-001 | retrieval evaluator の `query_rewrite` / `expand_context` をいつ実装するか。 | partial retrieval の改善と trace/action の完全性に関わる。 | 次の RAG 改善 PR で action executor を追加 | Tech Lead | open |
| Q-009 | GAP-008, SPEC-DBG-001, FR-088, OQ-RD-009 | debug trace `detail` の raw text を保存時 sanitize するか、download 時 redact するか。 | 管理者 artifact の機微情報露出リスクに関わる。 | 保存時 sanitize と download allowlist を優先 | Security | open |
| Q-010 | GAP-001, GAP-012, GAP-017 | 新規作業レポートが追加されたとき、`12_report_reading_inventory.md` をどのタイミングで更新するか。 | 本文精読 inventory を継続的に最新化するため。 | PR ごと、または spec recovery 更新時に差分 report だけ追記 | PO/Codex | open |
| Q-011 | GAP-002, CHG-003 | 既存 `FR-*` / `NFR-*` の受け入れ条件と今回の `AC-*` をどの形式で同期するか。 | 既存要件体系と spec recovery の二重管理を避けるため。 | FR-041/052 と NFR-011 は AC 単位の disposition table で今回解消。その他の旧要求の全面同期は residual open | Tech Writer | open_question |
| Q-012 | REQ-DOCS-001 | commit/PR/merge only 以外の process レポートを product docs とは別の process requirements として管理するか。 | agent workflow や PR flow も repo の品質要件だが、product requirement と混ぜると仕様が読みにくくなるため。 | `docs/spec-recovery/process-requirements.md` など別ファイルに分離 | Tech Lead | open |

## 既存 Q と 2026-07 baseline の crosswalk

- `Q-001`, `Q-002` は ingest 境界値の既存正規 question として維持し、重複する `OQ-RD-*` は作らない。
- `Q-003` は `FR-071`/`FR-075` の attack corpus、`Q-005` は `OQ-RD-006` の旧横断 question、`Q-007` は role migration、`Q-009` は `FR-088` の trace sanitation として双方向 trace する。
- `Q-011` は今回置換する `FR-041`, `FR-052`, `NFR-011` について AC disposition table で解消し、それ以外の旧要求体系との全面同期だけを residual open とする。
