# current eligible RAG retrieval の実装

- 状態: todo
- タスク種別: RAG・セキュリティ実装
- 作成日: 2026-07-13
- 関連要件・gap: `FR-067`–`FR-070`, `SQ-005`, `GAP-RD-009`, `GAP-RD-010`, `GAP-RD-012`

## 背景

semantic retrieval は有限件取得後に権限を filter し、memory/context expansion は current permission を一貫して再確認しない。欠損 quality metadata へ安全でない既定値を補う経路もある。

## 目的と範囲

全 retrieval/memory/context 経路で current tenant/resource permission と classification/usage/quality eligibility を fail closed に評価し、post-filter underfill と side channel を抑える。

## 受け入れ条件

- [ ] lexical、semantic、memory、context expansion が同じ current eligibility policy を使う。
- [ ] metadata 欠損、権限剥奪、削除、index 切替時に候補を採用しない。
- [ ] unauthorized candidate の有無を count、latency、error から推定しにくい契約を持つ。
- [ ] mixed-authority、underfill、stale cache/index の否定 benchmark/test を追加する。

## 検証・文書

- RAG retrieval/authorization/cache test とセキュリティ benchmark を実行する。
- retrieval/data design、`FR-067`–`FR-070`, `SQ-005` を更新する。

## リスク

filter 戦略は recall/latency と競合するため、未承認の品質・性能閾値を hardcode しない。
