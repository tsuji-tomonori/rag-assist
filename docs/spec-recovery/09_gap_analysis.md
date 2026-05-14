# Gap Analysis

## GAP-013: 章別 canonical 仕様と既存 REQ の対応表が未整備

- Category: traceability_gap
- Related: `docs/spec/gap-phase-a.md`, `.workspace/rag-assist_仕様追加_章別定義_管理者向け構成版 (1).md`
- Severity: high
- Confidence: confirmed
- Evidence: Phase A-pre 調査で `docs/spec/` と `docs/spec/CHAPTER_TO_REQ_MAP.md` が存在しないことを確認した。現行 `docs/REQUIREMENTS.md` と `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/README.md` は FR-001..FR-048 の L0-L3 分類を持つが、章別仕様の 0..24 章 ID から既存 REQ / spec-recovery / 実装ファイルへの対応はまだ追跡できない。
- Impact: Phase B 以降の task md が章 ID を安定参照できず、3 層認可、ナレッジ品質、チャット内オーケストレーション、非同期エージェントなどの新規・拡張範囲を既存要件と重複または欠落させるリスクがある。
- Recommended action: Phase A1 で章別仕様書を `docs/spec/2026-chapter-spec.md` として canonical 化し、Phase A2 で `docs/spec/CHAPTER_TO_REQ_MAP.md` を作成する。既存 FR 番号は renumber せず、新規不足分は `status: planning` の REQ 雛形として追加する。

## GAP-014: 章別仕様の folder / 3層認可 / 品質ゲートが現実装の role permission モデルと乖離

- Category: divergent_model
- Related: `docs/spec/gap-phase-a.md`, `apps/api/src/authorization.ts`, `apps/api/src/security/access-control-policy.test.ts`
- Severity: high
- Confidence: confirmed
- Evidence: 現実装は `Role` / `Permission` / `rolePermissions` と route-level permission metadata を中心に認可している。一方、章別仕様は Account status、Feature permission、Resource permission の 3 層と `EffectiveFolderPermission` を前提にする。仕様 2 章の folder 階層継承も、現行 document group / upload scope と完全一致しない。
- Impact: Phase B の認可基盤変更で既存 route permission、benchmark seed isolation、debug trace 権限境界を崩すリスクがある。
- Recommended action: Phase B-pre で現行 role mapping、route metadata、document group / benchmark seed 例外を棚卸しし、3 層モデルへの移行時に踏襲すべき既存挙動を task md の scope-out とリスクへ明記する。

## GAP-015: 4A/4B の toolId registry と multi-turn 永続構造が現行 chat-orchestration と未接続

- Category: traceability_gap
- Related: `docs/spec/gap-phase-f.md`, `docs/spec/2026-chapter-spec.md` 4A/4B, `apps/api/src/chat-orchestration/`
- Severity: high
- Confidence: confirmed
- Evidence: Phase F-pre 調査で、現行 `apps/api/src/chat-orchestration/graph.ts` と `nodes/` には RAG pipeline の主要 step、`decontextualizedQuery`、previous citation anchoring、RequiredFact、answerability / sufficient context / citation / support verification が存在することを確認した。一方、`ChatToolDefinition` / `ChatToolInvocation` schema、4B.5 の toolId registry、toolId ごとの permission / approval / audit metadata、conversation history store の `rollingSummary` / `queryFocusedSummary` / `citationMemory` / `taskState` は未実装。
- Impact: Phase F 実装で graph node、SearchAction、toolId の粒度を混同すると、trace / audit / permission が不明瞭になり、既存の ChatRAG follow-up 軽量化、required fact planning 汎化、policy computation 汎化、answer support verification、minScore filter、diversity、context budget が退化するリスクがある。
- Recommended action: `F-chat-tool-registry-multiturn` で、RAG 系 toolId と現行 node の対応を明示し、`ChatToolDefinition` / `ChatToolInvocation` / multi-turn state schema を追加する。document / drawing / support / benchmark / debug / external / quality / parse tool の本実装は Phase C/E/H/I/J/G 依存として scope-out または disabled registry entry に分ける。

## GAP-001: 作業レポート本文精読は完了

- Category: resolved_coverage_gap
- Related: 00_input_inventory.md, 12_report_reading_inventory.md, Q-010
- Severity: resolved
- Confidence: confirmed
- Evidence: `reports/working/*.md` と `reports/bugs/*.md` の本文 393 件を読み込み、`RPT-*` ID、分類、target、対象外理由、関連 task を `12_report_reading_inventory.md` に記録した。ユーザー指定の 391 件に、PR #189 の直前追加レポート 1 件と本作業レポート 1 件を含む。
- Impact: ファイル名分類だけに依存する漏れは解消した。
- Recommended action: 解決済み。今後は新規 report 追加時に `12_report_reading_inventory.md` を更新する。

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

## GAP-012: 未分類または横断レポート 37 件の精査は完了

- Category: resolved_coverage_gap
- Related: SRC-023, TASK-024, Q-010
- Severity: resolved
- Confidence: confirmed
- Evidence: 本文精読 inventory では個別確認候補は 0 件。旧未分類/横断 37 件は `chat-rag`、`search-retrieval`、`api-ops`、`docs-process` など既存カテゴリへ再分類した。
- Impact: 未分類のまま残る report はない。
- Recommended action: 解決済み。

## GAP-013: レポートごとの source ID は付与済み

- Category: resolved_traceability_gap
- Related: SRC-023, FACT-016, TASK-024
- Severity: resolved
- Confidence: confirmed
- Evidence: `12_report_reading_inventory.md` で各 report に `RPT-001` から `RPT-393` までの個別 ID を付け、関連 task と対象外理由を記録した。
- Impact: 特定 report から関連 task への trace が可能になった。
- Recommended action: 解決済み。ただし AC/E2E/REQ/SPEC への一点トレースは task family 経由で扱う。
