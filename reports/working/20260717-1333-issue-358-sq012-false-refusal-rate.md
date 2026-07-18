# Issue #358 SQ-012 false refusal rate 作業完了レポート

- 日時: 2026-07-17 13:33 JST
- Issue: https://github.com/tsuji-tomonori/rag-assist/issues/358
- Draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/406
- branch: `codex/issue-358-sq012-false-refusal-rate`
- implementation commit: `f6c2672a`
- 対象 task: `tasks/done/20260717-1150-issue-358-sq012-false-refusal-rate.md`

## 受けた指示

Issue #358 を段階的な独立作業単位で前進させ、worktree/task/commit/Draft PR、日本語の受け入れ条件確認とセルフレビュー、検証、Issue 進捗まで完遂する。merge、deploy、release は行わない。

## 要件整理

- `falseRefusalRate` は answerable 行のうち実際に refusal を返した割合とする。
- answerable 行が0件なら `null` / `not_applicable` とし、0%やpassへ誤変換しない。
- Markdown report は値だけでなく分子・分母と評価状態を表示する。
- owner 未承認の既定 threshold は追加せず、明示 threshold がある場合だけ lower-is-better 回帰判定へ使う。
- versioned case artifact 由来の既存 persistence / API / production observation 経路、RAG 根拠性、認可境界を後退させない。

## 検討・判断

調査前は runner から persistence / API まで未伝播と想定したが、`infra/scripts/update-benchmark-run-metrics.mjs`、shared schema/type、production observation producer には既に case artifact から導出する安全な経路があった。このため aggregate summary を無条件に信頼する変更は避け、runner summary/report の欠落を補い、既存導出をテストで保持した。

品質閾値は owner 未承認のため default profile へ推測値を追加しなかった。generic regression detector が explicit threshold を受けた場合に増加を検出し、値が `null` なら判定しない契約を直接テストした。

## 実施作業

- benchmark summary と turn dependency metrics に `falseRefusalRate` を追加。
- `answerable refusals / answerable rows` を集約し、分母0で `null` を返す契約を追加。
- Markdown report に `false_refusal_rate`、分子・分母、evaluated / not_applicable、説明を追加。
- turn dependency Markdown 表の列数を揃え、列契約の回帰 assertion を追加。
- 0%、100%、分母0、turn dependency、explicit threshold / null のテストを追加。
- persistence script と production producer の既存テストを再実行。
- `SQ-012`、`FR-019`、`DES_DLD_009`、requirements coverage を同期。
- Draft PR #406、`semver:patch`、日本語 AC/self-review comment を作成。

## 検証結果

- `npm test -w @memorag-mvp/benchmark`: 104/104 成功（修正後再実行を含む）。
- API producer / requirements coverage targeted test: 2/2 成功。
- `node --import tsx --test infra/test/update-benchmark-run-metrics.test.ts`: 成功。
- `npm run lint`: 成功。
- benchmark build / API build: 成功。
- `task docs:check`: 成功。
- `npm run rag:release:source-audit`: dataset 固有分岐 0、artifact manifest mismatch 0。
- `pre-commit run`: 全対象 hook 成功。
- `git diff --check`: 成功。
- implementation-head GitHub Actions: 主 CI 成功（8分8秒）、semver validation 成功、明示 RAG candidate promotion gate は通常 PR のため skip。

初回の benchmark 全件直接実行はリポジトリ直下を cwd にしたため fixture 相対パス 1 件が失敗し、API coverage 直接実行も同じく workspace cwd 不一致で失敗した。いずれも製品変更ではなく実行基準の誤りで、正規 workspace script / workspace cwd から再実行して成功を確認した。

## 成果物

- `benchmark/run.ts`
- `benchmark/run.test.ts`
- `benchmark/metrics/quality.test.ts`
- `apps/api/src/rag/requirements-coverage.test.ts`
- `REQ_SERVICE_QUALITY_012.md`
- `REQ_FUNCTIONAL_019.md`
- `DES_DLD_009.md`
- `tasks/done/20260717-1150-issue-358-sq012-false-refusal-rate.md`
- Draft PR #406 と日本語 evidence comments

## 指示への fit 評価

独立した SQ-012 作業単位として実装、テスト、正規 docs、coverage、commit、Draft PR、semver、AC/self-review、implementation-head CI まで揃えた。production runtime に benchmark 期待語句、QA sample 固有値、dataset 固有分岐を追加せず、認可経路も変更していない。No Mock Product UI は UI 変更なしのため非該当。

## 未対応・制約・リスク

- 実環境 benchmark は未実施。実データでの false refusal rate は未確定。
- SQ-012 の許容 threshold は owner 未承認。既定値や pass 判定を追加していない。
- GitHub Apps connector が利用できず、GitHub 操作は `gh` fallback を使用した。
- lifecycle commit 後の final-head CI、Issue #358 進捗 comment、clean/upstream 確認は本レポート commit 後に行う。
- merge、deploy、release は実施しない。
