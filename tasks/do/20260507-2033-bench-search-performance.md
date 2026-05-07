# Search benchmark 性能改善

## 背景

`.workspace/bench_20260507T111644Z_d3579f01` の search benchmark で、`search-expense-001` が `48806ms`、`search-alias-001` が HTTP 500 となり、p95 latency と errorRate が悪化している。

## 目的

benchmark search の cold latency、alias query の 500、benchmark corpus の混入疑いを調査し、検索品質・ACL 境界を維持したまま改善する。

## 範囲

- `memorag-bedrock-mvp` の API search / benchmark search 周辺
- benchmark corpus seed / search runner の必要最小限のテスト
- 関連する運用ドキュメントは、挙動や設定説明が変わる場合のみ更新する

## 計画

1. 既存ベンチ結果と search 実装を確認する。
2. cold index / corpus isolation / alias 500 の原因を絞り込む。
3. scoped patch を実装する。
4. API / benchmark の targeted test と `git diff --check` を実行する。
5. 作業レポート、commit、push、PR、受け入れ条件コメントを完了する。

## Documentation Maintenance Plan

- API の外部仕様を変えない場合、`docs/` 更新は不要とする。
- 運用設定や benchmark 実行手順を変える場合のみ、該当 docs を更新する。

## 受け入れ条件

- `search-alias-001` 相当の alias query が HTTP 200 で `handbook.md` を topK 内に返す。
- benchmark corpus seed 後の search が `source=benchmark-runner` / `docType=benchmark-corpus` の対象に限定され、過去 corpus chunk の混入を抑止する。
- cold search の主要 latency 要因を削減または明確に診断できるようにする。
- ACL negative search で forbidden document が返らない。
- 変更範囲に見合う API / benchmark の targeted test と `git diff --check` が pass する。
- 未実施の検証がある場合、PR 本文・作業レポート・最終回答で実施済み扱いにしない。

## Validation Plan

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/search/hybrid-search.test.ts`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/contract/api-contract.test.ts`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark -- search-run.test.ts corpus.test.ts`
- `git diff --check`

## PR Review Points

- docs と実装の同期が必要な変更か。
- benchmark 固有値の過剰な hard-code がないか。
- RAG の根拠性・認可境界を弱めていないか。
- dataset 固有分岐を production search に入れていないか。

## リスク

- prod benchmark の 48.8s は AWS/S3/ObjectStore の外部状態も影響しうるため、local test だけでは完全再現できない可能性がある。
- 既存の別 worktree で関連変更が進んでいる場合、PR merge 時に conflict が発生する可能性がある。

## 状態

in_progress
