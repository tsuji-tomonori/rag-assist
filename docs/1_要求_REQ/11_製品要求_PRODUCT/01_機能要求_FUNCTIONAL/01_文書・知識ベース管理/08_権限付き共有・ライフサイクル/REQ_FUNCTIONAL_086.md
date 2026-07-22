# FR-086 security mutation audit

- 要件ID: `FR-086`
- 種別: `REQ_FUNCTIONAL`
- 状態: Partially Implemented（scheduled reconciliation は cost-first 方針で停止）
- 優先度: A

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `1. 文書・知識ベース管理`
- L2主機能群: `1.8 権限付き共有・ライフサイクル`
- L3要件: `FR-086`
- 関連カテゴリ: `8. 認証・認可・管理・監査`

## 要件

- FR-086: share policy/grant、resource group membership、owner/adminPrincipal 移管、classification/usage/quality approval、move、delete、account、role の security-impacting mutation を処理するとき、システムは共通 schema の監査 intent/event を mutation と相関可能な形で永続化すること。
- mutation の成功可否に必須な synchronous audit intent は維持する。
- 現行 MVP では、未完了 intent を探すために1分ごとに S3 prefix を全列挙する automatic reconciliation を行わない。障害時の再調整は対象 intent ID を明示した保守手順、または将来の event-driven queue/index consumer に限定する。
- recurring reconciliation を再導入する場合は `SQ-015` の cost ceiling、空キュー時ゼロ LIST、bounded retry/dead-letter、owner 承認を必須とする。

## 監査 event / intent の必須フィールド

| Field | 内容 |
| --- | --- |
| actor | verified user/service/system principal identifier |
| tenant | decision と target が属する authoritative tenant identifier |
| target | target type と immutable target identifier |
| before | mutation 判定直前の relevant security state |
| after | commit 後 state。非成功時は未変更であることを表す state |
| reason | caller supplied reason または system-generated decision reason |
| result | `success`, `denied`, `conflict`, `failed` などの正規化結果 |
| policy version | 認可・共有 decision に適用した version identifier |

秘密値、token、文書本文は before/after に保存せず、監査に必要な識別子と変更フィールドへ限定する。

## mutation と監査の確定規則

- 成功結果では、authoritative state と監査 event またはその durable publication intent が相関可能な確定単位で保存されなければならない。
- audit intent の最終 event 化に失敗した場合、対象 state は `reconciliation_required` 等の非通常状態として残し、成功を偽装しない。
- 現行 cost-first mode は pending intent の周期的 discovery/finalization を実行しない。運用者は対象 ID を指定して再調整するか、mutation を再試行する。

## 根拠と意図

共有、membership、管理主体移管、classification/usage/quality approval、移動、削除、account、role は同じ権限漏えい・喪失や不適格 evidence 公開の原因になり得るため、synchronous durable intent は有用である。一方、全 tenant の intent と authoritative state を毎分列挙する方式は、未処理が0件でも継続的な S3 LIST/GET を発生させる。2026-07-22 の owner 判断により、監査記録の生成は残し、常時 polling reconciliation は費用上限を満たす再設計まで延期する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-086` |
| 説明 | security mutation の durable audit intent。scheduled full-prefix reconciliation は対象外 |
| 根拠 | 権限変更の追跡と説明責任を残しつつ、アイドル時の継続課金を避ける |
| 源泉 | RAG ガイド（PDF pp.188–189）、requirements baseline、owner cost-first decision 2026-07-22 |
| Actor / trigger | security-impacting mutation の success/denied/conflict/failed、明示的な repair operation |
| 種類 | 機能要求 / security audit / cost constraint |
| 依存関係 | `FR-056`, `FR-057`, `FR-076`, `FR-078`, `FR-081`, `FR-085`, `SQ-015` |
| 衝突 | continuous audit convergence と空キュー時ゼロ recurring S3 scan |
| 受け入れ基準 | `AC-FR086-001`, `AC-FR086-002`, `AC-FR086-003` |
| 優先度 | A |
| 安定性 | Medium |
| Confidence | owner_decision |
| 所有者 | Product / Security / FinOps |
| 変更履歴 | 2026-07-11 初版、2026-07-22 scheduled reconciliation を停止 |

## 受け入れ条件

### AC-FR086-001 successful mutation audit

- Given: actor が reason と expected policy version を指定し、対象 mutation が正常に commit される
- When: API が mutation success を返す
- Then: commit 済み state と対応する actor、tenant、target、before、after、reason、result、policy version を持つ監査 event または durable intent が相関可能な形で保存済みである

### AC-FR086-002 rejected mutation audit

- Given: 対象 mutation が permission 不足、version conflict、integrity violation、処理失敗のいずれかになる
- When: API が非成功結果を返す
- Then: protected state を成功状態へ変更せず、可能な範囲で正規化 result を持つ監査 event/intention を保存する

### AC-FR086-003 explicit reconciliation

- Given: durable audit intent が `pending` または `finalization_pending` に残る
- When: 運用者が tenant と intent ID を指定した明示 repair を実行する、または承認済み event-driven consumer が対象 ID を受信する
- Then: authoritative state を再確認し、一つの state transition と一つの audit event に収束させる。未処理件数を確認するための周期的 S3 prefix 全走査は実行しない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 原子性 | Partial | durable intent は維持。background finalization は停止 |
| 必要性 | 条件付き | mutation trace は必要。常時 polling は現行MVPでは不要 |
| 十分性 | Partial | event schema/intentionは維持。automatic convergenceは未提供 |
| 理解容易性 | OK | synchronous record と asynchronous repair を分離した |
| 一貫性 | OK | `FR-074` のRAG traceとは分離し、cost ceilingを`SQ-015`へ接続 |
| 標準・契約適合 | Trade-off accepted | continuous audit convergenceよりownerのcost-first判断を優先 |
| 実現可能性 | OK | explicit ID repairまたはqueue方式へ移行可能 |
| 検証可能性 | OK | intent保存とscheduled no-opを独立testで確認できる |
| ニーズ適合 | OK |説明責任の基礎を残しながらMVP予算を優先する |
| 実装適合 | Partial（confirmed） | mutation services/outboxは維持。EventBridge consumerはtenant検証後zero resultを返しS3を列挙しない |
| 合意 | confirmed | 2026-07-22 ownerがscheduled reconciliation不要を決定 |

## トレース

- 後方: `FR-057`, `FR-062`, `FR-065`, `FR-066`, `FR-074`, `FR-076`, `FR-085`、2026-07-22 cost investigation。
- 前方: durable audit intent、explicit repair API/CLI、将来の queue/index driven consumer、`SQ-015`。
