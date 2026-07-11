# FR-085 共有 policy の optimistic concurrency と integrity

- 要件ID: `FR-085`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `1. 文書・知識ベース管理`
- L2主機能群: `1.8 権限付き共有・ライフサイクル`
- L3要件: `FR-085`
- 関連カテゴリ: `8. 認証・認可・管理・監査`

## 要件

- FR-085: document または folder の共有 policy を変更するとき、システムは caller が指定した expected policy version と現在 version の一致、および `FR-077` の last administrative principal を含む integrity invariants を確認し、検証済みの完全な次 policy state を単一の原子的遷移として確定すること。

## 根拠と意図

共有画面を複数の管理者が同時更新すると、後勝ち更新による grant 消失や管理者不在が起こり得る。server が直前に読んだ version だけでなく caller が確認した expected version を必須にし、完全 state の整合性検証と commit を一体化する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-085` |
| 説明 | expected version に基づく share policy の compare-and-replace と integrity gate |
| 根拠 | lost update、partial policy、self-lockout、last administrator 喪失を防ぐ |
| 源泉 | `docs/spec-recovery/14_authorization_sharing_matrix_202607.md` §7、`ARC_ADR_004`、current document share conditional write |
| Actor / trigger | share manager が document または folder の共有 policy を置換するとき。resource group membership は `FR-081`、`resourceGroup.share` は `FR-076` の explicit deny に従う |
| 種類 | 機能要求 / concurrency / authorization integrity |
| 依存関係 | `FR-076`, `FR-077`, versioned document/folder share policy store |
| 衝突 | 現行 document share API は caller の expected policy version を受け取らず、`FolderPolicy` は policy version を持たず、document grant と audit は別書き込みである |
| 受け入れ基準 | `AC-FR085-001`, `AC-FR085-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Document Platform / Security |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR085-001 matching version の atomic replace

- Given: caller の expected policy version が現在 version と一致し、提案した完全 policy state が `FR-077` を含む integrity invariants を満たす
- When: caller が共有 policy の置換を要求する
- Then: システムは全 grant と policy metadata を一度に確定し、確定 state に新しい一意な policy version を付与する

### AC-FR085-002 stale version または integrity failure

- Given: expected policy version が現在 version と異なるか、提案 state が last administrative principal を失う
- When: caller が共有 policy の置換を要求する
- Then: システムは conflict または integrity error として拒否し、policy state と現在 version のどちらも変更しない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 原子性 | OK | versioned share policy の compare-and-replace decision だけを規定する |
| 必要性 | OK | 同時更新による lost update と管理不能状態を防ぐために必要 |
| 十分性 | OK | caller expected version、current comparison、complete next state、integrity、atomic commit を含む |
| 理解容易性 | OK | success と stale/integrity failure の state transition を分離して記述する |
| 一貫性 | OK | last administrative principal の業務規則を `FR-077` に委ね、重複定義しない |
| 標準・契約適合 | OK | optimistic concurrency、all-or-nothing state transition、fail closed に適合する |
| 実現可能性 | OK | ETag/version と conditional transaction または同等の compare-and-swap で実現可能 |
| 検証可能性 | OK | matching/stale version、同時 writer、last-admin violation、partial-write absence を検証できる |
| ニーズ適合 | OK | 管理者が他者の更新を失わず、安全に共有状態を編集するニーズに対応する |

## トレース

- 後方: `FR-062`, `FR-063`, `FR-077`, `ARC_ADR_004`, `apps/api/src/documents/document-permission-service.ts`。
- 前方: share API expected-version contract、concurrent writer/invariant tests、`FR-086`。
