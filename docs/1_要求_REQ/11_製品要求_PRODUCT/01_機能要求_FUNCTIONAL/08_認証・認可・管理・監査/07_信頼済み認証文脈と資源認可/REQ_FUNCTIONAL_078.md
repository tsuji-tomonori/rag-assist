# FR-078 管理主体の移管整合性

- 要件ID: `FR-078`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `8. 認証・認可・管理・監査`
- L2主機能群: `8.7 信頼済み認証文脈と資源認可`
- L3要件: `FR-078`
- 関連カテゴリ: `1. 文書・知識ベース管理`

## 要件

- FR-078: システムは、owner または adminPrincipal の変更、tenant 離脱、恒久削除を確定する前に、その principal が管理する全資源を active かつ同一 tenant の後継管理主体へ移管し、移管を完了できない場合は当該変更の確定を拒否すること。

## 根拠と意図

管理主体の参照だけを削除すると、policy を更新できない orphan resource と、削除済み principal に依存する認可判断が残る。緊急 suspension は `FR-058` に従って即時 deny できるが、suspension を理由に旧 principal のアクセスを維持せず、恒久削除までに後継を解決する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-078` |
| 説明 | 管理主体の変更・削除前に全管理資源の後継を確定する referential invariant |
| 根拠 | orphan resource、last-full 喪失、削除済み principal への依存を防ぐ |
| 源泉 | `ARC_ADR_004` の full 0 人禁止、RAG ガイド §8.1.7、account/document lifecycle の現行 gap |
| Actor / trigger | owner/adminPrincipal の transfer、tenant leave、permanent delete を確定するとき |
| 種類 | 機能要求 / authorization / lifecycle |
| 依存関係 | `FR-058`, `FR-060`, `FR-077`, directory transaction、`FR-086` |
| 衝突 | 現行 account delete は管理台帳状態を更新するが、所有資源の successor 解決を要求しない |
| 受け入れ基準 | `AC-FR078-001`, `AC-FR078-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Product / Security / Document Governance |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR078-001 後継への全件移管

- Given: principal A が複数の folder/document の owner または adminPrincipal であり、active な同一 tenant principal B が後継として指定されている
- When: A から B への管理主体変更を確定する
- Then: 対象資源の管理主体をすべて B へ更新し、`FR-077` の `full` を確認してから A の管理参照を除去する

### AC-FR078-002 orphan を作る確定の拒否

- Given: 削除または tenant 離脱対象の principal が管理資源を持ち、後継が未指定、inactive、別 tenant、または一部資源だけ更新失敗である
- When: principal の恒久削除または離脱を確定する
- Then: 確定を拒否して失敗資源を列挙可能な運用状態にし、suspended principal のアクセスを再許可せず orphan resource を作らない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | account/group lifecycle と resource ownership の参照整合性に必要 |
| 十分性 | OK | 正常な全件移管と、部分失敗・不正 successor の拒否を扱う |
| 理解容易性 | OK | trigger、後継条件、確定順序を明示した |
| 一貫性 | OK | suspension の即時 deny と恒久削除前の ownership 解決を分離した |
| 標準・契約適合 | OK | 一つの referential invariant と専用 AC を一ファイルに記載した |
| 実現可能性 | OK | ownership inventory、versioned update、outbox/reconciliation で実現可能 |
| 検証可能性 | OK | multi-resource transfer と stage failure injection test へ変換できる |
| ニーズ適合 | OK | 退職・group 廃止後も正当な管理者が共有資源を管理できる |
| 原子性 | OK | 管理主体を失う変更の確定前に後継移管を完了するという一つの invariant を規定する |
| 実装適合 | OK（confirmed） | `administrative-principal-transfer-service.ts` が successor/inventory/preflight/version/fault reconciliation を実装し、transfer/account lifecycle tests が partial failure を拒否する |
| 合意 | pending | successor の選任責任者と大量移管時の運用手順を承認する必要がある |

## トレース

- 後方: `FR-058`, `FR-062`, `ARC_ADR_004`, `GAP-RD-001`, `OQ-RD-009`。
- 前方: ownership transfer API、principal deletion preflight、reconciliation、`FR-086`。
