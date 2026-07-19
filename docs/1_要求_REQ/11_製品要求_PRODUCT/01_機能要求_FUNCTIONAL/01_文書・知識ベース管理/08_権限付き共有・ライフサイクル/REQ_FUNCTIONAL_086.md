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
| 変更履歴 | 2026-07-11 初版、2026-07-17 production reconciliation coverage、bounded quarantine、tenant-scoped manual redrive の段階適用状況を明記 |

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
| 実装適合 | Partial（confirmed / external sibling / open） | 共通 outbox、各 producer、現stackのproduction resolver、bounded retry/quarantine/batch isolation、SYSTEM_ADMIN限定のtenant-scoped single-intent manual redriveはconfirmed。administrative principal transfer resolverはsibling Draft PR #422でconfirmedだが本stackへ未統合。actual AWS/manual operation evidenceはopen |

## Production reconciliation coverage

| target / operation | 状態 | 根拠 |
| --- | --- | --- |
| `source / source_governance.approve_publish, source_governance.restrict` | confirmed | `SourceGovernanceAuditAuthoritativeResolver`。tenant-scoped source recordとdurable markerを再確認する |
| `resourceGroup / membership.replace` | confirmed | `ResourceGroupMembershipAuditAuthoritativeResolver`。tenant/group identity、current memberships、durable requested completionを照合し、mutation自体は再実行しない |
| `resourceGroup / update` | confirmed | `ResourceGroupUpdateAuditAuthoritativeResolver`。tenant-scoped current groupとbefore/proposedAfterまたはdurable requested completionを照合し、update自体は再実行しない |
| `resourceGroup / create` | confirmed | `ResourceGroupCreateAuditAuthoritativeResolver`。tenant-scoped current group、initial owner membership、audit IDに相関するdurable lifecycle intentの`membership_created`以降をすべて照合する |
| `resourceGroup / delete` | confirmed | `ResourceGroupDeleteAuditAuthoritativeResolver`。delete lifecycle intent、archived group、empty membership state、audit ID由来のmembership/archive cleanup repairとledgerをすべて照合する |
| `applicationRolePrincipal / applicationRole.replace` | confirmed | `ApplicationRoleAuditAuthoritativeResolver`。verified IdP のcurrent tenant/user/account/roleをbefore/proposedAfterまたはdurable requested completionと照合し、role mutation/session revokeを再実行しない |
| `folder / share.replace` | confirmed | `FolderShareAuditAuthoritativeResolver`。tenant/folder-scoped current policyをcanonicalな完全状態としてbefore/proposedAfterまたはdurable requested completionと照合する。revocation時はaudit ID相関cleanup repairとauthoritative deny versionも要求し、policy/cleanup mutationは再実行しない |
| `document / share.replace` | confirmed | `DocumentShareAuditAuthoritativeResolver`。authorized tenant/documentのper-document grant fileまたはlegacy ledgerをread-onlyで再確認し、proposed semantic stateとcompleted audit stateを分離して照合する。group revocationはaudit ID相関cleanup repairを必須とし、user revocation repairはeffective inherited permission差を考慮して存在時に厳密照合する |
| `folder / move` | confirmed | `FolderMoveAuditAuthoritativeResolver`。authorized tenant/folderのdurable lifecycle marker、subtree/document snapshot、current full subtree、current actor/tenant/role、source/destinationの`full` permissionをread-onlyで照合する。`projections_converged`/`completed`以外の部分状態、混在状態、owner/admin/local share identity変更は確定しない |
| `folder / delete` | confirmed | `FolderDeleteAuditAuthoritativeResolver`。authorized tenant/folderのcurrent DocumentGroupとbefore/proposed/requested completionをread-onlyでcanonical照合し、successにはaudit ID相関のexact cleanup repair/ledger登録も要求する。durable non-successはcurrent beforeが一致する場合だけ元resultを確定し、archive/path/cleanup mutationは再実行しない |
| `document / move` | confirmed | `DocumentMoveAuditAuthoritativeResolver`。authorized tenant/documentのdurable lifecycle state、current manifest、current actor/role、source documentとdestination folderの`full` permissionをread-onlyで照合する。pending successは`completed`、durable success/non-successはproducerがprojection収束後に保存した`requestedCompletion`と許可status/current stateのexact一致だけを確定する |
| document delete | confirmed | exact lifecycle、tombstone、cleanup repair/ledger、source checkpointを照合するread-only resolverをproduction workerへ登録 |
| administrative principal transfer | confirmed（sibling Draft PR #422） | `AdministrativePrincipalTransferAuditAuthoritativeResolver` は sibling final head `c2f2556244496f288f0818f7234eb5cbd375fff9` で完遂済み。本stackでは重複実装しない |
| 継続失敗のbounded retry / quarantine / batch isolation | confirmed | intent本体のCASでsafe failure codeと最大3回を永続化する。上限到達時は`quarantined`へ一意に遷移して通常pending列挙から除外し、別intentの処理を同一batchで継続する |
| quarantine解除 / 手動再投入 | confirmed（local/CI） | exact single-intent APIはverified actor tenantだけを使い、`access:audit:redrive`を持つ`SYSTEM_ADMIN`だけが実行できる。actor、reason、idempotency key、policy version、旧quarantine evidence、復元statusをintent本体へ同一CASで監査追記し、既存scheduled workerへ戻す。actual AWS/manual operationは未検証 |

resource-group membership と update のpending intentは、current authoritative stateが`proposedAfter`と一致する場合のみ`success`へ確定する。createはcurrent groupだけでなく、initial owner membershipと対象audit IDに相関するdurable lifecycle intentが`membership_created`以降であることを必須とし、`prepared`/`group_created`の部分状態を確定しない。deleteは`group_archived`以降、empty membership state、対象audit ID由来のmembership/archive cleanup repairとcleanup ledgerがすべて登録済みの場合だけ確定し、archive state単独では確定しない。application roleはverified IdPのcurrent role setがproposed rolesと一致するpending intentのみsuccessへ確定し、beforeのまま、第三状態、cross-tenant、inactive、corrupt role setは推測せずretry/quarantineへ送る。folder shareはcurrent policyとcanonicalなprincipal entry完全状態がproposed policyと一致するpending intentのみsuccessへ確定し、entry順序差だけは正規化する。revocation時はaudit ID相関cleanup repairとauthoritative deny versionも要求し、duplicate principal、beforeのまま、第三状態、tenant/folder境界違反、corrupt policy、repair欠損・不整合は推測しない。document shareはauthorized tenantのper-document grant fileを優先し、未作成時だけlegacy ledgerのexact tenant/document rowsをcurrent stateにする。pending successではprincipal/type/permissionのsemantic state一致とcurrent audit afterを確定し、durable completionではcurrent audit stateをexact比較する。group revocation repairは必須、user revocationはinherited permissionによりcleanup不要になり得るためrepair存在時にsemantic revocationの部分集合として4 scope完全性を検証する。folder moveはtenant-hash配下のexact lifecycle markerとcurrent subtree全体を照合し、successは`projections_converged`/`completed`だけ、非成功はmarker-free preflight beforeまたは`rolled_back`のexact beforeだけを確定する。current actorのactive/same-tenant/`folder.move` roleとsource/destinationの`full` permissionを再評価し、部分状態、第三状態、corrupt/duplicate snapshot、identity境界違反を推測しない。folder deleteはcurrent DocumentGroupのexact tenant/folder/path/status/timestampをbefore/proposed/requested completionと照合し、pending/durable successには対象audit IDと相関する`folder-archive:<auditIntentId>` repair/ledgerのexact tenant/folder/deny version/timestamp/known targetsを追加で要求する。beforeのままのpending、第三状態、invalid transition、cross-tenant/corrupt state、repair/ledger欠損・不整合は推測しない。resolverはarchiveやcleanupを再実行せず、既存DocumentGroupsとcleanup evidenceをread-onlyで確認する。document moveはlifecycle stateのaudit/operation/tenant/document/actor/source/target identityをcanonical照合し、marker-free preflight non-success、`completed` pending success、projection収束後のdurable success/non-successだけをcurrent manifestと一致する場合に確定する。successではcurrent actorのactive/same-tenant/`rag:doc:move` roleとsource document/destination folderの`full` permissionを再評価する。部分status、requested result不一致、第三・missing・corrupt・cross-tenant、権限失効は推測しない。manifest/projection/permission mutationは再実行せず、document move stateとtenant manifestのS3 GetObjectだけを追加する。document deleteはexact `document/revoke.delete` lifecycleのaudit/operation/tenant/document/actor/source/tombstone identityをcanonical照合し、pending/durable successではcleanup repair/ledger登録とcurrent exact tombstoneを必須にする。cleanup workerがmanifestを削除済みの場合だけ、同workerと同じsource cleanup checkpointを代替証跡として認める。marker-free preflight denied/conflictはcurrent=before、markerありCAS conflictは`prepared`、current=requested、repair abandoned、cleanup ledger不存在の場合だけ元resultを確定する。監査actorは認可actorと異なり得るため削除後のcurrent permissionを誤再評価せず、deny/cleanup durable evidenceを権威とする。tombstone/cleanup/permission/repair mutationは再実行せず、document delete stateのS3 GetObjectだけを追加する。durable `requestedCompletion`がある場合もcurrent stateと必要な証跡の一致を再確認し、そのresultを維持する。folder archive producerはpre-CAS cleanup repairとpost-CAS ledgerを登録し、resolverはそのexact evidenceが揃うまでsuccessを確定しない。folder/document moveとdocument delete stateのS3読み取り、current state/cleanup evidenceのS3/DynamoDB読み取り、Cognito/EventBridge/Lambda連携はactual AWS未検証である。

resolver selection、authoritative resolution、audit completionの失敗はraw exceptionを保存せず、固定のsafe failure code、attempt count、policy上限、時刻だけをintentへCAS追記する。3回目の失敗で`quarantined`へ遷移し、通常workerは自動再試行しない。quarantineはsuccess/completedではなく未解決の運用対象であり、同一tenant batchの別intentは継続処理する。

manual redriveは`POST /admin/security-audit/quarantines/{intentId}/redrive`のexact一件だけを扱う。tenantはrequestから受け取らずverified `SYSTEM_ADMIN` actorから取得し、新しいcanonical permission `access:audit:redrive`を要求する。同じidempotency key、actor、reason、policy versionはworker完了後も同じaccepted responseへ収束し、payload差、別keyの同時操作、non-quarantined stateはconflictにする。quarantine前の`requestedCompletion`有無から`finalization_pending`または`pending`を復元し、旧reconciliation evidenceをredrive historyへimmutableに退避してcurrent attemptをresetする。operator audit追記とstatus復元は同じobject version CASで不可分にし、write失敗時はquarantineを維持する。APIはdraft/before/after/failure detailを返さず、resolver/domain mutationを直接呼ばず、1分scheduleの既存workerへ委譲する。

missing/cross-tenant intentは同じ404、malformed requestは400、non-quarantined/idempotency conflictは409、corrupt/store/CAS non-convergenceはdetailを漏らさない503にする。actual AWS S3 conditional write visibility、EventBridge schedule、Lambda duplicate deliveryと実operator操作は未検証であり、local/CIを代替evidenceとは扱わない。

## トレース

- 後方: `FR-057`, `FR-062`, `FR-065`, `FR-066`, `FR-074`, `FR-076`, `FR-085`、`apps/api/src/types.ts` の current audit types。
- 前方: unified security audit schema/store、share/membership/transfer/classification/usage/quality/move/delete/account/role audit contract tests、dual-write fault injection、audit access-control tests。
