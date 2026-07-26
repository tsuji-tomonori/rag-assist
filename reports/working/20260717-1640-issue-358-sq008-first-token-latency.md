# Issue #358 SQ-008 first-token latency 作業完了レポート

## 1. 受けた指示

Issue #358 の残存項目を bounded unit に分け、専用 worktree / task md / 実装 / 検証 / Draft stacked PR / 日本語コメント / lifecycle まで完遂する。merge、deploy、release は行わない。

## 2. 要件整理

- first-token を completion latency で代用せず、authoritative output event と同一 monotonic clock で測定する。
- 現行 buffered API の制約から client-visible TTFT と model first-content latency を区別する。
- evidence を case/summary/run metrics/observation へ伝播し、missing/invalid/retry/partial を fail closed にする。
- owner 未承認 threshold を promotion gate に追加しない。

## 3. 検討・判断

- 計測境界は `chat_orchestration_ingress` → `answer_model_first_content_delta`、clock は `node_performance`、unit は ms、`clientVisible: false` と定義した。
- first-token callback が必要な final answer/repair のみ Bedrock streaming を使い、従来呼び出しは `ConverseCommand` を維持した。
- 失敗 attempt の delta は保存せず、非空 result まで成功した最新 attempt だけを採用した。
- 計測不能は `not_applicable` / `unavailable` で保持し、0ms へ変換しない。

## 4. 実施作業

- Bedrock adapter の first non-empty delta / empty / partial error 処理。
- chat response/debug trace の versioned first-token evidence と trace sanitizer 対応。
- benchmark case artifact / summary / report の p50/p95/p99/sample count、DynamoDB run metrics updater、production observation diagnostic を追加。
- normal/non-answer/retry/invalid lineage/aggregation/producer の test を追加。
- SQ-008 / FR-019 / FR-048 / DLD / OPS と generated OpenAPI/API-code docs を同期。
- Draft stacked PR #417 を #413 head base で作成し、`semver:patch`、受け入れ条件、セルフレビューを記録。

## 5. 検証結果

- 対象 contract/API/benchmark/infra test: 成功。
- `npm run ci`: 成功（retry 直接 test 追加前の full suite）。追加後の lint / API typecheck / retry test も成功。
- `task docs:check`: 最終 source からの再生成後に成功（97 APIs / 582 documents）。
- release source audit: 成功。`sha256:cf7055a1bbf1521f1cfb8ce098c12587f23eb73cd1cf578960bb737ea76ca60b`。
- staged-only `pre-commit run`、`git diff --check`: 成功。
- 初回 CI `29562687610`: retry test 追加後の source-backed docs が stale で失敗。最終 source から 13 generated docs を再生成した。
- 修復後 implementation CI `29563416683`: 全 step 成功。
- lifecycle final-head CI: lifecycle commit/push 後に確認する external gate。

## 6. 成果物

- Draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/417
- task: `tasks/done/20260717-1540-issue-358-sq008-first-token-latency.md`
- 本レポート: `reports/working/20260717-1640-issue-358-sq008-first-token-latency.md`

## 7. 指示への fit 評価

- 実装・テスト・docs・Draft PR・semver・日本語 AC/セルフレビューまで実施し、SQ-008 の測定根拠経路に fit した。
- 実施していない actual AWS や client-visible TTFT を実施済みと書かず、境界を schema/docs/comment で固定した。
- GitHub Apps コネクタを利用できないため `gh` fallback を使い、理由を PR に明記した。

## 8. 未対応・制約・リスク

- 実 Bedrock streaming、実 benchmark、actual AWS、実負荷 percentile は未検証。
- client-visible TTFT は response streaming 導入後の別要件。本 diagnostic 値を UX SLO として扱わない。
- owner 承認 threshold がないため promotion 必須 gate は未設定。
- merge / deploy / release は未実施。
