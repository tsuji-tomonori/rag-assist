# FR-056 検証済み認証文脈

- 要件ID: `FR-056`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `8. 認証・認可・管理・監査`
- L2主機能群: `8.7 信頼済み認証文脈と資源認可`
- L3要件: `FR-056`
- 関連カテゴリ: `3. RAG検索品質制御`

## 要件

- FR-056: システムは、認可に使う利用者 ID、アカウント状態、テナント、アプリケーション role、資源 group を、検証済み認証情報とサーバー管理データから構築すること。

## 根拠と意図

クライアント入力や質問文から tenant、role、group、ACL を採用すると、利用者が強制条件を拡張できる。RAG ガイドは検索入力の認可属性を認証済み情報から構築し、client tenant/role を信頼しないとしている。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-056` |
| 説明 | サーバーが構築する検証済み認証・認可文脈 |
| 根拠 | 利用者入力による権限・テナント拡張を防ぐ |
| 源泉 | RAG ガイド §4.1.2（PDF p.99）、§8.1.2（PDF p.187） |
| Actor / trigger | 認証済み actor が API、worker、RAG 検索を開始するとき |
| 種類 | 機能要求 / security |
| 依存関係 | `authMiddleware`, identity directory, tenant membership |
| 衝突 | 現行 `AppUser` に tenant がなく、request filter で tenant を受ける |
| 受け入れ基準 | `AC-FR056-001`, `AC-FR056-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Security / Platform |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR056-001 検証済み属性を使う

- Given: 有効な token と、token と異なる tenant/role/group を含む request がある
- When: 保護 API または RAG 検索を実行する
- Then: 強制認可条件には検証済み token と server-side membership の値だけを使い、request 値で拡張しない

### AC-FR056-002 必須属性欠損を拒否する

- Given: 認可に必須な subject、tenant または account state を検証できない
- When: 保護資源を操作する
- Then: 既定拒否し、local/test 以外で暗黙の `SYSTEM_ADMIN` や `default` tenant を補わない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | caller が tenant、role、group を偽装して強制認可条件を拡張することを防ぐために必要 |
| 十分性 | OK | subject、account state、tenant、application role、resource group の源泉と必須属性欠損時の拒否を扱う |
| 理解容易性 | OK | 認可に使う属性と、採用可能な verified/server-side source を列挙した |
| 一貫性 | OK | `FR-057` の許可判定、`FR-060` の tenant 境界、`FR-084` の隔離評価主体と責務を分離した |
| 標準・契約適合 | OK | RAG ガイドの client 属性非信頼と fail-closed 原則に適合する |
| 実現可能性 | OK | JWT 検証、identity directory、tenant membership から immutable context を構築できる |
| 検証可能性 | OK | forged filter、claim 欠損、worker context の否定試験で確認する |
| ニーズ適合 | OK | 利用者が許可された tenant・role・group の範囲だけで資源を利用できる |
| 原子性 | OK | 認可文脈の源泉だけを規定する |
| 実装適合 | NG | `apps/api/src/auth.ts:7-12,51-56`、`hybrid-retriever.ts:173-180` |
| 合意 | pending | authoritative tenant source は未確定 |

## トレース

- 後方: `SRC-034`, `SRC-036`, `GAP-RD-002`。
- 前方: `FR-057`, `FR-060`, `FR-070`, `SQ-005`、runtime authorization matrix test。
