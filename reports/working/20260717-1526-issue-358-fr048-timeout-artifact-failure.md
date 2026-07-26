# Issue #358 FR-048 timeout / artifact failure state model 作業完了レポート

- 作業日時: 2026-07-17 14:35–15:26 JST
- Issue: https://github.com/tsuji-tomonori/rag-assist/issues/358
- Draft stacked PR: https://github.com/tsuji-tomonori/rag-assist/pull/413
- stacked base: PR #411 / `codex/issue-358-fr019-context-quality`
- implementation commit: `b74b5861`

## 受けた指示

Issue #345、#358、#359 を並列委譲しながら、完了条件を満たす bounded unit を止めずに実装・検証・Draft PR lifecycle まで進める。merge、deploy、release は行わない。

本 unit は Issue #358 P1-B の FR-048 を対象とし、benchmark run の timeout と artifact 単位の生成・保存失敗を versioned explicit state として runner persistence、API、quality observation、Web へ伝播し、成功・ゼロ値・quality gate pass への誤変換を拒否する。

## 要件整理

- `timed_out` を独立した terminal run status とし、active / cancelable と誤認しない。
- required artifact 4件を `available` / `generation_failed` / `upload_failed` と safe reason で識別する。
- 欠損 artifact を空ファイルや擬似 summary で成功 artifact に補完しない。
- run success と metrics update は artifact integrity complete の場合だけ許可する。
- partial failure は成功済み artifact を失わず、失敗 artifact と unavailable quality metrics を明示する。
- invalid、legacy incomplete、self-reported-only evidence は fail closed にする。
- tenant-scoped physical key、durable commit authorization、revocation cleanup、terminal state の競合境界を後退させない。

## 検討・判断

- run status だけでは failed build 中に生成済み artifact を区別できないため、`schemaVersion: 1` の `artifactIntegrity` を run に追加した。
- artifact summary は exact required kinds、count、status、failure reason の整合性を Zod refinement で検証し、曖昧な state を受理しない設計にした。
- CodeBuild post-build の placeholder 生成を廃止し、実ファイルだけを authorization 後に upload して結果を永続化する。integrity updater が non-complete または build failing を検出すると失敗終了し、metrics updater へ進ませない。
- Step Functions の CodeBuild project timeout、task timeout、state machine timeout を分離し、task failure cause の `States.Timeout` / `TIMED_OUT` を `timed_out` へ分類する。
- quality producer は run succeeded かつ integrity complete の場合だけ versioned benchmark metrics を利用し、timeout / artifact failure は diagnostic count として保持する。
- Web は API 状態由来の生成中・生成済み・生成失敗・保存失敗・未生成を accessible name と可視 label に使い、架空 fallback を追加しない。
- shared service 行追加に伴い API-code 生成文書へ機械的な行番号波及が生じたため、正規 generator を実行し freshness check で検証した。

## 実施作業

- API/domain/Web の benchmark run status に `timed_out` を追加。
- artifact kind/status/integrity の domain type と strict API schema、OpenAPI contract test を追加。
- benchmark run create/start-failure/cancel/download semantics を artifact state と同期。
- production RAG observation producer に artifact failure count / timeout diagnostic を追加し、incomplete evidence を unavailable にした。
- CodeBuild post-build を実 artifact の conditional upload と integrity persistence に変更し、空 placeholder を削除。
- tenant-scoped conditional DynamoDB updater と normal/partial/all-missing/invalid/retry test を追加。
- Step Functions に timeout classifier、running-only terminal update、complete-integrity success condition を追加。
- 性能テスト画面に artifact state label、partial failure download、timed-out terminal presentation を追加。
- FR-048 / FR-019 / SQ-001 / DES-DLD-009 / OPS-MONITORING-001、requirements coverage、generated docs を同期。
- Draft stacked PR #413、`semver:patch`、日本語受け入れ条件コメント、日本語セルフレビューを作成。

## 成果物

- API contract/service/producer: `apps/api/src/types.ts`, `apps/api/src/schemas.ts`, `apps/api/src/rag/memorag-service.ts`, `apps/api/src/rag/quality-control/production-rag-observation-producer.ts` と tests
- Web: `apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx`、status presentation / format / integration tests
- Infra: `infra/scripts/update-benchmark-run-artifacts.mjs`, `infra/lib/memorag-mvp-stack.ts` と behavior/snapshot tests
- canonical docs: `REQ_FUNCTIONAL_048.md`, `REQ_FUNCTIONAL_019.md`, `REQ_SERVICE_QUALITY_001.md`, `DES_DLD_009.md`, `OPS_MONITORING_001.md`
- generated docs: OpenAPI 4件、API-code docs、Web / infra inventory
- task: `tasks/done/20260717-1435-issue-358-fr048-timeout-artifact-failure.md`

## 検証結果

- selected tests: 成功。
  - API schema/service/producer
  - Web benchmark component/integration
  - infra artifact updater/stack/snapshot
- `npm run ci`: 成功。
  - API 805/805
  - Web 443/443
  - contract 2/2
  - infra / benchmark 全 test 成功
  - 全 workspace lint / typecheck / build 成功
- `task docs:check`: 成功（canonical structure、OpenAPI、97 APIs / 582 API documents、Web/infra inventory、hidden Unicode）。
- release source audit: 成功（audit `sha256:658d862721d7c9c2dd643f3a22caf3b80de9ed74515764cf9b6498a008e85b20`、dataset-specific branch 0、artifact mismatch 0）。
- changed-files / untracked-files pre-commit、`git diff --check`: 成功。
- implementation-head GitHub Actions: 成功（run 29559605805、main job 7分51秒）。promotion gate skip は Draft / 非 release candidate 条件どおり。
- 初回 full CI は Web 統合 test 2件が旧 accessible name を期待して失敗。新しい状態契約に test を修正し、Web 443件と full CI を再実行して成功した。
- pre-commit `--all-files` 初回は scope 外の既存レポートの trailing whitespace を自動修正して exit 1。変更を正確に戻し、changed/untracked files 対象で再実行して成功した。

## 指示への fit 評価

- timeout / artifact failure を explicit state として全層へ伝播する要件: 適合。
- incomplete evidence を success / zero / gate pass にしない要件: 適合。
- partial success artifact を保持し、失敗を正直に表示する要件: 適合。
- docs と実装、変更範囲に見合う test、RAG 根拠性、認可境界、dataset 固有分岐禁止: セルフレビューで blocking 指摘なし。
- No Mock Product UI: 画面値は API run status / artifact integrity / actual keys のみに由来し、demo fallback なし。
- Worktree Task PR Flow: implementation commit、Draft stacked PR、semver、AC/self-review、report/task lifecycle まで実施。final-head 外部 gate は lifecycle commit 後に確認する。

## 未対応・制約・リスク

- actual AWS、実 CodeBuild 3時間 timeout、実 benchmark、実 S3 upload failure / DynamoDB / Step Functions race は未実施。
- Web の実 browser zoom、screen reader、real device は未実施。本 unit では CSS/layout 自体を変更していない。
- PR #413 は PR #411 への stacked dependency を持つ。
- lifecycle commit 後の final-head GitHub Actions、Issue #358 進捗コメント、clean/upstream は本レポート作成時点では pending。結果は PR / Issue top-level comment に記録する。
- Web build の既知の 500 kB chunk warning は残るが、本 unit による新規 warning ではない。
- worktree の workspace symlink 解決のため `npm install --ignore-scripts` を実行した際、既存 dependency tree に npm audit 8件が表示された。依存関係は変更しておらず、本 unit の scope 外。
- GitHub Apps はこの環境で利用できず、GitHub 操作は `gh` fallback を使用した。
- merge、deploy、release は実施していない。
