# Gap Analysis

## GAP-018: authoritative account と tenant が runtime authorization に接続されていない

- Category: missing_security_boundary
- Related: FR-056, FR-058, FR-060, SQ-005, SQ-006, OQ-RD-001
- Severity: critical
- Confidence: confirmed
- Evidence: `AppUser` に tenant がなく、suspend/delete は admin ledger のみ、worker は submit 時 group snapshot を再利用する。
- Impact: stale session/queued work と multi-tenant 越境を fail closed にできない。
- Recommended action: identity source、session revoke、server-derived tenant、worker start/commit reauthorization を P0 で実装する。詳細は `16_current_state_gap_analysis_202607.md` の GAP-RD-001/002/011。

## GAP-019: folder/document authorization の source of truth が二重である

- Category: conflicting_implementation
- Related: FR-057, FR-059, FR-061, FR-063, FR-076, FR-077, FR-079, FR-081, OQ-RD-002, OQ-RD-007
- Severity: critical
- Confidence: conflict
- Evidence: ADR-0004 は FolderPermissionService を単一源泉とするが、list/search-scope/memory 等は legacy helper、SYSTEM_ADMIN bypass も残る。
- Impact: 同じ actor/resource でも list/evidence/memory/operation の結果が異なる。
- Recommended action: versioned canonical decision service、principal namespace 分離、operation matrix と path parity test。詳細 GAP-RD-003/004/005。

## GAP-020: read-only sharing の利用導線と安全な share mutation が不足する

- Category: missing_product_behavior
- Related: FR-062, FR-064, FR-065, FR-066, FR-076, FR-077, FR-085–FR-087, FR-091, OQ-RD-003, OQ-RD-011, OQ-RD-012
- Severity: high
- Confidence: confirmed
- Evidence: Web documents view は manage permission のみ、principal existence/same-tenant check と folder audit がなく、reader response は ACL/metadata を過剰返却し得る。
- Impact: 共有済み利用者が資料を使えない一方、誤共有・情報過剰露出の危険がある。
- Recommended action: directory-backed principal、version/audit/administrative-principal guard、reader summary、read-only workspace、move state reconciliation。詳細 GAP-RD-006–008/023。

## GAP-021: semantic/memory/context expansion は evidence 前認可を保証しない

- Category: missing_security_case
- Related: FR-066, FR-070, SQ-005, SQ-006
- Severity: critical
- Confidence: confirmed
- Evidence: semantic/memory は finite query 後の post-filter、context expansion は current permission/lifecycle/quality を再確認しない。
- Impact: underfill/side channel と revoke race による unauthorized prompt context。
- Recommended action: authorization partition/filter、bounded refill、per-chunk reauthorization。詳細 GAP-RD-009/010。

## GAP-022: ingest admission は unknown quality と hostile content を fail closed にしない

- Category: missing_security_and_quality_gate
- Related: FR-066, FR-068, FR-069, FR-070, FR-071, FR-072, FR-075, FR-082, FR-083, FR-092
- Severity: critical
- Confidence: conflict
- Evidence: quality missing は良好値へ補完し、caller metadata self-assertion、classification/usage/quality の current use-purpose recheck、content safety/scoped-idempotency/fencing/compensation/injection quarantine が不足する。
- Impact: unreviewed/poisoned/partial document や利用許可を剥奪した派生物が normal RAG/prompt/evaluation に公開され得る。
- Recommended action: protected metadata、default unverified、derived immutable references、use-purpose recheck、fenced state machine/quarantine/reconciliation/attack corpus。詳細 GAP-RD-012–014。

## GAP-023: claim-citation support と trace redaction が fail closed でない

- Category: conflicting_quality_and_privacy
- Related: FR-073, FR-074, FR-075, FR-088, SQ-007, SQ-010, SQ-011
- Severity: high
- Confidence: conflict
- Evidence: missing citation/support IDs を自動補完し、trace は raw question/history/evidence/answer を持つが実 sanitize と宣言が一致しない。
- Impact: unsupported claim に引用があるように見え、debug artifact が機微情報集積になる。
- Recommended action: explicit claim mapping、field-level save/download allowlists。詳細 GAP-RD-015/018。

## GAP-024: delete/reindex/rollback の lifecycle invariant がない

- Category: missing_reliability_and_security
- Related: FR-066, FR-072, SQ-006
- Severity: critical
- Confidence: confirmed
- Evidence: delete/cutover/rollback は storage を順次更新し、deny-first、exactly-one-active、compensation/reconciliation を保証しない。
- Impact: partial deletion、active version 0/複数、old ACL/deleted content 復活。
- Recommended action: tombstone/outbox/version manifest/fault-injection tests。詳細 GAP-RD-016/017。

## GAP-025: signup/auth edge/role catalog と accepted docs が衝突する

- Category: documentation_implementation_conflict
- Related: FR-025, FR-056, FR-057, FR-079, FR-080, FR-086, OQ-RD-008
- Severity: high
- Confidence: conflict
- Evidence: self-signup、CloudFront/PKCE/CORS、backend/infra role catalog、last admin guard が docs と current infra/Web で不一致。
- Impact: environment ごとに認証・public boundary・付与可能 role が変わる。
- Recommended action: stakeholder decision 後に requirement/ADR/infra/Web/tests を同時同期する。詳細 GAP-RD-020–022。

## GAP-026: product policy hardcode と evaluation profile の境界が曖昧である

- Category: evaluation_leakage_and_production_equivalence
- Related: FR-075, SQ-007, GAP-RD-019
- Severity: high
- Confidence: confirmed
- Evidence: versioned evaluator/RAG profile は accepted benchmark contract だが、product runtime の answer policy に特定 domain の分類語・regex が固定され、document metadata で自動選択される。expected fields を評価側だけに閉じる taint/source scan と production-equivalence gate がない。
- Impact: 正当な評価 profile 自体を禁止する誤修正、または dataset 固有分岐による見かけの改善のどちらも起き得る。
- Recommended action: evaluator profile は評価層、product policy は承認済み versioned asset として分離し、expected field が runtime decision に流入しないことと本番同一経路を自動検証する。

## GAP-027: 本番 RAG 品質・安全 monitoring の control loop がない

- Category: missing_production_quality_security_monitoring
- Related: FR-074, FR-075, FR-089, FR-093, SQ-005–SQ-015, GAP-RD-024
- Severity: high
- Confidence: confirmed
- Evidence: per-run trace と release-time benchmark はあるが、本番 stage/slice 別 aggregation、drift/critical threshold、alert、quarantine/rollback/限定回答 action の versioned contract がない。
- Impact: corpus、model、policy、dependency の変更後に生じる品質劣化、権限漏えい、injection regression を公開後に検出・封じ込められない。
- Recommended action: production signal aggregation、approved monitoring profile、on-call alert、safe action runbook を接続し、synthetic drift/critical event と rollback drill で検証する。

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
- Evidence: 現実装は `Role` / `Permission` / `rolePermissions` と route-level permission metadata を中心に認可している。一方、章別仕様は Account status、Feature permission、Resource permission の 3 層と `EffectiveFolderPermission` を前提にする。2026-05-19 の document group 権限修正で、親 sharing 継承と子の個別ポリシー優先は `document-groups` / documents / search / chat の主要実行経路に反映済み。ただし、章別仕様全体の 3 層認可モデルと品質ゲートの全 route への適用は継続課題である。
- Impact: Phase B の認可基盤変更で既存 route permission、benchmark seed isolation、debug trace 権限境界を崩すリスクがある。
- Recommended action: Phase B-pre で現行 role mapping、route metadata、document group / benchmark seed 例外を棚卸しし、3 層モデルへの移行時に踏襲すべき既存挙動を task md の scope-out とリスクへ明記する。

## GAP-015: SupportTicket / 検索改善 loop が既存 HumanQuestion / alias API と部分的にしか接続していない

- Category: implementation_gap
- Related: `docs/spec/gap-phase-h.md`, `docs/spec/2026-chapter-spec.md` 7/7A/7B/8, `apps/api/src/routes/question-routes.ts`, `apps/api/src/routes/admin-routes.ts`
- Severity: high
- Confidence: confirmed
- Evidence: 現実装は `/questions` と `HumanQuestion` により requesterUserId、chatRunId、担当者回答、internalMemo 非公開を扱える。一方、章別仕様の `SupportTicket.source`、`messageId`、`ragRunId`、`answerUnavailableEventId`、`sanitizedDiagnostics`、assignee user/group、SLA、品質起因分類、低評価起点、検索改善 AI suggest は未整備。alias API は draft / review / publish / audit を持つが、検索 0 件・低評価・問い合わせ・回答不能からの候補生成、検索結果差分、UI 上 alias 非露出の検証は未接続。
- Impact: H 実装で既存 requester 境界や `internalMemo` 非公開を壊す、または AI 候補を human review なしに検索へ反映するリスクがある。sanitized diagnostics を設計しないまま担当者へ trace を出すと、権限外文書名・件数・ACL group・内部 policy の露出につながる。
- Recommended action: `H-support-search-improvement` で既存 `/questions` 互換を維持した optional field 追加、`support_sanitized` allowlist、低評価 / answer_unavailable 起点の ticket create、AI suggest を draft / review 待ちに留める検索改善候補、publish 前 diff / reason / audit を実装する。API route 追加時は `access-control-policy.test.ts` と OpenAPI contract を同時更新する。

## GAP-016: 4A/4B の toolId registry と multi-turn 永続構造が現行 chat-orchestration と未接続

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

## GAP-017: レポートごとの source ID は付与済み

- Category: resolved_traceability_gap
- Related: SRC-023, FACT-016, TASK-024
- Severity: resolved
- Confidence: confirmed
- Evidence: `12_report_reading_inventory.md` で各 report に `RPT-001` から `RPT-393` までの個別 ID を付け、関連 task と対象外理由を記録した。
- Impact: 特定 report から関連 task への trace が可能になった。
- Recommended action: 解決済み。ただし AC/E2E/REQ/SPEC への一点トレースは task family 経由で扱う。
