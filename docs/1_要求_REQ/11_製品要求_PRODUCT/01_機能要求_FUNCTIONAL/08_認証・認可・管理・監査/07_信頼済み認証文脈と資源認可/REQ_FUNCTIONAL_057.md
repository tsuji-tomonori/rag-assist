# FR-057 fail-closed の多層認可

- 要件ID: `FR-057`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `8. 認証・認可・管理・監査`
- L2主機能群: `8.7 信頼済み認証文脈と資源認可`
- L3要件: `FR-057`
- 関連カテゴリ: `1. 文書・知識ベース管理`, `3. RAG検索品質制御`

## 要件

- FR-057: システムは、保護操作を許可する前に、active account、feature permission、tenant 境界、対象資源の必要実効権限のすべてを満たすことを確認し、未確定または不一致なら拒否すること。

## 根拠と意図

認証、role、資源 ACL のいずれか一つだけでは権限境界にならない。全条件を論理積で評価し、NULL、未知、取得失敗を allow に変換しない。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-057` |
| 説明 | account・feature・tenant・resource の論理積認可 |
| 根拠 | UI 表示制御や部分的な role check に依存しない |
| 源泉 | RAG ガイド §3.5.7–3.5.10（PDF pp.80–81）、§8.1.3（PDF p.187） |
| Actor / trigger | actor が read/write/share/move/delete/search/debug/worker commit を行うとき |
| 種類 | 機能要求 / security |
| 依存関係 | `FR-056`, `FR-076`, resource permission service |
| 衝突 | 旧 `FR-052` と `NFR-011` は複数判断を一要求に含む |
| 受け入れ基準 | `AC-FR057-001`, `AC-FR057-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Security / API |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR057-001 全条件の論理積

- Given: account、feature、tenant、resource のうち一つ以上が不許可・欠損・取得失敗である
- When: 同期 API または非同期 worker が保護操作を判定する
- Then: 操作を拒否し、残りの条件が許可でも実行しない

### AC-FR057-002 全条件成立時の許可

- Given: active account、要求 operation の feature permission、authoritative tenant 一致、対象資源の必要実効権限がすべて成立し、追加 guard に不許可・欠損がない
- When: 同期 API または非同期 worker が完全一致する保護操作を判定する
- Then: システムはその操作を許可し、別資源・別操作の permission を追加条件または代替条件にしない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 一部の guard や UI 表示だけで保護操作が許可される経路をなくすために必要 |
| 十分性 | OK | account、feature、tenant、resource の全条件について、成立時の許可と欠損・取得失敗時の拒否を扱う |
| 理解容易性 | OK | 許可は全条件の論理積、未確定は拒否という判定規則が明確 |
| 一貫性 | OK | context source は `FR-056`、tenant は `FR-060`、操作別権限は `FR-076` に委譲した |
| 標準・契約適合 | OK | least privilege、deny by default、complete mediation に適合する |
| 実現可能性 | OK | route guard と canonical resource decision を同じ判定 contract に接続できる |
| 検証可能性 | OK | account×role×tenant×none/readOnly/full の否定 matrix で確認できる |
| ニーズ適合 | OK | 正当な利用者だけが必要な操作を行える |
| 原子性 | OK | 許可判定の結合規則を規定する |
| 実装適合 | OK（confirmed） | `resource-operation-authorization.ts` が account/feature/tenant/resource/guard の論理積を fail closed 評価し、行列 test が各層欠損と別 permission 代用を拒否する |
| 合意 | pending | 403/404/一般拒否の API 別表現は別途決定する |

## トレース

- 後方: `FR-052`, `NFR-011`, RAG ガイド PDF pp.80–81, 187–189。
- 前方: `FR-058`–`FR-070`, `FR-076`, `FR-091`, `SQ-005`。
