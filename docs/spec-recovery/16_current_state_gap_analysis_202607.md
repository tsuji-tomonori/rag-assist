# 現行コード gap analysis 2026-07（実装後再監査）

## 判定基準

| Status | 意味 |
| --- | --- |
| implemented | 要求の主経路・否定経路を code と direct test で確認した |
| partial | 要求に含まれる強制経路または direct test が残る |
| conflict | accepted requirement/ADR と current implementation が相反する |
| open_question | production 値・運用判断・外部環境での確認が未確定 |

Confidence は `confirmed`（code/test/report で直接確認）、`inferred`（要求の抽象化）、`conflict`（別 source と矛盾）、`open_question`（available evidence では決めない）を区別する。

## 2026-07-11 再監査結果

- 対象: `FR-056`–`FR-093`, `SQ-005`–`SQ-015` の49要件。
- 実装 evidence: 49/49 行に production path と direct validation path がある。
- 要件別 code acceptance: 49/49 `pass`。詳細は `19_implementation_evidence_202607.csv`。
- branch validation: 最新の API/Web/contract/infra/benchmark typecheck と `npm run lint` は pass と報告済み。quality focused suites、operation/tenant/membership/resource-group suites も pass。
- 総合 release acceptance: `open_question`。SQ production threshold、workload observation、price ceiling、live AWS/chaos/CI は未承認・未実施であり、合格値を補完していない。

要件の `Confidence: inferred` は source から抽象化した要求の確度を示し、実装 evidence の `confirmed` と混同しない。

## 旧 gap の収束

| Gap | 現在状態 | Confidence | Current evidence / note |
| --- | --- | --- | --- |
| GAP-RD-001 | implemented | confirmed | authoritative account lifecycle、session revoke、current worker reauthorization |
| GAP-RD-002 | implemented / policy open | confirmed + open_question | tenant composite key/index と same-ID negative matrix は実装済み。product tenant 運用方針 `OQ-RD-001` は別途承認対象 |
| GAP-RD-003–005 | implemented | confirmed | canonical resource decision、admin non-bypass、direct/folder composition と operation kernel |
| GAP-RD-006–008 | implemented | confirmed | read-only reader UX、versioned principal validation、non-enumerating response allowlist |
| GAP-RD-009–010 | implemented | confirmed | authorized pre-top-K filter と evidence 使用前 current reauthorization |
| GAP-RD-011 | implemented | confirmed | worker start/read/side-effect/commit と post-final/pre-success reauthorization |
| GAP-RD-012–013 | implemented | confirmed | source admission、derived envelope、loss-aware staged ingest、fencing/reconciliation |
| GAP-RD-014–015 | implemented | confirmed | untrusted-content isolation と claim-level support/citation evidence |
| GAP-RD-016 | implemented | confirmed | authoritative deny 後の tenant-scoped 11-scope cleanup manifest、retry/residual/superseded-deny safety |
| GAP-RD-017 | implemented | confirmed | isolated candidate、CAS active pointer、rollback、exactly-one-active tests |
| GAP-RD-018 | implemented | confirmed | save/view/download 共通 trace sanitizer と raw secret/unauthorized value negative tests |
| GAP-RD-019 | implemented / live profile open | confirmed + open_question | versioned benchmark、release taint audit、promotion/deploy gate。実運用 profile/threshold は未承認 |
| GAP-RD-020 | conflict retained | conflict | self-signup/invite 方針は `FR-025` の範囲で、本49要件の code acceptance を変更しない |
| GAP-RD-021 | conflict retained | conflict | CloudFront/PKCE/CORS は `TC-003`/ADR の deploy trust-boundary 課題として継続 |
| GAP-RD-022 | implemented | confirmed | canonical role catalog、role mutation guard、infra provisioning parity |
| GAP-RD-023 | implemented | confirmed | folder/document move intent、path/policy/manifest/vector/index projection convergence |
| GAP-RD-024 | implemented / live drill open | confirmed + open_question | production observation/monitor/action/interlock contract。live alert/rollback drill は未実施 |

## 現在の未確定・未実施事項

### OQ-IMPL-001: SQ production threshold と observation profile

- Category: `open_question`
- Related: `FR-075`, `FR-093`, `SQ-006`–`SQ-015`
- Severity: high
- Confidence: open_question
- Current behavior: policy/schema/gate は未承認値、missing signal、profile/provenance mismatch を fail closed にする。
- Remaining decision: Security/SRE/Product/FinOps が target、fail point、window、owner、price ceiling を承認する。
- Impact: code acceptance は可能だが、production SLO/quality/cost 達成を合格済みとは記録できない。

### OQ-IMPL-002: live AWS / workload / chaos / notification evidence

- Category: `open_question`
- Related: `FR-058`, `FR-075`, `FR-090`, `FR-093`, `SQ-005`–`SQ-015`
- Severity: medium
- Confidence: open_question
- Current evidence: deterministic unit/in-process/CDK synth evidence。
- Remaining validation: live IdP/session revoke、representative workload、dependency recovery、CloudWatch alert/action/rollback drill。

### GAP-VAL-001: repository completion workflow

- Category: `no_e2e`
- Related: task completion / PR flow
- Severity: medium
- Confidence: confirmed
- Current evidence: targeted tests、typecheck、lint、diff checks は実施済み。
- Remaining validation: full repository test/build/CI、sandbox listener を要する HTTP/benchmark suites、PR checks。
- Impact: 49 requirement rows の code evidence は揃うが、branch/PR 全体を「完了」とは報告しない。

## 残存 partial requirement

code-level acceptance ledger に `partial` は残っていない。ただし、次は production acceptance として未確定である。

- `SQ-006`–`SQ-015`: threshold/target/price ceiling と representative/live observation が未承認または未実測。
- `FR-093`: live AWS notification と rollback drill は未実施。
- `FR-060`: current path の tenant partition は direct test 済みだが、既存 deployment data の migration/runbook は運用作業として別途必要。

これらを推定値で埋めず、`confirmed implementation` と `open_question operational acceptance` を分離する。

## Documentation impact

- 要件ファイル49件の `実装適合` を current evidence に同期した。
- `17_traceability_matrix_202607.csv` は current path/status を更新した。
- `18_implementation_execution_plan_202607.md` は実装完了と残存 validation/operation gate を分離した。
- `19_implementation_evidence_202607.csv` は49行の production/direct evidence と制約を記録した。
