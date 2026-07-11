# FR-068 情報源台帳・取り込み admission・隔離

- 要件ID: `FR-068`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.7 安全なRAGライフサイクル`
- L3要件: `FR-068`
- 関連カテゴリ: `1. 文書・知識ベース管理`, `8. 認証・認可・管理・監査`

## 要件

- FR-068: システムは、情報源の provenance、owner、data classification、利用条件、品質状態、ライフサイクルを検査し、公開可と確認された文書だけを通常 RAG の対象にすること。

## 根拠と意図

「取り込みに成功した」と「正本として回答に使ってよい」は異なる。owner/ACL/品質が不明な資料を approved と補完せず、検査・隔離・公開の状態を分ける。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-068` |
| 説明 | source registry と fail-closed publication admission |
| 根拠 | 未検証・汚染・権限不明資料の自動公開を防ぐ |
| 源泉 | RAG ガイド §3.1–3.2（PDF pp.59–66）、§3.8（PDF pp.93–97） |
| Actor / trigger | connector/upload が資料を取り込み、公開判定するとき |
| 種類 | 機能要求 / ingest / governance |
| 依存関係 | `FR-056`, source registry, review workflow |
| 衝突 | quality metadata 欠損時に approved/verified/current/high/eligible を補完する |
| 受け入れ基準 | `AC-FR068-001`, `AC-FR068-002` |
| 優先度 | S |
| 安定性 | Medium |
| Confidence | inferred |
| 所有者 | Document steward / RAG Ops / Security |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR068-001 protected metadata

- Given: upload caller が tenant、owner、ACL、quality、lifecycle、approval を自己申告する
- When: ingest admission を行う
- Then: protected 属性は server-side registry/reviewer から設定し、caller 値を拒否または置換する

### AC-FR068-002 fail-closed publication

- Given: owner、tenant、ACL、provenance、malware/format inspection、quality approval のいずれかが不明・不合格である
- When: document ingest が処理を終える
- Then: `quarantined` または `rejected` とし、normal RAG index、memory、cache、answer evidence へ公開しない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 未検証・権限不明・汚染された文書が normal RAG evidence として公開されることを防ぐために必要 |
| 十分性 | OK | provenance、owner、classification、利用条件、品質、lifecycle の admission と quarantine/reject を扱う |
| 理解容易性 | OK | caller が自己申告できない protected metadata と公開可否の条件を明示した |
| 一貫性 | OK | 属性継承は `FR-069`、loss-aware extraction は `FR-082`、staged recovery は `FR-083` に分離した |
| 標準・契約適合 | OK | RAG ガイドの source registry、quality admission、unknown metadata の fail-closed 原則に適合する |
| 実現可能性 | OK | source registry、inspection result、review transition、quarantine state で実現できる |
| 検証可能性 | OK | missing/self-asserted metadata、malware、unsupported format、review transition test で確認できる |
| ニーズ適合 | OK | 利用者が信頼・利用条件を確認された文書だけから回答を得られる |
| 原子性 | OK | normal RAG への admission decision を規定する |
| 実装適合 | NG/conflict | `quality-policy.ts:53-65` は missing を良好値へ補完する |
| 合意 | pending | 対応 MIME、reviewer、data classification、公開状態遷移が未確定 |

## トレース

- 後方: `FR-001`, `FR-002`, `FR-038`, `GAP-RD-012`, `GAP-RD-013`。
- 前方: source registry、ingest state machine、`FR-069`, `FR-075`。
