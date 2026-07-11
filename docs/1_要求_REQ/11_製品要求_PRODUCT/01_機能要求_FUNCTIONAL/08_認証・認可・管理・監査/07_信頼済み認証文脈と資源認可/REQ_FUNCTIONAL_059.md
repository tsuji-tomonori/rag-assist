# FR-059 単一の資源認可サービスと break-glass 分離

- 要件ID: `FR-059`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `8. 認証・認可・管理・監査`
- L2主機能群: `8.7 信頼済み認証文脈と資源認可`
- L3要件: `FR-059`
- 関連カテゴリ: `1. 文書・知識ベース管理`, `3. RAG検索品質制御`

## 要件

- FR-059: システムは、通常の資源アクセスを一つの versioned authorization decision contract で判定し、管理 role による全資源閲覧を通常経路へ暗黙に追加しないこと。

## 根拠と意図

list、search、memory、citation、preview が別 helper を使うと同じ actor/resource で結果が変わる。緊急閲覧が必要なら通常権限とは分離し、理由・期限・監査を必須にする。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-059` |
| 説明 | 全経路共通の資源認可 contract と管理者例外の分離 |
| 根拠 | 認可 drift と恒常的な特権 bypass を防ぐ |
| 源泉 | `ARC_ADR_004`, RAG ガイド §3.5.7（PDF p.80）、§8.1.3（PDF p.187） |
| Actor / trigger | list/get/search/memory/citation/debug/share/move/delete/reindex |
| 種類 | 機能要求 / security |
| 依存関係 | `FR-057`, folder/document authorization services |
| 衝突 | legacy helper と新 service が併存し、`SYSTEM_ADMIN` bypass がある |
| 受け入れ基準 | `AC-FR059-001`, `AC-FR059-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Security / Architecture |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR059-001 経路間一致

- Given: 同じ actor、tenant、resource、policy version がある
- When: list、hybrid search、memory、citation、preview、operation guard で権限を評価する
- Then: 同じ effective permission と reason code を返す

### AC-FR059-002 break-glass 分離

- Given: 管理者が通常 resource permission を持たない
- When: 通常 route で資源本文を取得する
- Then: 管理 role だけでは許可せず、別の承認済み break-glass 経路に理由、期限、audit、事後 review を要求する

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | list、検索、memory、citation、操作 guard 間の認可 drift と恒常 admin bypass を防ぐために必要 |
| 十分性 | OK | canonical decision、reason code、全経路一致、通常管理 role と break-glass の分離を扱う |
| 理解容易性 | OK | 通常アクセスの単一 contract と例外アクセスの境界を分けて記述した |
| 一貫性 | OK | `ARC_ADR_004`、操作別行列 `FR-076`、管理主体 invariant `FR-077` と整合する |
| 標準・契約適合 | OK | deterministic authorization と管理例外の明示・監査原則に適合する |
| 実現可能性 | OK | legacy helper を段階移行し、同じ decision service/schema を全 path から呼び出せる |
| 検証可能性 | OK | 全経路 parity contract test と admin-without-grant negative test で確認できる |
| ニーズ適合 | OK | 利用経路によらず同じ共有権限が適用され、管理 role だけで本文を閲覧されない |
| 原子性 | OK | 認可 decision contract の一意性を規定する |
| 実装適合 | NG/conflict | `document-group-permissions.ts:37-66`, `ARC_ADR_004:26` |
| 合意 | pending | break-glass を導入するか自体が未確定 |

## トレース

- 後方: `ARC_ADR_004`, 2026-05-17/19 folder permission reports、`GAP-RD-003`, `GAP-RD-004`。
- 前方: `FR-061`, `FR-063`, `FR-070`, access-control policy/runtime matrix。
