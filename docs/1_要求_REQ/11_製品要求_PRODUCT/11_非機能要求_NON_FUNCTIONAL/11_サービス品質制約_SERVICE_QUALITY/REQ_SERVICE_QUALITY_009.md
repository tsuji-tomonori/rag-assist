# SQ-009 認可済み検索の回収品質

- 要件ID: `SQ-009`
- 種別: `REQ_SERVICE_QUALITY`
- 状態: Draft（閾値未承認）
- 優先度: S

## 要件

- SQ-009: システムは、認可済み正解根拠に対する Recall@k、全根拠回収率および false-denial rate を、承認済み検索品質閾値内に保つこと。

## 品質尺度

- measure: authorized Recall@k、all-evidence recall、false-denial rate、必要に応じ MRR/nDCG@k。
- population: tenant、role、direct/folder/group grant、OCR/language、single/multi-evidence の versioned slice。
- fail point/target: `OQ-RD-005`。権限外露出は別の非交渉 gate `SQ-005` とする。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `SQ-009` |
| 説明 | authorized evidence の retrieval effectiveness |
| 根拠 | 全拒否で非漏えいだけを満たす過剰拒否を防ぐ |
| 源泉 | RAG ガイド §7.2–7.3（PDF pp.160–167） |
| Actor / trigger | candidate retrieval の評価 |
| 種類 | サービス品質制約 / retrieval |
| 依存関係 | `FR-070`, `FR-075`, `SQ-005`, dataset |
| 衝突 | 厳格な prefilter と recall の両立が必要 |
| 受け入れ基準 | `AC-SQ009-001`, `AC-SQ009-002` |
| 優先度 | S |
| 安定性 | Medium |
| Confidence | inferred |
| 所有者 | RAG Quality / Security / Product |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-SQ009-001 認可済み根拠回収

- Given: actor が読める正解 document/span と grant 経路を持つ versioned dataset がある
- When: approved top-k で検索する
- Then: slice 別 Recall@k と全根拠回収率を測定し、approved fail point 以上である

### AC-SQ009-002 過剰拒否

- Given: actor が read を持つ根拠と、同型だが権限外の根拠を含む dataset がある
- When: authorization-aware retrieval を評価する
- Then: 権限外露出 0 を維持しつつ、認可済み根拠の false-denial rate が approved 上限以下である

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 安全性だけでなく許可済み情報への到達を保証する |
| 十分性 | OK | recall と false denial を認可 slice で測る |
| 理解容易性 | OK | unauthorized exposure は `SQ-005` へ分離した |
| 一貫性 | OK | `FR-070` の検索境界と両立する |
| 標準・契約適合 | OK | 1 要求 1 retrieval quality characteristic |
| 実現可能性 | OK | ACL 付き正解 dataset で測定可能 |
| 検証可能性 | OK | grant 経路別 benchmark で判定できる |
| ニーズ適合 | OK | read-only 利用者が共有資料を実際に発見できる |
| 実装適合 | partial | unauthorized gate/authorized recall の統合計測が不足 |

## トレース

- 後方: RAG ガイド §7.2–7.3、`GAP-RD-006`, `GAP-RD-009`。
- 前方: authorization-aware retrieval benchmark、`SQ-007`, `OQ-RD-005`。
