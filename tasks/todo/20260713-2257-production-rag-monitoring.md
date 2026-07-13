# 本番 RAG 品質・安全監視 control loop の実装

- 状態: todo
- タスク種別: 運用・RAG 実装
- 作成日: 2026-07-13
- 関連要件・gap: `FR-089`, `FR-093`, `SQ-008`, `SQ-012`–`SQ-015`, `GAP-RD-024`

## 背景

trace と benchmark は存在するが、本番 stage/slice 別の品質・安全 drift、SLO alert、safe action を連動させる control loop は未実装である。

## 目的と範囲

機微情報を記録せずに retrieval/generation/citation/refusal の stage・業務 slice 指標、drift、latency、availability、cost を観測し、承認済みの安全な degradation/recovery action へ接続する。

## 受け入れ条件

- [ ] 指標に version、stage、slice、sample window、欠損状態を持たせる。
- [ ] 未承認閾値を正常値として扱わず、alert の根拠と owner を記録する。
- [ ] alert から trace/benchmark/deploy へ相関でき、safe action は監査可能である。
- [ ] drift、partial outage、cost spike、false alert の test/演習を追加する。

## 検証・文書

- metric/alert/CDK test、production-profile benchmark、運用演習を実行する。
- `OPS_MONITORING_001` と該当要求を実装に同期する。

## リスク

品質、latency、availability、cost の合格値は `OQ-RD-005`, `OQ-RD-006` の承認後に確定する。
