# Traceability Matrix

| Source | Fact | Task | AC | E2E | OP/EXP | Requirement | Specification | Confidence | Notes |
|---|---|---|---|---|---|---|---|---|---|
| SRC-003, SRC-004 | FACT-002 | TASK-001 | AC-DOC-001, AC-DOC-002 | E2E-DOC-001 | OP-001, OP-002, OP-003, EXP-001, EXP-002, EXP-003 | REQ-DOC-001, REQ-OPS-001, REQ-SEC-001 | SPEC-DOC-001, SPEC-DOC-002, SPEC-SEC-001 | confirmed/inferred | UI 画面名は inferred。 |
| SRC-001, SRC-003, SRC-009, SRC-010, SRC-011 | FACT-001, FACT-003, FACT-004, FACT-005 | TASK-002 | AC-CHAT-001, AC-CHAT-002, AC-CHAT-003 | E2E-CHAT-001, E2E-CHAT-002 | OP-010, OP-011, OP-012, OP-013, EXP-010, EXP-011, EXP-012, EXP-013 | REQ-CHAT-001, REQ-RAG-001, REQ-RAG-002, REQ-OPS-001 | SPEC-CHAT-001, SPEC-CHAT-002, SPEC-RAG-001, SPEC-RAG-002 | confirmed | RAG guard は docs/reports/tests 由来。 |
| SRC-014, SRC-018 | FACT-009 | TASK-003 | AC-QA-001, AC-QA-002 | E2E-QA-001 | OP-020, OP-021, OP-022, EXP-020, EXP-021 | REQ-QA-001, REQ-SEC-001 | SPEC-QA-001, SPEC-SEC-002 | confirmed | 通常ユーザー本人と担当者境界。 |
| SRC-008, SRC-016 | FACT-006 | TASK-004 | AC-SRCH-001 | E2E-SRCH-001 | OP-030, EXP-030, EXP-031 | REQ-SRCH-001, REQ-SEC-001 | SPEC-SRCH-001, SPEC-SEC-003 | confirmed | query rewrite は GAP-007。 |
| SRC-012, SRC-013 | FACT-010 | TASK-005 | AC-HIST-001 | E2E-HIST-001 | OP-023, OP-024, EXP-022, EXP-023 | REQ-HIST-001, REQ-SEC-001 | SPEC-HIST-001, SPEC-HIST-002 | confirmed | item size は GAP-005。 |
| SRC-015 | FACT-011 | TASK-006 | AC-DBG-001 | E2E-DBG-001 | OP-031, EXP-032 | REQ-DBG-001, REQ-SEC-001 | SPEC-DBG-001, SPEC-SEC-001 | confirmed | detail sanitize は GAP-008。 |
| SRC-017, SRC-020, SRC-021 | FACT-012, FACT-015 | TASK-007 | AC-BENCH-001, AC-OPS-001 | E2E-BENCH-001 | OP-032, EXP-033 | REQ-BENCH-001, REQ-OPS-001 | SPEC-BENCH-001 | confirmed | AWS rerun は Q-006。 |
| SRC-005, SRC-006, SRC-007, SRC-019 | FACT-007, FACT-008 | TASK-008 | AC-ADM-001 | E2E-ADM-001 | OP-033, EXP-034 | REQ-ADM-001, REQ-SEC-001 | SPEC-ADM-001, SPEC-SEC-001 | confirmed | 既存ユーザー移行は Q-007。 |
| SRC-003, SRC-008 | FACT-006 | TASK-009 | GAP-007 | - | - | REQ-SRCH-001 | SPEC-SRCH-001 | inferred | alias/reindex 操作は API から復元、E2E 未作成。 |
| SRC-022 | FACT-014 | TASK-010 | GAP-009 | - | - | REQ-SEC-001 | SPEC-SEC-001 | inferred | UI permission gate はコード推定。 |
| SRC-024 | FACT-017 | TASK-011 | AC-AUTH-001 | E2E-AUTH-001 | OP-040, EXP-040 | REQ-AUTH-001 | SPEC-AUTH-001 | confirmed | login/new password/self signup/password guidance。 |
| SRC-031 | FACT-024 | TASK-012, TASK-022 | AC-API-001 | - | - | REQ-API-001, REQ-SEC-001 | SPEC-API-001, SPEC-SEC-001 | confirmed | API route split は非 UI docs/test 検証。 |
| docs/spec/2026-chapter-spec.md, docs/spec/gap-phase-j1.md | J1-CONF-001..J1-CONF-012, J1-GAP-001..J1-GAP-006 | TASK-012, TASK-022, TASK-A2-CHAPTER-REQ-MAP | AC-API-001, AC-DOCS-001 | - | - | REQ-API-001, FR-053, FR-055 | SPEC-API-001, docs/spec/CHAPTER_TO_REQ_MAP.md | confirmed/partially covered | 14B / 21A の runtime `/openapi.json`、生成 Markdown、docs quality gate、API lifecycle gap を J1 pre-gap として整理。 |
| SRC-028 | FACT-021 | TASK-013 | AC-UI-001 | E2E-UI-001 | OP-041, EXP-041 | REQ-UI-001 | SPEC-UI-001 | confirmed | copy/send/loading/scroll。 |
| SRC-028, SRC-012, SRC-013 | FACT-010, FACT-021 | TASK-014 | AC-HIST-002 | E2E-HIST-002 | OP-042, EXP-042 | REQ-HIST-002 | SPEC-HIST-003 | confirmed | 履歴検索、sort、回答通知。 |
| SRC-029, SRC-020 | FACT-015, FACT-022 | TASK-015 | AC-DOC-003 | E2E-DOC-002 | OP-043, EXP-043 | REQ-DOC-002, REQ-OPS-001 | SPEC-DOC-003 | confirmed | PDF/OCR/upload size/S3/async ingest。 |
| SRC-025 | FACT-018 | TASK-016 | AC-RAG-003 | E2E-RAG-002 | OP-044, EXP-044 | REQ-RAG-003 | SPEC-RAG-003 | confirmed | 回答可能性 policy と hardcode 禁止。 |
| SRC-026 | FACT-019 | TASK-017 | AC-SRCH-002 | E2E-SRCH-002 | OP-045, EXP-045 | REQ-SRCH-002 | SPEC-SRCH-002 | confirmed | semantic chunking/retrieval adoption gate。 |
| SRC-027 | FACT-020 | TASK-018 | AC-DBG-002 | E2E-DBG-002 | OP-046, EXP-046 | REQ-DBG-002 | SPEC-DBG-002 | confirmed | timeline/sentence assessment/artifact redaction。 |
| SRC-030 | FACT-023 | TASK-019 | AC-BENCH-002 | E2E-BENCH-002 | OP-047, EXP-047 | REQ-BENCH-002 | SPEC-BENCH-002 | confirmed | dataset adapter と metrics。 |
| SRC-030, SRC-031 | FACT-023, FACT-024 | TASK-020 | AC-BENCH-003 | E2E-BENCH-002 | OP-047, EXP-047 | REQ-BENCH-003, REQ-OPS-001 | SPEC-BENCH-003 | confirmed | timeout/cost/artifact。 |
| SRC-024 | FACT-017 | TASK-021 | AC-ADM-002 | E2E-ADM-001 | OP-033, EXP-034 | REQ-ADM-001, REQ-SEC-001 | SPEC-ADM-001, SPEC-SEC-001 | confirmed | all users/admin me permissions/role assignment。 |
| SRC-032 | FACT-025 | TASK-023 | AC-DOCS-001 | E2E-DOCS-001 | OP-048, EXP-048 | REQ-DOCS-001 | SPEC-DOCS-001 | confirmed | docs/requirements/coverage 管理。 |
| SRC-023 | FACT-016 | TASK-024 | AC-DOCS-001 | E2E-DOCS-001 | OP-048, EXP-048 | REQ-DOCS-001 | SPEC-DOCS-001 | confirmed | 全量 report 分类と commit/PR/merge only 除外。 |
| SRC-033 | FACT-026 | TASK-001..TASK-024 | AC-DOCS-001 | E2E-DOCS-001 | OP-048, EXP-048 | REQ-DOCS-001 | SPEC-DOCS-001 | confirmed | 本文確認済み `RPT-*` inventory。各 report の関連 task は `12_report_reading_inventory.md` に記録。 |
| docs/spec/2026-chapter-spec.md, docs/spec/gap-phase-a.md | GAP-013, GAP-014 | TASK-A2-CHAPTER-REQ-MAP | AC-DOCS-001 | E2E-DOCS-001 | OP-048, EXP-048 | FR-049, FR-050, FR-051, FR-052, FR-053, FR-054, FR-055, REQ-DOCS-001 | docs/spec/CHAPTER_TO_REQ_MAP.md | confirmed | 章別 canonical 仕様の全 top-level 章 ID を既存 REQ / planning REQ / spec-recovery / 実装ファイルへ対応付ける Phase A2 trace。 |
