# Phase A ギャップ・影響範囲調査

状態: draft
タスク: `tasks/do/20260514-1315-phase-a-pre-gap.md`
入力:
- `.workspace/wsl-localhost-ubuntu-home-t-tsuji-proje-vivid-cloud.md`
- `.workspace/rag-assist_仕様追加_章別定義_管理者向け構成版 (1).md`
- `docs/spec-recovery/`
- `docs/1_要求_REQ/`
- `apps/api/src/`, `apps/web/src/features/`, `packages/contract/src/`

## 1. 調査範囲

Phase A は章別仕様を canonical docs として固定し、後続 Phase B-J/G の章 ID と既存 REQ / 実装ファイルを結び付ける準備を行う。
本調査では、計画で指定された 0/1/1A/2/3/6/24 章を入口に、全章マップに必要な現行 docs と実装の状態を確認した。

## 2. 章構成の確認

| 章 | 内容 | Phase A での扱い | 状態 |
|---|---|---|---|
| 0 | 全体方針 | canonical 仕様の入口として `docs/spec/README.md` と章マップに反映する | missing |
| 1 | 共通概念 | User / UserGroup / GroupMembership を既存 auth/admin docs と対応付ける | partially covered |
| 1A | 認証・アカウント | 既存 Cognito / local auth / signup 要件と対応付ける | partially covered |
| 2 | フォルダ管理 | 現実装では document group / scope が中心で、仕様上の階層 folder と完全一致しない | divergent |
| 3 | 文書管理 | 既存 Document / upload / ingest / delete 要件はあるが、品質 4 軸は未反映 | partially covered |
| 3A | 取り込み・抽出・チャンク化 | 既存 chunk / manifest / text extract はあるが、拡張子別 dispatcher と構造化抽出は未整備 | partially covered |
| 3B | ナレッジ品質・RAG利用可否 | verification / freshness / supersession / ragEligibility の 4 軸は未実装 | missing |
| 3C | 高度文書解析 | ParsedDocument / ParsedBlock / ExtractedTable / ExtractedFigure は未実装 | missing |
| 4A-4C | チャット、多ターン、オーケストレーション、非同期エージェント | 既存 chat/RAG はあるが、名称変更と非同期エージェントは後続 Phase で扱う | partially covered |
| 6 | 個人設定 | 現行 docs / web feature として独立した personal settings は確認できない | missing |
| 14B-14D | API契約、品質ゲート、worker 契約 | OpenAPI generation と worker run はあるが、章 ID map がない | partially covered |
| 16-21A | 認可モデル / 操作別認可表 / API lifecycle | 既存 role permission と static policy test はあるが、3 層モデルではない | divergent |
| 24 | 最終まとめ | 後続 Phase 全体の不変条件として map と PR レビュー観点に反映する | confirmed |

## 3. 現行 docs の状態

### confirmed

- `docs/REQUIREMENTS.md` は SWEBOK-lite の上位索引で、詳細要件は 1 要件 1 ファイルを正とする運用になっている。
- `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/README.md` は L0-L3 の機能要求分類索引で、現行 FR-001..FR-048 を 8 大カテゴリに分類している。
- `docs/spec-recovery/` は `00_input_inventory.md` から `12_report_reading_inventory.md` までの仕様復元成果物を持ち、`scripts/validate_spec_recovery.py docs/spec-recovery` の対象になっている。
- `docs/spec-recovery/08_traceability_matrix.md` は既存 task / AC / E2E / 要件 / 仕様の横断表を持つ。
- `docs/spec-recovery/09_gap_analysis.md` は既存ギャップを GAP-001 以降で管理している。

### missing

- `docs/spec/` は存在しなかった。Phase A1 で作成し、章別仕様書の canonical コピーと README を配置する必要がある。
- `docs/spec/CHAPTER_TO_REQ_MAP.md` は存在しない。Phase A2 で全章 ID と既存 REQ / spec-recovery / 実装ファイルの対応を作る必要がある。
- 4B / 4C / 6A / 16-20 / 14B / 14C / 14D など、章別仕様で新規・拡張された概念に対応する REQ 雛形が不足している。

### divergent

- 既存機能要求の L1-L3 分類は MVP 実装の機能カテゴリに基づく。一方、章別仕様はフォルダ階層、3 層認可、ナレッジ品質、高度文書解析、非同期エージェントなどの横断章を持つ。Phase A2 では既存 FR 番号を置換せず、章 ID から既存 FR / 新規 planning REQ へ対応付ける必要がある。

## 4. 現行実装の状態

### confirmed

- API route は `apps/api/src/routes/` に分割され、chat / document / conversation-history / question / debug / benchmark / admin / system などを扱う。
- 認可は `apps/api/src/authorization.ts` の `Role` / `Permission` / `rolePermissions` と route metadata に基づく。`apps/api/src/security/access-control-policy.test.ts` は route-level permission の静的検証を行う。
- 同期チャット/RAG の主要処理は `apps/api/src/agent/` と `apps/api/src/agent/nodes/` に集約されている。`normalize-query`, `search-evidence`, `rerank-chunks`, `sufficient-context-gate`, `verify-answer-support`, `validate-citations` などが存在する。
- RAG 取り込み・検索の基礎は `apps/api/src/rag/`, `apps/api/src/adapters/*object-store*`, `apps/api/src/adapters/*vector-store*` にある。
- Web は `apps/web/src/features/` 配下に admin / auth / benchmark / chat / debug / documents / history / questions を持つ。
- 共有 contract は `packages/contract/src/` と `apps/api/src/schemas.ts` に分かれており、OpenAPI は `apps/api/src/generate-openapi-docs.ts` から生成される。
- API 全体の束ね込みは `apps/api/src/app.ts` が担い、public endpoint、auth middleware、OpenAPI、REST routes、oRPC を接続する。
- 章 1/1A の近接実装は `apps/api/src/auth.ts`, `apps/api/src/authorization.ts`, `apps/api/src/routes/system-routes.ts`, `apps/api/src/routes/admin-routes.ts` にある。
- 章 2 の folder に近い現実装は document group / scope / owner / shared users / shared groups / manager 境界であり、`apps/api/src/routes/document-routes.ts` と `apps/api/src/rag/memorag-service.ts` にまたがる。

### partially covered

- conversation history、debug trace、benchmark run、document ingest run は実装済みだが、章別仕様の multi-turn state 分割、debug 4 tier、benchmark suite 分離とは完全一致しない。
- question routes は問い合わせ導線を持つが、章別仕様の `SupportTicket` と sanitize 済み trace 引き継ぎは後続 Phase H の確認対象である。
- document group / upload scope は存在するが、仕様 2 章の folder path uniqueness / hierarchical inheritance / effective folder permission とは差分がある。

### missing

- `ChatOrchestrationRun` 名称、`ChatToolDefinition` registry、`AsyncAgentRun`、`SkillDefinition` / `AgentProfileDefinition`、`AgentWorkspaceMount`、writeback approval は未実装。
- `KnowledgeQualityStatus`、`ParsedDocument` 系、品質 4 軸による RAG eligibility enforcement は未実装。
- `docs/spec/` を実装・REQ と結び付ける map がないため、後続 Phase の task md で章 ID を安定参照できない。

## 5. 踏襲すべき既存挙動

後続 Phase は章別仕様に明記されていない既存挙動を無効化しない。

- ChatRAG follow-up 質問時の retrieval 軽量化。
- RequiredFact planning の汎化と、特定語彙 rule への依存除去。
- policy computation gate の汎化。
- API coverage 閾値、`verify-answer-support`、`repair-supported-only`、citation validation、answerability / sufficient context gate の現行拒否挙動。
- RAG node の minScore filter、diversity 制約、context budget、retrieval evaluator の trace / diagnostic 情報。
- `chatrag-refusal-bench-fix` で確定した拒否挙動と benchmark 期待値。
- S3 Vectors metadata budget、embedding dimension、ingest Lambda timeout、heavy API Lambda quota。
- debug panel の現表示項目、debug trace 権限境界、artifact redaction の既存制約。
- benchmark corpus seed isolation、dataset 固有値を実装分岐へ入れない運用。
- public endpoint は `/health` と `/openapi.json` に限定する現行境界。
- protected route では `x-memorag-authorization` metadata と実行時 permission check の両方を維持する。
- `CHAT_USER`、`RAG_GROUP_MANAGER`、`BENCHMARK_RUNNER`、`BENCHMARK_OPERATOR`、`SYSTEM_ADMIN` の現行 permission 差分。
- debug trace は `chat:admin:read_all` 境界を維持し、SSE は所有者または admin read-all 境界を維持する。
- benchmark runner は query/search と seed corpus に限定し、通常 `/search` や run 管理を許可しない。
- document group / personal / chat temporary / benchmark seed scope の ACL と、chat attachment の `temporaryScopeId` 必須条件。
- search の ACL filtering、active lifecycle filtering、expired temporary document exclusion、metadata sanitize。
- document summary response で `vectorKeys`、`chunks`、`sourceObjectKey` を返さない契約。

## 6. 後続タスクへの発注前提

### A1-docs-spec-canonical

- `docs/spec/2026-chapter-spec.md` に章別仕様書を canonical コピーする。
- `docs/spec/README.md` を追加し、参照元、章 ID の扱い、canonical / derived docs の関係を明記する。
- `.workspace/` は未追跡入力であり、PR には `docs/spec/` 配下の canonical コピーのみを含める。
- 仕様全文は巨大なため、コピー後は `git diff --check` と docs 参照リンク確認を必須にする。

### A2-chapter-to-req-map

- `docs/spec/CHAPTER_TO_REQ_MAP.md` を作成し、全章 ID を少なくとも 1 行ずつ map に出す。
- 既存 FR-001..FR-048、NFR、spec-recovery matrix、主要実装ファイルへの対応を `confirmed` / `inferred` / `missing` で区別する。
- 新規 REQ 雛形は `status: planning` とし、4B / 4C / 6A / 16-20 / 14B / 14C / 14D を優先する。
- 既存 FR 番号は renumber しない。

### A3-cleanup-stale-mvp-dir

- 元 worktree の未追跡 `memorag-bedrock-mvp/` は root lift 後の残骸として扱う。ただし、本 worktree には存在しないため、A3 では実在確認と削除・ignore・維持の decision を分ける。
- `タスク種別: 修正` になるため、`skills/nazenaze-analysis/SKILL.md` に基づく原因分析を task md に含める。
- 未追跡ディレクトリ削除は破壊的操作に近いため、削除する場合はユーザー確認を得る。

## 7. 検証方針

- 本タスクの最小検証は `python3 scripts/validate_spec_recovery.py docs/spec-recovery` と `git diff --check`。
- A1 では仕様全文追加に対して Markdown の末尾空白と大容量差分を確認する。
- A2 では `scripts/validate_spec_recovery.py` に加えて、章 ID が map に全て出現することを機械的に確認する補助コマンドを検討する。
- A3 では対象が未追跡物であるため、`git status --short` と `git clean -nd` 相当の dry-run 確認を必須にする。

## 8. open questions

- `docs/spec/2026-chapter-spec.md` は仕様全文をそのまま保持するか、章ごとに分割するか。Phase A 計画では単一ファイルを指定しているため、A1 では単一ファイルを正とし、分割は後続改善候補にする。
- `docs/spec/CHAPTER_TO_REQ_MAP.md` の粒度は章単位で開始し、必要に応じて節単位へ拡張する。初回 A2 では全章網羅を優先する。
- 仕様 2 章の folder と現実装 document group の差異は Phase B 以降の認可・resource permission 設計に影響するため、A2 では divergent として残し、実装判断は B-pre に委譲する。
