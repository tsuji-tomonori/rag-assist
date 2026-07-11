# SQ-013 業務タスク達成品質

- 要件ID: `SQ-013`
- 種別: `REQ_SERVICE_QUALITY`
- 状態: Draft（閾値未承認）
- 優先度: A

## 要件

- SQ-013: システムは、承認済み業務シナリオにおける task completion と、partial completion/handoff の正確さを、承認済み業務品質閾値内に保つこと。

## 品質尺度

- measure: complete、partial、failed、appropriate handoff の率と重大度。
- fail point/target: use case/role 別に `OQ-RD-005` で決定する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `SQ-013` |
| 説明 | end-to-end business task quality |
| 根拠 | 工程指標が良くても業務目的を達成しない候補を防ぐ |
| 源泉 | RAG ガイド §7.6（PDF pp.180–185） |
| Actor / trigger | business scenario evaluation |
| 種類 | サービス品質制約 / business outcome |
| 依存関係 | `SQ-009`–`SQ-012`, `FR-075` |
| 衝突 | 業務評価は責任者合意と人手判定を要し得る |
| 受け入れ基準 | `AC-SQ013-001`, `AC-SQ013-002` |
| 優先度 | A |
| 安定性 | Low |
| Confidence | inferred |
| 所有者 | Business owner / Product / QA |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-SQ013-001 task completion

- Given: actor、目的、成功条件、許容 handoff を注釈した approved scenario がある
- When: end-to-end candidate を評価する
- Then: task completion と適切な partial/handoff が approved fail point 以上である

### AC-SQ013-002 重大失敗

- Given: 誤った業務判断が高重大度に分類される scenario がある
- When: promotion gate を評価する
- Then: 全体 completion 平均で相殺せず、profile の重大度規則に従って不合格にする

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 工程指標を利用者価値へ接続する |
| 十分性 | OK | complete/partial/handoff と重大度を含む |
| 理解容易性 | OK | 技術 metric とは別の業務 outcome とした |
| 一貫性 | pending | scenario/threshold は業務責任者承認待ち |
| 標準・契約適合 | OK | 1 要求 1 business quality characteristic |
| 実現可能性 | OK | versioned scenario と rubric で評価可能 |
| 検証可能性 | OK | outcome label と reviewer agreement を測定できる |
| ニーズ適合 | OK | RAG が実際の利用目的を達成するかを判定する |
| 実装適合 | partial | 工程 metric はあるが業務 scenario gate は不足 |

## トレース

- 後方: RAG ガイド §7.6。
- 前方: business scenario suite、`SQ-007`, `OQ-RD-005`。
