# Benchmark performance improvement

- 状態: do
- 作成日時: 2026-05-06 20:45 JST
- ブランチ: `codex/benchmark-performance-improvement`

## 背景

`.workspace/bench_20260506T113255Z_ffd4521c` の benchmark 結果で、QA benchmark の answerable accuracy が 70.0% に留まり、answer-only dataset で false refusal が発生している。search benchmark の raw JSONL でも recall miss が確認されている。

## 目的

RAG の根拠性と認可境界を保ちながら、社内ハンドブック benchmark の誤拒否と検索 recall miss を改善する。

## スコープ

- `memorag-bedrock-mvp/apps/api/src/agent` の回答可否・検索評価 heuristic
- `memorag-bedrock-mvp/apps/api/src/search` の検索 recall に関係する範囲
- 必要な API unit tests / benchmark tests
- 必要最小限の docs / work report

## 非スコープ

- UI 変更
- API contract 変更
- 認証・認可 route 追加
- 新規 LLM call の追加

## 受け入れ条件

- QA benchmark の誤拒否が減り、`answerable_accuracy` が改善する。
- answer-only dataset での `refusal_precision` 低下要因である false refusal を減らす。
- search benchmark の recall miss 原因を特定し、実装または fixture 側の必要最小限の修正を行う。
- 追加 LLM call を増やさず、レイテンシ悪化リスクを抑える。
- 変更範囲に見合う targeted test と benchmark を実行し、失敗があれば修正して再実行する。
- 実施していない検証は PR 本文、PR コメント、作業レポートで実施済み扱いしない。
- PR 作成後に受け入れ条件確認コメントとセルフレビューコメントを日本語で記載する。

## 計画

1. benchmark 結果と現行 RAG path の失敗箇所を特定する。
2. 回答可否 gate と retrieval evaluator の deterministic heuristic を改善する。
3. search benchmark の 0 hit 原因を確認して必要最小限で修正する。
4. targeted tests と benchmark を実行して、失敗時は修正する。
5. 作業レポートを残し、commit、push、PR、PR コメントまで完了する。

## ドキュメント保守方針

API contract や運用手順は変更しない想定。RAG 挙動の恒久仕様に影響する場合のみ `memorag-bedrock-mvp/docs` の関連要求・設計 docs 更新を検討する。実装改善の記録は `reports/working/` に残す。

## 検証計画

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`
- benchmark rerun: QA sample と search sample の実行可能な範囲

## PR レビュー観点

- docs と実装の同期
- 変更範囲に見合うテスト
- RAG の根拠性・認可境界を弱めていないこと
- benchmark 指標と latency の悪化がないこと

## リスク

- heuristic を緩めすぎると unsupported answer が増える。
- benchmark fixture の問題と production path の問題を混同すると、実運用品質に寄与しない変更になる。
- 外部 API benchmark は認証・ネットワーク・AWS 状態に依存するため、ローカルで同等再現できない場合がある。
