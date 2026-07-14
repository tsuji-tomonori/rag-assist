# FR-069 文書からチャンクへの強制属性継承

- 要件ID: `FR-069`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.7 安全なRAGライフサイクル`
- L3要件: `FR-069`
- 関連カテゴリ: `1. 文書・知識ベース管理`, `8. 認証・認可・管理・監査`

## 要件

- FR-069: システムは、各 chunk、memory、embedding、index record に、親文書の tenant、authorization、classification、usage constraint、quality/admission、lifecycle、version、provenance の immutable reference と source locator を継承させること。

## 根拠と意図

検索単位が chunk でも認可単位は文書または明示された例外資源である。派生データの属性欠損を public/default と解釈しない。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-069` |
| 説明 | parent document security/classification/usage/quality/lifecycle/provenance reference の派生 record 継承 |
| 根拠 | chunk 単位の ACL 欠損と citation 追跡不能を防ぐ |
| 源泉 | RAG ガイド §3.5.2–3.5.10（PDF pp.78–81） |
| Actor / trigger | parse/chunk/embed/index/memory generation |
| 種類 | 機能要求 / ingest / security |
| 依存関係 | `FR-060`, `FR-068` |
| 衝突 | metadata 欠損の legacy fallback と互換しない |
| 受け入れ基準 | `AC-FR069-001`, `AC-FR069-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | RAG Platform / Security |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR069-001 継承完全性

- Given: published document version から chunk/memory/vector record を生成する
- When: 派生 record を永続化する
- Then: documentId/version/tenant/authorizationRef/classificationRef/usagePolicyRef/qualityAdmissionRef/lifecycle/provenance/source location を保持し、各 reference version、件数、hash を manifest で照合する

### AC-FR069-002 欠損 deny

- Given: 派生 record の tenant、authorization、classification、usage constraint、quality/admission、document version、lifecycle reference のいずれかが欠損・不一致である
- When: index publish または retrieval を行う
- Then: record を隔離・除外し、public/active/eligible を補完しない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | chunk や memory で ACL/lifecycle/provenance が欠損し、親文書境界を迂回することを防ぐために必要 |
| 十分性 | OK | chunk、memory、embedding、index record の security/classification/usage/quality/lifecycle/provenance 必須 reference、manifest 照合、欠損時の隔離を扱う |
| 理解容易性 | OK | 継承元、派生 record、必須属性、欠損時の結果を明示した |
| 一貫性 | OK | tenant 境界 `FR-060`、publication admission `FR-068`、source span `FR-082` と整合する |
| 標準・契約適合 | OK | RAG ガイドの document-to-chunk ACL inheritance と citation provenance に適合する |
| 実現可能性 | OK | stable IDs、authorization reference、manifest count/hash validation で実現できる |
| 検証可能性 | OK | manifest-record completeness と mandatory field missing/mismatch test で確認できる |
| ニーズ適合 | OK | 派生データを利用しても元文書の共有範囲と引用位置を維持できる |
| 原子性 | OK | 派生 record の属性継承を規定する |
| 実装適合 | OK（confirmed） | `derived-record-security.ts` が document→chunk/memory/vector の tenant/reference/hash/count/locator envelope を生成・検証し、tamper/missing metadata を eligibility tests で除外する |
| 合意 | pending | 添付・コメント等の例外資源モデルは未確定 |

## トレース

- 後方: RAG ガイド PDF pp.78–81、`DES_DATA_001`。
- 前方: `FR-070`, `FR-072`–`FR-074`, index manifest validator。
