# FR-066 共有解除・失効・削除の deny-first 伝播

- 要件ID: `FR-066`
- 種別: `REQ_FUNCTIONAL`
- 状態: Partially Implemented（scheduled cleanup は cost-first 方針で停止）
- 優先度: A

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `1. 文書・知識ベース管理`
- L2主機能群: `1.8 権限付き共有・ライフサイクル`
- L3要件: `FR-066`
- 関連カテゴリ: `3. RAG検索品質制御`, `8. 認証・認可・管理・監査`

## 要件

- FR-066: システムは、共有・account/group 権限、classification、usage constraint、quality/admission、lifecycle の変更によって資源または利用目的が不適格になった状態を、派生データの物理 cleanup より先に authoritative deny として確定し、すべての利用経路へ伝播すること。
- 現行 MVP では authoritative deny を必須とする一方、S3 prefix を定期全走査する自動 cleanup は行わない。物理 cleanup は、対象を明示した保守実行または将来の低コスト index/queue 方式に限定する。
- recurring cleanup を再導入する場合は `SQ-015` の月額・単位コスト上限、対象件数上限、空キュー時ゼロ LIST、owner 承認を先に満たすこと。

## 根拠と意図

vector/object を順番に消すだけでは途中失敗や旧 index/cache から再出現するため、最新 decision での不可視化は維持する。一方、1分ごとの S3 全 prefix 列挙は、利用者操作が無くても継続課金を生む。MVP owner の 2026-07-22 判断により、即時のアクセス拒否を残し、無条件の自動物理 cleanup はコスト上限を満たす再設計まで延期する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-066` |
| 説明 | authorization-first revocation。物理 cleanup は明示実行または低コスト方式に限定 |
| 根拠 | 剥奪直後の再露出を防ぎつつ、アイドル時の継続 S3 LIST 課金を避ける |
| 源泉 | RAG ガイド §3.5.11（PDF p.81）、§8.1.7（PDF pp.188–189）、§8.7（PDF pp.204–207）、owner cost-first decision 2026-07-22 |
| Actor / trigger | share/account/group revoke、classification/usage/quality approval change、expiry/archive/delete、index rollback |
| 種類 | 機能要求 / security / lifecycle / cost constraint |
| 依存関係 | `FR-058`, `FR-059`, `FR-072`, `SQ-006`, `SQ-015` |
| 衝突 | 全 scope の継続 cleanup と、アイドル時ゼロ recurring scan / cost-first 方針 |
| 受け入れ基準 | `AC-FR066-001`, `AC-FR066-002` |
| 優先度 | A |
| 安定性 | Medium |
| Confidence | owner_decision |
| 所有者 | Product / Security / FinOps |
| 変更履歴 | 2026-07-11 初版、2026-07-22 scheduled cleanup を cost-first で停止 |

## 受け入れ条件

### AC-FR066-001 deny-first

- Given: grant/account/group、classification、利用目的許可、quality approval、expiry/archive/delete の authoritative change により、actor/resource/use-purpose の組合せが不適格になる
- When: 操作を受理する
- Then: authoritative eligibility decision を先に deny へ変更し、物理 cleanup の有無にかかわらず該当 use-purpose の search/prompt/citation/session/worker から利用できない

### AC-FR066-002 bounded explicit cleanup

- Given: active/staged/old index、chunk、memory、cache、grant、queued run に残存候補がある
- When: owner が対象 tenant/resource/operation を明示して cleanup を実行する、または承認済み低コスト queue/index consumer が対象を受け取る
- Then: 対象を manifest で追跡し、旧 ACL や deleted content を復活させずに処理する。空キューを確認するための周期的 S3 prefix 全走査は実行しない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | 条件付き | 即時 deny は必要。無条件の常時 physical cleanup は現行 MVP では費用対効果がない |
| 十分性 | Partial | deny-first は維持。自動 cleanup、retry、residual convergence は停止 |
| 理解容易性 | OK | security boundary と物理保守を分離した |
| 一貫性 | OK | account revoke は `FR-058`、retrieval recheck は `FR-070`、cost ceiling は `SQ-015` に接続 |
| 標準・契約適合 | Trade-off accepted | continuous cleanup より owner の cost-first product decision を優先 |
| 実現可能性 | OK | synchronous deny と explicit maintenance は既存 primitive で実現可能 |
| 検証可能性 | OK | revoke直後の利用拒否と、scheduled handler の zero LIST を別々に確認できる |
| ニーズ適合 | OK | 共有解除の即時保護とMVP予算を両立する |
| 原子性 | OK | deny の適用順序は維持する |
| 実装適合 | Partial（confirmed） | authoritative deny と cleanup domain primitive は残る。EventBridge entrypoint は no-op となり tenant/manifest discoveryを行わない |
| 合意 | confirmed | 2026-07-22 owner がコスト最優先・scheduled cleanup 不要を決定 |

## トレース

- 後方: `GAP-RD-016`, `GAP-RD-017`, delete/share reports、RAG ガイド PDF pp.81,188–189,205、2026-07-22 cost investigation。
- 前方: authoritative deny tests、explicit cleanup、将来の event/index driven reconciliation、`SQ-005`, `SQ-006`, `SQ-015`。
