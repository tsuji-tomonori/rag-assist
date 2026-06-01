# 作業完了レポート: chat UsageEvent 連携テスト補強

## 受けた指示

- `.workspace/plan-060101.txt` の継続として、UsageEvent / admin usage / cost audit 実装の完了条件に対する不足を確認し、実装・検証まで進める。

## 要件整理

- UT-CHAT-USAGE-001: completed chat で少なくとも `rag.generate_answer` の UsageEvent が保存される。
- UT-CHAT-USAGE-002: query rewrite / answerability / support verification を実行した場合、それぞれ別 feature の UsageEvent として保存される。
- UT-CHAT-USAGE-003: 同じ orchestration step retry で同じ idempotencyKey の UsageEvent を重複保存しない。

## 検討・判断

- `UsageTrackingTextModel` 単体テストでは task から feature への mapping と putOnce dedupe は確認済みだった。
- ただし chat orchestration 経由で実際に `generate_clues`、`sufficient_context_gate`、`generate_answer`、`verify_answer_support` の LLM 呼び出しが UsageEvent になることの直接証拠が不足していた。
- retry では状況により別 LLM step が追加実行され得るため、総 event 数固定ではなく idempotencyKey の重複なしを検証対象にした。

## 実施作業

- `asynchronous chat run stores debug trace by reference` test に UsageEvent assertion を追加した。
- completed chat run で `rag.query_rewrite`、`rag.answerability`、`rag.generate_answer`、`rag.support_verification` が保存されることを確認した。
- 同じ chat run 再実行後も LLM UsageEvent の idempotencyKey が重複しないことを確認した。

## 成果物

- Chat orchestration 経由の UsageEvent feature contract を service test で固定。
- Retry 時の UsageEvent idempotency contract を service test で固定。

## 検証

- `npm run typecheck -w @memorag-mvp/api`: pass
- `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts`: fail（event 数比較が過剰に厳しい）-> 修正後 pass（46 件）
- `git diff --check`: pass

## Fit 評価

- UT-CHAT-USAGE-001/002/003 の evidence を wrapper 単体から service 経由の実行パスへ広げた。
- 既存動作の別 step 追加を不具合扱いせず、idempotencyKey の重複抑止という要求に合わせて検証した。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 S3 への admin export 保存と署名付き URL の動作は未検証。
- PR 作成、PR コメント、task md の `tasks/done/` 移動は未実施。
- 現在の作業は既存 dirty worktree 上で継続しており、origin/main からの専用 worktree 作成フローは未完了。
