# Issue #358 要件 evidence・coverage 同期

- 状態: done
- タスク種別: 要件文書・coverage 是正
- 対象 Issue: `#358`
- 対象要件: `FR-018`, `FR-020`, `FR-024`, `FR-053`, `FR-054`, `FR-055`, `FR-088`, `NFR-012`
- 開始日: 2026-07-16
- ベース: PR #369 head `a1291e239448546ee236c09492be3bbbb29f3930`
- stack 順序: PR #365 → PR #369 → 本 PR

## 背景と問題文

要件文書の状態、受け入れ条件、実装参照と `requirements-coverage.test.ts` の参照が、現在の source/test/CI と一致していない。存在しないファイル、既に置換された挙動、実装と直接矛盾する UI scope、代表検査しかないのに全量検査済みと読める記載、直接 test がないのに test coverage があるように見える参照を是正する。

本タスクでは production 実装を変更せず、現行実装と要件・coverage の事実を同期する。evidence gap は、既存挙動を直接検証する test の追加、または検証可能な受け入れ条件を持つ後続 todo によって可視化する。

## なぜなぜ分析

### 観測事実

- 要件 coverage は、旧要件 ID について参照 path の存在だけを検査し、参照先が受け入れ条件を実質的に検証するかを確認しない。
- 要件文書は実装変更後に symbol/test behavior を再確認せず、古い file 名や過去の制約を保持している。
- `planning` / unchecked のまま実装・CI evidence が追加された要件と、実装があっても直接 test が不足する要件が混在している。

### root cause

根本原因は、要件状態・受け入れ条件・coverage 参照を「path が存在すること」と「要求挙動を直接検証すること」に分けて管理しておらず、実装変更時の evidence reconciliation が自動化されていないことである。

### 流出・検知遅れ

- path-only coverage が stale/indirect reference を pass させた。
- line number や旧ファイル名中心の trace が symbol 移動に追随しなかった。
- acceptance checkbox を evidence 単位で更新する運用がなく、実装済みと未検証が区別されなかった。

## 対象別 evidence 判定

### FR-018

- `confirmed`: `rrfFuse` が複数 result list を RRF 統合し、hybrid retrieval と request-time search evidence から利用される。重複加点、独立 hit 保持、`k` と weight の test がある。
- `conflict`: 文書の `rank-fusion.ts` は存在せず、max-score merge を現状とする説明は stale。
- `inferred`: なし。
- `open_question`: なし。

### FR-020

- `confirmed`: `MemoRagService.createMemoryCards` と section/concept helper は document/section/concept card と raw chunk 参照 metadata を生成する。
- `conflict`: 変更前 coverage の `memorag-service.test.ts` は object key の存在、`adapters/local-stores.test.ts` は generic memory vector を確認するだけで、多抽象度生成・drilldown・metadata 保存を直接検証しない。
- `inferred`: 現状説明は旧 chunk/document 中心実装から更新されていない。
- `open_question`: 変更前時点では直接回帰 test が不足。専用 `multi-abstraction-memory.test.ts` を追加し、public ingest から三抽象度、raw trace、metadata を検証して解消する。

### FR-024

- `confirmed`: `AdminWorkspace` は permission に応じて users、roles、usage/cost、audit を表示し、user mutation と role assignment を受け付ける。
- `conflict`: AC-FR024-006 の「表示しない」対象と現行 product UI が直接矛盾する。Issue #358 は Phase 2 管理パネル常設を正規契約とする決定を含む。
- `inferred`: なし。
- `open_question`: なし。users/roles/usage-cost/audit/mutation と permission/API enforcement を原子的な現行契約へ改訂する。

### FR-053

- `confirmed`: runtime OpenAPI、派生 Markdown freshness、docs quality、lifecycle metadata、代表 oRPC mapping、CI gate は実装・test がある。
- `conflict`: なし。
- `inferred`: 代表 mapping は drift gate の基礎として有効だが、全 REST/oRPC schema equivalence を意味しない。
- `open_question`: 全量 drift、breaking-change 承認、lifecycle registry は未実装。

### FR-054

- `confirmed`: deploy workflow は OIDC、GitHub environment、CDK test/synth、CloudFormation/cdk-nag artifact、deploy outputs を扱う。
- `conflict`: AC が要求する deploy smoke test は workflow にない。
- `inferred`: repository に長期 AWS access key は見当たらないが、GitHub environment の approval rule と secret 実体は repository source だけでは確定できない。
- `open_question`: smoke 実装と external GitHub setting evidence が必要。

### FR-055

- `confirmed`: public/protected endpoint、CORS、chat/ingest SSE `Last-Event-ID`、chat/ingest worker `runId`、benchmark run lifecycle の evidence がある。
- `conflict`: なし。
- `inferred`: async agent の `agentRunId` lifecycle は同じ追跡目的を持つが、共通 worker handler の `runId` 契約とは同一ではない。
- `open_question`: chat/ingest/benchmark/async-agent を横断する共通 worker contract の範囲と test が必要。

### NFR-012

- `confirmed`: `sanitizeAuthorizedResourceMetadata` が reader/benchmark audience 別 allowlist を中央管理し、security policy metadata を除外する test がある。
- `conflict`: 文書の固定 allowlist は `tenantId` を含み、drawing/group metadata を欠くため現行実装と不一致。`tenantId` は公開 metadata から意図的に除外される。
- `inferred`: allowlist は検索 filter と response disclosure で責務が異なるため、公開 response policy を source of truth とする。
- `open_question`: なし。

### FR-088

- `confirmed`: persistence 前と view/download 時の sanitizer、unit test、service integration test がある。
- `conflict`: 文書の confidence が `inferred`、実装適合が `confirmed` で内部不整合。coverage は service integration test を参照しない。
- `inferred`: なし。
- `open_question`: なし。

## PR #366 overlap 確認

GitHub Apps で PR #366 の changed filenames と patch を確認した。`requirements-coverage.test.ts` の変更対象は `FR-045` / `SQ-003` であり、本タスクの対象 key と重複しない。production RAG 実装、benchmark、Web/UI は本タスクで変更しない。

## スコープ

### 対象

- 対象 8 要件の状態、checkbox、実装適合、trace、変更履歴の事実同期
- `apps/api/src/rag/requirements-coverage.test.ts` の実在かつ実質的な参照への更新
- 未実装・未検証 gap の acceptance-driven todo 化
- docs/coverage の検証と作業レポート

### 対象外

- TC003、benchmark、Web/UI、`MemoRagService` body の変更
- PR #338 / #339 の変更 path
- API schema、production behavior、merge、deploy、release

## 受け入れ条件 / Done 条件

- [x] 8 要件の現状判定が `confirmed / inferred / conflict / open_question` を区別して記録される。
- [x] FR-018 の RRF trace が実在 symbol と test behavior を参照し、存在しない `rank-fusion.ts` を参照しない。
- [x] FR-020 の path-only coverage を public ingest の直接 behavior test に差し替え、三抽象度、raw trace、metadata を検証する。
- [x] FR-024 AC-006 の conflict を隠さず、Issue #358 で決定済みの Phase 2 管理パネルと permission/API enforcement を現行正規契約にする。
- [x] FR-053/054/055 の状態と checkbox が current source/test/CI evidence と一致する。
- [x] NFR-012 の metadata allowlist が中央 sanitizer の current policy と一致する。
- [x] FR-088 の confidence と coverage が sanitizer unit/service integration evidence と一致する。
- [x] PR #366 の `FR-045` coverage hunk と重複しない。
- [x] 不足実装・test は検証可能な後続 todo に分離される。
- [x] docs check、targeted requirements coverage、変更範囲に見合う API validation が pass する。未実施は理由を記録する。
- [ ] PR、受け入れ条件コメント、セルフレビュー、task done 移動、作業レポート、最終 CI 確認まで完了する。
  - PR、2コメント、task done 移動、作業レポートは完了。final-head CI は本 task/report commit の push 後に確認する。

## 検証計画

- 変更前後の source/test/workflow symbol と test name を `rg` で照合する。
- `requirements-coverage.test.ts` を API workspace で実行する。
- docs command の展開内容を確認し、docs check を実行する。
- 要件 coverage を含む API test、typecheck、必要に応じ build を実行する。
- `git diff --check` と changed-files に対する pre-commit を実行する。
- `scripts/validate_spec_recovery.py` は base に存在せず、specification recovery 成果物を変更しないため適用不可。未実施理由を report に残す。

## ドキュメント影響

- canonical atomic requirements と coverage のみを更新する。
- API contract/behavior は不変のため README と OpenAPI は更新しない。新しい ingest の direct test は source-backed generated API docs の単体テスト trace に含まれるため、公式 generator で該当 generated docs と manifest を更新する。
- specification recovery 成果物は作成しない。

## 完了 evidence

- 実装・文書 commit: `985b5705`
- draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/375
- 受け入れ条件コメント: https://github.com/tsuji-tomonori/rag-assist/pull/375#issuecomment-4992583700
- セルフレビュー: https://github.com/tsuji-tomonori/rag-assist/pull/375#issuecomment-4992586524
- implementation head CI: https://github.com/tsuji-tomonori/rag-assist/actions/runs/29502596156 （success、API/Web coverage・build・CDK synth を含む）
- final head CI は本 task/report の完了 commit を push 後に確認し、結果を PR top-level comment に記録する。
