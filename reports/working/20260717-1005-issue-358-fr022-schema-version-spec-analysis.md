# FR-022 schemaVersion 契約仕様分析

## Input inventory

| ID | Source | 種別 | Date | 信頼度 |
|---|---|---|---|---|
| SRC-001 | Issue #358 P1-A / FR-022 | issue | 2026-07-15 | confirmed |
| SRC-002 | `REQ_FUNCTIONAL_022.md` | canonical requirement | current | confirmed |
| SRC-003 | `reports/working/20260502-1103-history-schema-version-docs.md` | work report | 2026-05-02 | confirmed |
| SRC-004 | commit `12f50338` と current source | implementation history | 2026-05-14/current | confirmed |
| SRC-005 | `DES_DATA_001.md`, `DES_API_001.md` | canonical design | current | conflict |
| SRC-006 | open PR #387 / #388 / #392 metadata and changed files | PR scope | 2026-07-17 | confirmed |

## Report facts

| ID | Fact | Confidence | Source |
|---|---|---|---|
| FACT-001 | v1 導入時の未指定 persisted item default は v1 だった。 | confirmed | SRC-003 |
| FACT-002 | multi-turn optional state 導入時に API current version は v2 へ上がった。 | confirmed | SRC-004 |
| FACT-003 | current store read は missing version を v2 にし、Web producer と DES は v1 のままである。 | confirmed | SRC-002, SRC-004, SRC-005 |
| FACT-004 | FR-022 は missing legacy item を v1 と扱うよう要求する。 | confirmed | SRC-002 |
| FACT-005 | #387 は conversation history/schema/generated docs、#388/#392 は API schema を変更する。 | confirmed | SRC-006 |

## Candidate tasks

| ID | Actor | Intent | Observable outcome | Confidence |
|---|---|---|---|---|
| TASK-FR022-001 | API/store | legacy read と current write を分離する | missing/v1/v2/unknown の結果が決定的になる | confirmed |
| TASK-FR022-002 | Web | current version で新規 item を作る | 新規 payload が v2 になる | confirmed |
| TASK-FR022-003 | maintainer | mixed-version migration を回帰検出する | contract test と docs が同じ語彙を持つ | confirmed |

## Acceptance criteria

### AC-FR022-MIG-001: version 欠落 persisted item の read

- Type: data_persistence / backward_compatibility
- Confidence: confirmed
- Source: FACT-001, FACT-004
- Given: 保存済み item に `schemaVersion` がない。
- When: local または DynamoDB store から一覧取得する。
- Then: item は v1 として返り、一覧取得だけでは保存先を書き換えない。

### AC-FR022-MIG-002: current new write

- Type: normal_path
- Confidence: confirmed
- Source: FACT-002, Issue #358
- Given: API または Web が新しい会話履歴を作る。
- When: item を保存する。
- Then: current v2 が保存・返却される。

### AC-FR022-MIG-003: mixed-version read

- Type: boundary
- Confidence: confirmed
- Source: Issue #358
- Given: missing、v1、v2 item が同じ user partition にある。
- When: 一覧取得する。
- Then: missing/v1 は v1、v2 は v2 として data loss なく返る。

### AC-FR022-MIG-004: update-time migration

- Type: retry_or_recovery / data_persistence
- Confidence: inferred
- Source: FACT-002, backward-compatible default
- Given: v1 item を current client が更新する。
- When: 保存 API を呼ぶ。
- Then: item は v2 へ昇格し、既存 data を保持する。

### AC-FR022-MIG-005: unknown version

- Type: error_path
- Confidence: inferred
- Source: safety-first principle
- Given: persisted または request item に 1/2 以外の version がある。
- When: read/write contract を通る。
- Then: unknown version を黙って v1/v2 に矯正せず拒否する。

### AC-FR022-MIG-006: ownership boundary unchanged

- Type: permission / multi_tenant_isolation
- Confidence: confirmed
- Source: FR-022 AC-001..003
- Given: user partitioned history API/store である。
- When: version normalization を行う。
- Then: authenticated userId partition と route permission は変更されない。

## E2E and non-UI scenarios

| ID | Scenario | Verification |
|---|---|---|
| CT-FR022-001 | local persisted JSON に missing/v1/v2 を入れ、一覧結果とファイル非更新を検査する。 | API store test |
| CT-FR022-002 | DynamoDB Query result に missing/v1/v2 を入れ、version と pagination/sort を検査する。 | API adapter test |
| CT-FR022-003 | version 未指定 POST input と v1 update input が v2 write になることを検査する。 | API contract/store test |
| CT-FR022-004 | Web の新規 conversation builder が v2 payload を保存する。 | Web hook test |
| CT-FR022-005 | unknown version を API/shared schema と persisted normalization が拒否する。 | contract test |

UI 操作そのものではなく data/API contract が主対象のため、ブラウザ E2E は Web hook/API contract test で代替する。production Web の表示挙動は変更しない。

## Operation and expectation groups

| Group | Operation | Expectation |
|---|---|---|
| LEGACY_READ | missing/v1 item を読む | v1 解釈、read-only、data preservation |
| CURRENT_WRITE | new/v1 item を保存する | v2 persistence/response |
| MIXED_VERSION | missing/v1/v2 を同時に読む | deterministic version vocabulary |
| INVALID_VERSION | unknown version を読む/書く | fail closed |

## Requirement/specification synthesis

- REQ: 既存 `FR-022` を正本とし、AC-FR022-004 を維持する。
- DATA SPEC: missing persisted value は legacy v1、new write は current v2、migration は update-time、read は副作用なし。
- API SPEC: request omission は new write v2、response は explicit 1/2、unknown version は validation/store error。
- WEB SPEC: new item producer は v2。v1 read item は UI で表示可能。
- Security: userId partition、permission、tenant/ownership 境界は非変更。

## Traceability and gap analysis

| Source | Fact | Task | AC | Verification | Requirement | Specification | Confidence | Gap |
|---|---|---|---|---|---|---|---|---|
| SRC-003 | FACT-001 | TASK-FR022-001 | AC-FR022-MIG-001 | CT-FR022-001/002 | FR-022 | DES_DATA_001 | confirmed | current store default conflict |
| SRC-004 | FACT-002 | TASK-FR022-002 | AC-FR022-MIG-002 | CT-FR022-003/004 | FR-022 | DES_API_001 | confirmed | Web producer/docs stale |
| SRC-001 | FACT-003 | TASK-FR022-003 | AC-FR022-MIG-003/004/005 | CT-FR022-001..005 | FR-022 | DATA/API contract | confirmed/inferred | mixed-version test absent |

## Conflict / open questions

- conflict: requirement/initial report は missing=v1、current store/schema read default は v2、Web/DES は current v1。
- decision: backward compatibility と version history を根拠に、missing persisted=v1 / current new write=v2 / update-time migration を採用する。
- open_question: 実 AWS item の version 分布。production migration/evidence は本タスクで実施しない。
- open_question: #387/#388/#392 取り込み順。重複 file は最終 merge 時に generator/contract/full test を再実行する。

## Validation applicability

`scripts/validate_spec_recovery.py` は `docs/spec-recovery/` tree 用であり、この task-scoped analysis と既存 canonical `FR-022` 更新には直接適用しない。代わりに repository docs check、requirement coverage、contract tests、diff/pre-commit で検証する。
