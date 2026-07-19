# Issue #358 FR-019 faithfulness / context relevance pipeline 作業完了レポート

- 作業日時: 2026-07-17 13:46–14:22 JST
- Issue: https://github.com/tsuji-tomonori/rag-assist/issues/358
- Draft stacked PR: https://github.com/tsuji-tomonori/rag-assist/pull/411
- stacked base: PR #406 / `codex/issue-358-sq012-false-refusal-rate`
- implementation commit: `a239bc93`

## 受けた指示

Issue #345、#358、#359 を並列委譲しながら、完了条件を満たす bounded unit を止めずに実装・検証・Draft PR lifecycle まで進める。merge、deploy、release は行わない。

本 unit は Issue #358 P1-B の FR-019 / SQ-001 / SQ-010 を対象とし、benchmark の faithfulness / context relevance を summary、report、case artifact、run metrics、production observation producer まで根拠付きで伝播する。

## 要件整理

- faithfulness は answer support が評価した文の supported / evaluated micro-rate とする。
- context relevance は expected file/document がある行について raw retrieved item の relevant / evaluated micro-rate とする。
- evidence 不足、期待識別子なし、分母0、invalid count、self-reported-only aggregate は unavailable とする。
- versioned case artifact に再導出可能な分子・分母を保持する。
- context relevance は owner 承認済み signal catalog にないため required gate へ追加せず、producer source sample の diagnostic measurement とする。
- owner 未承認 threshold、実 benchmark 結果、actual AWS 結果を補完・推定しない。

## 検討・判断

- retrieval recall は期待根拠を1件以上回収できたか、context relevance は取得集合内のノイズ比率を見るため、同じ expected identifier を使いながら分母を分離した。
- faithfulness は row rate の単純平均ではなく supported sentence count / evaluated sentence count の micro 集約とした。
- run metrics は runner の aggregate 自己申告値を採用せず、schemaVersion 付き case artifact の count から再導出する fail-closed 境界にした。
- context relevance を既存 required signal catalog に無断追加すると promotion policy を変えるため、診断値として永続化・検証する設計を選んだ。
- shared schema / producer 変更で API code docs 61件に call graph、message、line number の canonical 波及が生じたため、正規 generator を実行し freshness check で検証した。

## 実施作業

- benchmark row evaluation、summary、turn dependency、Markdown report に両指標を追加。
- case artifact retrieval evidence に `relevantRetrievedCount` / `evaluatedRetrievedCount` を追加。
- contract schema で count pair、非負整数、relevant <= evaluated を検証。
- infra metrics updater で faithfulness / context relevance を versioned case evidence から再導出。
- API / web metrics type、API Zod schema、OpenAPI generated docs を同期。
- production RAG observation producer に `retrieval.context_relevance` diagnostic measurement を追加し、source sample validation を共通化。
- normal、null、zero denominator、invalid count、self-reported-only、producer propagation の tests を追加。
- FR-019 / SQ-001 / SQ-010 / DES-DLD-009、requirements coverage、API code generated docs を同期。
- Draft stacked PR #411、`semver:patch` label、日本語受け入れ条件コメント、日本語セルフレビューコメントを作成。

## 成果物

- runner: `benchmark/run.ts`, `benchmark/run.test.ts`
- case contract: `packages/contract/src/schemas/benchmark.ts`, `packages/contract/src/schemas/benchmark.test.ts`
- persistence: `infra/scripts/update-benchmark-run-metrics.mjs`, `infra/test/update-benchmark-run-metrics.test.ts`
- producer/API: `apps/api/src/rag/quality-control/production-rag-observation-producer.ts` ほか schema/type/test
- canonical docs: `REQ_FUNCTIONAL_019.md`, `REQ_SERVICE_QUALITY_001.md`, `REQ_SERVICE_QUALITY_010.md`, `DES_DLD_009.md`
- generated docs: OpenAPI 4件、API code docs 61件
- task: `tasks/done/20260717-1346-issue-358-fr019-context-quality.md`

## 検証結果

- `npm run ci`: 成功。
  - API 803/803
  - web 442/442
  - infra 88/88
  - benchmark 106/106
  - contract 2/2
  - 全 workspace lint / typecheck / build 成功
- `task docs:check`: 成功（97 APIs / 582 API documents、OpenAPI、canonical docs、web/infra inventory）。
- targeted benchmark runner / infra updater / producer / schema tests: 成功。
- requirements coverage: 成功。
- release source audit: 成功（audit `sha256:102b03a5a6b77c7c167745fac2fe679e6fd574ed777309260f4f673e5b2201a7`、dataset-specific branch 0、artifact mismatch 0）。
- changed-files pre-commit、`git diff --check`: 成功。
- implementation-head GitHub Actions: 成功（8分9秒）。promotion gate skip は Draft/非 candidate 条件どおり。
- pre-commit `--all-files` 初回は無関係な既存レポートの trailing whitespace を自動修正して exit 1。自動変更を正確に戻し、changed-files 実行を再実施して成功。

## 指示への fit 評価

- runner から producer source sample までの versioned evidence 伝播: 適合。
- evidence 不足・invalid を fail closed にする要件: 適合。
- 未承認 threshold / gate を追加しない要件: 適合。
- docs と実装、変更範囲に見合う test、RAG 根拠性・認可境界、dataset 固有分岐禁止: セルフレビューで blocking 指摘なし。
- Worktree Task PR Flow: implementation commit、Draft stacked PR、semver、AC/self-review、report/task lifecycle まで実施。final-head 外部 gate は lifecycle commit 後に確認する。

## 未対応・制約・リスク

- 実 benchmark、owner threshold approval、actual AWS は未実施。
- context relevance を required quality signal / promotion gate に昇格する場合は、owner approval、signal catalog versioning、threshold 根拠が別途必要。
- PR #411 は PR #406 への stacked dependency を持つ。
- lifecycle commit 後の final-head GitHub Actions、Issue #358 進捗コメント、clean/upstream は本レポート作成時点では pending。結果は PR / Issue top-level comment に記録する。
- web build の既知の 500 kB chunk warning は残るが、本 unit の UI runtime 差分ではない。
- GitHub Apps はこの環境で利用できず、GitHub 操作は `gh` fallback を使用した。
- merge、deploy、release は実施していない。
