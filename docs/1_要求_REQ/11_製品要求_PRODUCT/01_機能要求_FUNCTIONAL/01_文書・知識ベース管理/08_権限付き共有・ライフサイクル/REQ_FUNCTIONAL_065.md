# FR-065 文書移動の両端認可

- 要件ID: `FR-065`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `1. 文書・知識ベース管理`
- L2主機能群: `1.8 権限付き共有・ライフサイクル`
- L3要件: `FR-065`
- 関連カテゴリ: `8. 認証・認可・管理・監査`

## 要件

- FR-065: システムは、文書を移動する actor に move feature permission、移動元 container の `full`、移動先 folder の `full` を要求すること。

## 根拠と意図

移動は元の共有境界から文書を除き、別境界へ公開する危険操作である。direct document `full` だけで container 境界を越えさせない。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-065` |
| 説明 | document move の source/destination authorization |
| 根拠 | 元・先どちらか一方だけの権限による越境を防ぐ |
| 源泉 | chapter spec move、2026-05-21 share/move report |
| Actor / trigger | actor が document move を確定するとき |
| 種類 | 機能要求 / authorization |
| 依存関係 | `FR-057`, `FR-061`, `FR-063`, `FR-060` |
| 衝突 | 現行は document direct full と destination full で許可し得る |
| 受け入れ基準 | `AC-FR065-001`, `AC-FR065-002` |
| 優先度 | S |
| 安定性 | Medium |
| Confidence | inferred |
| 所有者 | Document owner / Product |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR065-001 両端 guard

- Given: move feature、source full、destination full、same tenant のいずれかが満たされない
- When: document move を要求する
- Then: manifest、vector、index、grant を変更せず拒否する

### AC-FR065-002 許可 decision

- Given: move feature、source full、destination full、same tenant をすべて満たす
- When: document move の認可を評価する
- Then: move coordinator にだけ許可 decision を返し、状態整合更新は `FR-087`、監査は `FR-086` に従う

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | container 越境に両端の管理権限が必要 |
| 十分性 | OK | feature、source、destination、tenant の条件を含む |
| 理解容易性 | OK | 認可と状態更新・監査を分離した |
| 一貫性 | pending | source full 要否は `OQ-RD-012` |
| 標準・契約適合 | OK | 1 要求 1 authorization decision と専用 AC を満たす |
| 実現可能性 | OK | 既存 permission services で判定可能 |
| 検証可能性 | OK | source/destination/feature/tenant の組合せ試験 |
| ニーズ適合 | OK | 文書を権限外 container へ移動されない |
| 実装適合 | OK（confirmed） | `document-lifecycle-mutation-coordinator.ts` が move feature/source full/destination full/same tenant/current revoke を commit 前に再評価し、fault/concurrency tests を持つ |

## トレース

- 後方: `memorag-service.ts:585-639`, `reports/working/20260521-0912-document-share-move-ui.md`。
- 前方: `FR-086`, `FR-087`, move authorization contract tests。
