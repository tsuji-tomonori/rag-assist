# Gap Analysis

## GAP-001: 作業レポート全量は分類済みだが本文精読は未完了

- Category: no_source_requirement
- Related: 00_input_inventory.md, Q-010
- Severity: low
- Confidence: confirmed
- Evidence: `reports/working/*.md` 384 件と `reports/bugs/*.md` 7 件はファイル単位で全量分類した。181 件は commit/PR/merge/CI コメント/競合解消/task acceptance のみとして task 化対象外にした。一方で、391 件すべての本文精読は未実施。
- Impact: file name/category から拾えない細かな画面文言、境界値、運用値が残る可能性がある。
- Recommended action: 未分類 37 件と product behavior 関連カテゴリを優先し、本文精読 batch を追加する。

## GAP-002: 個別 FR/NFR 受け入れ条件との完全照合が未完了

- Category: no_acceptance_criteria
- Related: SRC-001, Q-011
- Severity: medium
- Confidence: confirmed
- Evidence: `REQUIREMENTS.md` 索引は確認したが、全 `REQ_FUNCTIONAL_*` / `REQ_NON_FUNCTIONAL_*` の本文照合は未実施。
- Impact: 既存要件ファイルの AC と本復元 AC に差分が残る可能性がある。
- Recommended action: `FR-*` ごとに `AC-*` と既存受け入れ条件を突合する。

## GAP-003: 文書登録の境界値が未確定

- Category: missing_boundary_case
- Related: TASK-001, AC-DOC-001, REQ-DOC-001, Q-001, Q-002
- Severity: high
- Confidence: confirmed
- Evidence: 対応 mime type、ファイルサイズ上限、OCR timeout の本番閾値が本初版では確定できない。
- Impact: 巨大ファイル、破損 PDF、OCR 長時間化の E2E/運用仕様が曖昧になる。
- Recommended action: mime type、size、timeout、skip/retry 方針を requirement と operations docs へ明記する。

## GAP-004: Prompt injection を含む RAG セキュリティ E2E が未整備

- Category: missing_security_case
- Related: REQ-RAG-001, REQ-RAG-002, REQ-SEC-001, Q-003
- Severity: high
- Confidence: confirmed
- Evidence: 追加 skill の観点にはあるが、現行代表 docs/reports から具体的な prompt injection E2E を確認できていない。
- Impact: 悪意ある文書内命令への耐性を継続評価できない。
- Recommended action: prompt injection corpus と API/Web/benchmark 検証を追加する。

## GAP-005: 会話履歴の容量・保持・pagination が未確定

- Category: missing_non_functional
- Related: TASK-005, REQ-HIST-001, Q-004
- Severity: medium
- Confidence: confirmed
- Evidence: 作業レポートで DynamoDB item size 上限リスクが明記されている。
- Impact: 長大な会話や多数履歴で保存失敗、一覧性能劣化、費用増加が起き得る。
- Recommended action: 履歴 item size、保持期間、pagination、favorite index を定義する。

## GAP-006: UI a11y と latency/cost SLO の E2E 化が不足

- Category: missing_non_functional
- Related: REQ-OPS-001, REQ-BENCH-001, Q-005
- Severity: medium
- Confidence: inferred
- Evidence: SQ/NFR は存在するが、今回復元した E2E は主に機能/権限/RAG品質に集中している。
- Impact: UX 品質・性能・費用の受け入れ判定がレビュー依存になる。
- Recommended action: latency budget、stream heartbeat、keyboard 操作、cost guard の AC/E2E を追加する。

## GAP-007: Query rewrite / context expansion executor が未実装

- Category: no_specification
- Related: TASK-004, REQ-SRCH-001, SPEC-SRCH-001, Q-008
- Severity: medium
- Confidence: confirmed
- Evidence: retrieval evaluator 作業レポートに query rewrite と expand_context executor は未実装と記録されている。
- Impact: retrieval evaluator の `nextAction` が高度な再検索や context expansion に活かしきれない。
- Recommended action: action executor 仕様、trace、benchmark 指標を追加する。

## GAP-008: Debug trace detail 側の追加 sanitize 方針が未確定

- Category: missing_security_case
- Related: TASK-006, REQ-DBG-001, SPEC-DBG-001, Q-009
- Severity: medium
- Confidence: confirmed
- Evidence: debug redaction 作業レポートで `detail` 生文字列のマスキングは将来余地とされている。
- Impact: 管理者限定でも、download artifact に不要な機微情報が残る可能性がある。
- Recommended action: trace 保存時 sanitize policy と redaction test を定義する。

## GAP-009: UI permission gate の仕様根拠がコード推定に偏っている

- Category: no_source_requirement
- Related: TASK-010, FACT-014
- Severity: low
- Confidence: confirmed
- Evidence: AppRoutes/usePermissions から推定したが、画面別 permission matrix の durable docs は未確認。
- Impact: UI 表示条件と API permission の対応をレビューしにくい。
- Recommended action: Web navigation permission matrix を `docs/spec-recovery` または既存 docs に追加する。

## GAP-010: Alias / reindex 操作の E2E が未復元

- Category: no_e2e
- Related: TASK-009, SPEC-SRCH-001
- Severity: medium
- Confidence: confirmed
- Evidence: API surface には alias/reindex があるが、今回の代表 E2E では画面操作まで復元していない。
- Impact: blue-green reindex、alias publish/rollback の操作保証が弱い。
- Recommended action: RAG_GROUP_MANAGER 向け E2E と非UI検証を追加する。

## GAP-011: Benchmark の AWS 実行確認が一部未検証

- Category: missing_error_path
- Related: TASK-007, REQ-BENCH-001, AC-OPS-001, Q-006
- Severity: medium
- Confidence: confirmed
- Evidence: benchmark auth と Textract timeout の reports に、実 AWS rerun 未実施/未確認が記録されている。
- Impact: CodeBuild/Cognito/Textract 依存の failure handling は local test だけでは保証しきれない。
- Recommended action: CodeBuild suite 実行結果を traceability に追加する。

## GAP-012: 未分類または横断レポート 37 件の精査が残っている

- Category: no_source_requirement
- Related: SRC-023, TASK-024, Q-010
- Severity: medium
- Confidence: confirmed
- Evidence: 全量ファイル分類で、policy extraction、temporal computation、alias governance、advanced RAG ops、web component refactor など 37 件が未分類または横断カテゴリとして残った。
- Impact: 既存 task family に統合できる追加仕様、または新しい横断仕様が漏れる可能性がある。
- Recommended action: 未分類 37 件を本文精読し、既存 TASK への統合または新規 TASK として追加する。

## GAP-013: 全量分類はカテゴリ単位であり、レポートごとの source ID は未付与

- Category: traceability_granularity
- Related: SRC-023, FACT-016, TASK-024
- Severity: low
- Confidence: confirmed
- Evidence: 今回は `SRC-024` から `SRC-032` のカテゴリ source として扱い、391 件それぞれに個別 `RPT-*` ID は付けていない。
- Impact: 特定 report から task/AC への一点トレースは、代表ソース以外では粗い。
- Recommended action: 次バッチで機能カテゴリごとに個別 `RPT-*` ID を採番し、traceability matrix を詳細化する。
