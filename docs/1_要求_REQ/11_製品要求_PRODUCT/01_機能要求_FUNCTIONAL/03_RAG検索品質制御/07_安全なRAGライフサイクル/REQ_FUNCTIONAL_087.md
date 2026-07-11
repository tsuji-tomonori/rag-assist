# FR-087 文書・フォルダー move state coherence

- 要件ID: `FR-087`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.7 安全なRAGライフサイクル`
- L3要件: `FR-087`
- 関連カテゴリ: `1. 文書・知識ベース管理`, `8. 認証・認可・管理・監査`

## 要件

- FR-087: システムは、認可済みの文書またはフォルダー move を一つの整合した状態遷移として処理し、文書では manifest・chunk/vector/index metadata・canonical path・document-scoped grant、フォルダーでは subtree path・各 folder-local explicit policy/version・parent/inherited policy reference・配下文書の検索 metadata を同期し、混在した旧・新状態を公開しないこと。

## 根拠と意図

manifest や folder record だけを更新して vector/index/path/inherited policy が旧 container を指すと、検索範囲と表示経路が分岐する。direct document grant と各 folder-local explicit policy/version は対象資源に保持し、移動元・移動先 folder 由来の実効 grant だけを新しい path から再計算する。フォルダー move は descendant cycle を拒否し、subtree と配下文書を同じ before/after version へ収束させる。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-087` |
| 説明 | document/folder move 時の manifest/subtree/vector/index/path/explicit-inherited-policy/grant coherence |
| 根拠 | 文書移動後の stale search scope、grant 消失、旧 path 再露出を防ぐ |
| 源泉 | `FR-061`, `FR-065`、`reports/working/20260521-0912-document-share-move-ui.md`、`docs/spec-recovery/16_current_state_gap_analysis_202607.md` の `GAP-RD-023` |
| Actor / trigger | move coordinator が認可済み document/folder move を commit、retry または reconcile するとき |
| 種類 | 機能要求 / resource lifecycle / consistency |
| 依存関係 | `FR-061`, `FR-063`, `FR-065`, `FR-069`, `FR-072`, `FR-076` |
| 衝突 | document は外部 vector/index metadata 更新が optional、folder は subtree path 更新と配下文書/index/policy 再計算が一つの公開単位ではない |
| 受け入れ基準 | `AC-FR087-001`, `AC-FR087-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Document Platform / RAG Platform / Security |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR087-001 coherent move commit

- Given: `FR-065` を満たす文書に direct grant があり、移動元と移動先で folder 由来 grant と canonical path が異なる
- When: move coordinator が文書移動を commit する
- Then: 同じ document/version の manifest、vector/index metadata、canonical path を移動先へ同期し、direct grant を保持して inherited grant を移動先から再計算し、旧 path/index scope から文書を返さない

### AC-FR087-002 folder subtree failure and retry coherence

- Given: folder-local explicit policy/version、descendants、配下文書を持つ folder の move で、subtree path、parent/inherited policy reference、配下文書の manifest/vector/index metadata の更新途中に失敗または retry が起きる
- When: reconciliation と folder list、document read/search を実行する
- Then: descendant cycle を許さず、subtree と配下文書を完全な移動前または移動後の一方へ収束させ、document-scoped grant と各 folder-local explicit policy/version を保持し、inherited grant だけを確定した parent から再計算して、旧・新 path/policy/index が混在する active result を公開しない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 文書移動で表示・検索・認可状態を分岐させないために必要 |
| 十分性 | OK | document manifest/vector/index/path/grant と folder subtree/path/local explicit policy/inherited policy/descendant metadata、cycle、失敗回復を含む |
| 理解容易性 | OK | document/folder move の認可ではなく commit と回復時の状態整合に限定した |
| 一貫性 | OK | `FR-065` の両端認可後に適用し、`FR-063` の grant composition を維持する |
| 標準・契約適合 | OK | 1 要件 1 主判断と要件内 Given/When/Then を満たす |
| 実現可能性 | OK | move coordinator、versioned manifest、outbox/reconciliation で実現可能 |
| 検証可能性 | OK | resource type/stage 別 failure injection、subtree cycle、old/new path search、direct/inherited grant preservation で確認できる |
| ニーズ適合 | OK | 共有状態を失わず文書を別 container へ安全に移動できる |
| 実装適合 | partial | document の local manifest/vector と folder subtree path は部分更新するが、外部 index・配下文書・policy と失敗時一貫性が未保証 |

## トレース

- 後方: `FR-061`, `FR-065`、`reports/working/20260521-0912-document-share-move-ui.md`、`GAP-RD-005`, `GAP-RD-023`。
- 前方: document/folder move coordinator、reconciliation、external index adapter contract、subtree fault-injection tests。
