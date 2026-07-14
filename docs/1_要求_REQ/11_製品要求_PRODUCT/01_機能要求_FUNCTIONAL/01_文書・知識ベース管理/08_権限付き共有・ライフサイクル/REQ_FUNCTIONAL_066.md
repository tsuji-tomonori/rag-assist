# FR-066 共有解除・失効・削除の deny-first 伝播

- 要件ID: `FR-066`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `1. 文書・知識ベース管理`
- L2主機能群: `1.8 権限付き共有・ライフサイクル`
- L3要件: `FR-066`
- 関連カテゴリ: `3. RAG検索品質制御`, `8. 認証・認可・管理・監査`

## 要件

- FR-066: システムは、共有・account/group 権限、classification、usage constraint、quality/admission、lifecycle の変更によって資源または利用目的が不適格になった状態を、派生データの物理 cleanup より先に authoritative deny として確定し、すべての利用経路へ伝播すること。

## 根拠と意図

vector/object を順番に消すだけでは途中失敗や旧 index/cache から再出現する。まず最新 decision で不可視化し、source、chunk、memory、index、cache、session、queued run を追跡して cleanup する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-066` |
| 説明 | authorization-first revocation と派生物 cleanup |
| 根拠 | 剥奪直後・削除途中・rollback 後の再露出を防ぐ |
| 源泉 | RAG ガイド §3.5.11（PDF p.81）、§8.1.7（PDF pp.188–189）、§8.7（PDF pp.204–207） |
| Actor / trigger | share/account/group revoke、classification/usage/quality approval change、expiry/archive/delete、index rollback |
| 種類 | 機能要求 / security / lifecycle |
| 依存関係 | `FR-058`, `FR-059`, `FR-072`, `SQ-006` |
| 衝突 | 現行 delete は複数 storage の物理削除を順次実行する |
| 受け入れ基準 | `AC-FR066-001`, `AC-FR066-002` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Security / RAG Ops |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR066-001 deny-first

- Given: grant/account/group、classification、利用目的許可、quality approval、expiry/archive/delete の authoritative change により、actor/resource/use-purpose の組合せが不適格になる
- When: 操作を受理する
- Then: authoritative eligibility decision を先に deny へ変更し、cleanup 完了前でも該当 use-purpose の search/prompt/citation/cache/session/worker/evaluation から利用できない

### AC-FR066-002 cleanup と rollback

- Given: active/staged/old index、chunk、memory、cache、grant、queued run がある
- When: cleanup、retry、rollback を行う
- Then: 対象を manifest で追跡し、旧 ACL や deleted content を復活させず、最小 tombstone/audit 以外の残存を検出する

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | revoke/delete と物理 cleanup の間や rollback 後に権限外内容が再露出することを防ぐために必要 |
| 十分性 | OK | authorization/classification/usage/quality/lifecycle の authoritative deny、全利用経路への反映、派生物 cleanup、retry/rollback invariant を扱う |
| 理解容易性 | OK | deny を先に確定し cleanup を後続させる順序と対象経路を明示した |
| 一貫性 | OK | account revoke は `FR-058`、retrieval recheck は `FR-070`、index/ingest recovery は `FR-072` / `FR-083` に分離した |
| 標準・契約適合 | OK | RAG ガイドの revocation propagation と旧 index でも current deny を維持する原則に適合する |
| 実現可能性 | OK | tombstone、policy version、outbox、purge ledger、reconciliation で実現できる |
| 検証可能性 | OK | revoke/delete 中の concurrent search、old index/cache/session/worker 否定試験で確認できる |
| ニーズ適合 | OK | 共有解除や削除を行った利用者の意図を、処理途中を含め即時に保護境界へ反映する |
| 原子性 | OK | revocation の適用順序を規定する |
| 実装適合 | OK（confirmed） | authoritative deny 後に11 scope の tenant-scoped cleanup manifest を登録し、source/account/role/group/archive/delete/failed-ingest trigger、retry/residual/superseded-deny safety を coordinator と direct tests が検証する |
| 合意 | pending | purge/retention/restore と伝播 SLO は未確定 |

## トレース

- 後方: `GAP-RD-016`, `GAP-RD-017`, delete/share reports、RAG ガイド PDF pp.81,188–189,205。
- 前方: tombstone/outbox/reconciliation、`SQ-005`, `SQ-006`。
