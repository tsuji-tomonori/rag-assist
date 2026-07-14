# FR-072 版管理索引の安全な切替・ロールバック

- 要件ID: `FR-072`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.7 安全なRAGライフサイクル`
- L3要件: `FR-072`
- 関連カテゴリ: `1. 文書・知識ベース管理`, `7. 評価・debug・benchmark`

## 要件

- FR-072: システムは、索引を versioned manifest として現行版から隔離して構築・検証し、切替・再試行・ロールバック中も最新の authorization、classification、usage constraint、quality/admission、lifecycle/delete eligibility を強制すること。

## 根拠と意図

旧 index へ戻す操作で古い ACL や削除文書を復活させてはならない。logical document ごとの active version と manifest/hash を追跡し、部分失敗を回復可能にする。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-072` |
| 説明 | versioned index build/cutover/rollback safety |
| 根拠 | 索引更新失敗と旧権限復活を防ぎ、再現可能にする |
| 源泉 | RAG ガイド §3.7.7–3.7.11（PDF pp.90–91）、§8.7.4（PDF p.205） |
| Actor / trigger | index build、reindex、cutover、rollback、retry |
| 種類 | 機能要求 / lifecycle / operations |
| 依存関係 | `FR-066`, `FR-068`, `FR-069` |
| 衝突 | 現行 rollback/cutover は途中失敗時の一貫 active version を保証しない |
| 受け入れ基準 | `AC-FR072-001`, `AC-FR072-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | RAG Ops |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR072-001 isolated build と promotion

- Given: source/version/pipeline/model/policy/hash を持つ candidate index がある
- When: candidate を build・verify・promote する
- Then: current index と分離し、completeness/security/quality gate 合格後だけ atomic alias/version 切替する

### AC-FR072-002 rollback invariant

- Given: cutover または rollback の任意 stage で failure/retry が起きる
- When: read/search を継続する
- Then: readable logical document に 0 または複数の active version を作らず、active/staged/old のどの index でも現在の authorization/classification/usage/quality/lifecycle deny state を適用する

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | index 更新失敗・rollback で active version が消失・重複し、旧 ACL/deleted content が復活することを防ぐために必要 |
| 十分性 | OK | isolated build、version manifest、validation、cutover、retry、rollback、全 eligibility dimension の current deny invariant を扱う |
| 理解容易性 | OK | candidate と current の分離、promotion 条件、failure 時に維持する状態を明示した |
| 一貫性 | OK | deny-first は `FR-066`、派生属性は `FR-069`、ingest checkpoint/reconciliation は `FR-083` に分離した |
| 標準・契約適合 | OK | RAG ガイドの reproducible index、isolated validation、安全な rollback 原則に適合する |
| 実現可能性 | OK | staged manifest、atomic alias/version、outbox、reconciliation で実現できる |
| 検証可能性 | OK | stage failure injection、concurrent read、exactly-one-active、rollback ACL/delete test で確認できる |
| ニーズ適合 | OK | 索引更新中も利用可能な正しい版を検索し、削除・失効済み資料を復活させない |
| 原子性 | OK | index version transition の安全条件を規定する |
| 実装適合 | OK（confirmed） | staged publication coordinator が isolated namespace、reconciliation、fencing、CAS active pointer、rollback を実装し、fault/concurrency test が exactly-one-active を検証する |
| 合意 | pending | retention と rollback window は未確定 |

## トレース

- 後方: reindex migration code/report、RAG ガイド PDF pp.90–91,205。
- 前方: index manifest/outbox/reconciliation、`FR-075`, `SQ-006`。
