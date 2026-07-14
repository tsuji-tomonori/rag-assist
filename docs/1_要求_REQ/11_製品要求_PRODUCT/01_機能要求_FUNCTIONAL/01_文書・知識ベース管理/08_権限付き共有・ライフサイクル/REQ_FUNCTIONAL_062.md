# FR-062 共有方針変更の認可と principal 検証

- 要件ID: `FR-062`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `1. 文書・知識ベース管理`
- L2主機能群: `1.8 権限付き共有・ライフサイクル`
- L3要件: `FR-062`
- 関連カテゴリ: `8. 認証・認可・管理・監査`

## 要件

- FR-062: システムは、フォルダーまたは文書の共有方針を変更する前に、共有 feature permission と対象の `full` 権限を確認し、付与先を active な同一 tenant principal に限定すること。

## 根拠と意図

free-text principal や別 tenant principal を受理すると誤共有を招く。共有可否の認可と付与先 directory 検証を一つの事前 decision として扱い、競合制御と監査は独立要求へ分離する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-062` |
| 説明 | share mutation の authorization と principal validation |
| 根拠 | 権限のない変更と未知・別 tenant principal への誤共有を防ぐ |
| 源泉 | `ARC_ADR_004`, 共有 UI/ledger reports、RAG ガイド §3.5.7, §8.8 |
| Actor / trigger | owner/share manager が share grant/policy を create/update/revoke するとき |
| 種類 | 機能要求 / authorization |
| 依存関係 | `FR-057`, `FR-060`, `FR-061`, directory, `FR-085`, `FR-086` |
| 衝突 | 現行 folder share は free-text legacy ACL を受理し得る |
| 受け入れ基準 | `AC-FR062-001`, `AC-FR062-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Document owner / Security |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR062-001 変更 actor guard

- Given: actor が share feature permission または対象 `full` を持たない
- When: share policy を変更する
- Then: 変更を拒否し、既存 policy を維持する

### AC-FR062-002 principal guard

- Given: 付与先が inactive、unknown、別 tenant、または許可されていない principal 種別である
- When: share grant/policy の create または update を要求する
- Then: directory の正規 ID へ解決できない限り拒否し、既存 policy を維持する

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 認可のない共有と別 tenant への誤共有を防ぐ |
| 十分性 | OK | actor と付与先の両方を変更前に検証する |
| 理解容易性 | OK | concurrency と audit を別要求へ分離した |
| 一貫性 | pending | 許可する共有 audience は `OQ-RD-011` |
| 標準・契約適合 | OK | 1 要求 1事前認可 decision と専用 AC を満たす |
| 実現可能性 | OK | directory lookup と既存 permission service で実現可能 |
| 検証可能性 | OK | permission×principal state×tenant の否定 matrix |
| ニーズ適合 | OK | owner が意図した範囲だけへ安全に共有できる |
| 実装適合 | OK（confirmed） | folder/document versioned replace が actor feature+full と active same-tenant canonical principal を検証し、service/route tests が inactive/cross-tenant/role principal を拒否する |

## トレース

- 後方: `reports/working/20260521-0912-document-share-move-ui.md`, `20260521-2307-pr331-rag-scope-ledger.md`。
- 前方: share directory API、policy/grant store、`FR-066`, `FR-085`, `FR-086`。
