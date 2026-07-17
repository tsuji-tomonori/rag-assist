# FR-086 security mutation audit

- 要件ID: `FR-086`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `1. 文書・知識ベース管理`
- L2主機能群: `1.8 権限付き共有・ライフサイクル`
- L3要件: `FR-086`
- 関連カテゴリ: `8. 認証・認可・管理・監査`

## 要件

- FR-086: share policy/grant、resource group membership、owner/adminPrincipal 移管、classification/usage/quality approval、move、delete、account、role の security-impacting mutation を処理するとき、システムは成功、拒否、競合、失敗の各結果について共通 schema の監査 event を欠落させず、成功する state mutation と対応 event を一つの不可分な確定単位として永続化すること。

## 監査 event の必須フィールド

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

- 成功結果では、authoritative state と監査 event またはその durable publication intent が同じ commit boundary で確定しなければならない。
- 同じ commit boundary を構成できない backend では、state を外部へ成功として公開する前に rollback または durable reconciliation state へ移し、監査 event と相関できない state を active として公開してはならない。
- 拒否・競合・失敗では protected state を変更せず、非成功 event を durable に受理してから caller へ最終結果を返す。audit subsystem が受理できない場合も mutation を実行せず、成功を返してはならない。

## 根拠と意図

共有、membership、管理主体移管、classification/usage/quality approval、移動、削除、account、role は同じ権限漏えい・喪失や不適格 evidence 公開の原因になり得るが、個別 ledger だけでは横断調査と否認防止ができない。成功だけでなく拒否・競合・失敗も共通 event として残し、どの policy で何が判断されたかを再構成可能にする。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-086` |
| 説明 | security-impacting mutation の結果を横断可能にする共通 audit event |
| 根拠 | 権限変更の追跡、インシデント調査、否認防止、policy decision の再現性を確保する |
| 源泉 | RAG ガイド（PDF pp.188–189）、`docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md` の Authorization/Sharing 不変条件と `GAP-RD-022`、`ARC_ADR_004` follow-up、current document/admin audit |
| Actor / trigger | share/membership/administrative-principal-transfer/classification/usage/quality-approval/move/delete/account/role mutation が success/denied/conflict/failed のいずれかで終了するとき |
| 種類 | 機能要求 / security audit |
| 依存関係 | `FR-056`, `FR-057`, `FR-076`, `FR-078`, `FR-081`, `FR-085`, authoritative audit store |
| 衝突 | 現行 document audit は share/move に限られ result/policy version がなく、account/role audit と共通 schema ではなく、policy state と別書き込みである |
| 受け入れ基準 | `AC-FR086-001`, `AC-FR086-002`, `AC-FR086-003` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | Security / Audit / Identity Platform / Document Platform |
| 変更履歴 | 2026-07-11 初版、2026-07-17 production reconciliation coverage の段階適用状況を明記 |

## 受け入れ条件

### AC-FR086-001 successful mutation audit

- Given: actor が reason と expected policy version を指定し、共有、membership、管理主体移管、classification/usage/quality approval、move、delete、account、role のいずれかが正常に commit される
- When: API が mutation success を返す
- Then: commit 済み state と対応する actor、tenant、target、before、after、reason、`success` result、適用 policy version を持つ監査 event または durable publication intent が同じ確定単位で永続化済みである

### AC-FR086-002 rejected mutation audit

- Given: 対象の security-impacting mutation が permission 不足、version conflict、integrity violation、処理失敗のいずれかになる
- When: API が非成功結果を返す
- Then: state が確定されなかったことを示す before/after と正規化 result を含む同一必須フィールドの監査 event が永続化済みである

### AC-FR086-003 audit persistence failure

- Given: security-impacting mutation の state write は可能だが、対応する監査 event または durable publication intent を同じ確定単位で保存できない
- When: システムが mutation を確定しようとする
- Then: mutation success を返さず、state を rollback するか非 active な reconciliation state に保ち、再試行後も一つの state transition と一つの audit event に収束させる

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 原子性 | OK | security mutation 1 回につき共通 audit event を残す判断だけを規定する |
| 必要性 | OK | 高権限操作の追跡、調査、説明責任のために必要 |
| 十分性 | OK | security-impacting mutation class、4 result class、指定8フィールド、state/event の不可分確定、非成功 state、secret exclusion を含む |
| 理解容易性 | OK | 操作横断の共通 field と event 発生時点を表で明示する |
| 一貫性 | OK | `FR-074` の RAG trace と目的を分離し、`FR-085` の versioned share state を監査へ接続する |
| 標準・契約適合 | OK | accountability、tamper-evident audit、data minimization の方針に適合する |
| 実現可能性 | OK | transaction、durable publication intent、または mutation result と相関可能な event store で実現可能 |
| 検証可能性 | OK | 操作×結果の matrix、必須 field schema、audit-write failure injection、state/event correlation で検証できる |
| ニーズ適合 | OK | 管理者・監査担当が権限変更の主体、対象、理由、結果を横断調査できる |
| 実装適合 | Partial（confirmed / open） | 共通 outbox と各 producer は存在する。production worker の authoritative resolver は source governance、resource-group membership、resource-group update/create/delete が confirmed。他 target と poison-intent isolation は open |

## Production reconciliation coverage

| target / operation | 状態 | 根拠 |
| --- | --- | --- |
| `source / source_governance.approve_publish, source_governance.restrict` | confirmed | `SourceGovernanceAuditAuthoritativeResolver`。tenant-scoped source recordとdurable markerを再確認する |
| `resourceGroup / membership.replace` | confirmed | `ResourceGroupMembershipAuditAuthoritativeResolver`。tenant/group identity、current memberships、durable requested completionを照合し、mutation自体は再実行しない |
| `resourceGroup / update` | confirmed | `ResourceGroupUpdateAuditAuthoritativeResolver`。tenant-scoped current groupとbefore/proposedAfterまたはdurable requested completionを照合し、update自体は再実行しない |
| `resourceGroup / create` | confirmed | `ResourceGroupCreateAuditAuthoritativeResolver`。tenant-scoped current group、initial owner membership、audit IDに相関するdurable lifecycle intentの`membership_created`以降をすべて照合する |
| `resourceGroup / delete` | confirmed | `ResourceGroupDeleteAuditAuthoritativeResolver`。delete lifecycle intent、archived group、empty membership state、audit ID由来のmembership/archive cleanup repairとledgerをすべて照合する |
| folder/document share・move・delete、administrative principal transfer、application role | open | outbox producerとdomain recovery stateは存在するが、production workerへauthoritative resolverが未登録 |
| 継続失敗のbounded retry / quarantine / batch isolation | open | 現行reconcilerはresolver errorでtenant batchを停止するため、別Phaseで可観測かつfail-closedな隔離境界が必要 |

resource-group membership と update のpending intentは、current authoritative stateが`proposedAfter`と一致する場合のみ`success`へ確定する。createはcurrent groupだけでなく、initial owner membershipと対象audit IDに相関するdurable lifecycle intentが`membership_created`以降であることを必須とし、`prepared`/`group_created`の部分状態を確定しない。deleteは`group_archived`以降、empty membership state、対象audit ID由来のmembership/archive cleanup repairとcleanup ledgerがすべて登録済みの場合だけ確定し、archive state単独では確定しない。durable `requestedCompletion`がある場合もcurrent stateと必要なcleanup証跡の一致を再確認し、そのresultを維持する。

## トレース

- 後方: `FR-057`, `FR-062`, `FR-065`, `FR-066`, `FR-074`, `FR-076`, `FR-085`、`apps/api/src/types.ts` の current audit types。
- 前方: unified security audit schema/store、share/membership/transfer/classification/usage/quality/move/delete/account/role audit contract tests、dual-write fault injection、audit access-control tests。
