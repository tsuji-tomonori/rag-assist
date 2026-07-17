# Issue #358 FR-086 folder archive cleanup repair/ledger

- 保存先: `tasks/do/20260717-2008-issue-358-next-bounded-unit.md`
- 状態: do
- タスク種別: 機能追加
- stacked base: PR #426 final head `9c771e4622b741708f06381edf8fbe266f8f4930`

## 背景

Issue #358 は全11カテゴリの要件適合を段階的な bounded unit で解消中である。直前の Draft PR #426 では FR-086 quarantine intent の tenant-scoped 手動再投入操作面まで完遂した。次に残る open work を、正本文書、Issue/PR、実装、テスト、作業レポートから再度照合し、既存 Draft PR と重複せず owner 判断なしで完遂できる最小 unit を選ぶ必要がある。

## 目的

PR #426 final head を基点に Issue #358 の残作業を RCA し、owner 判断不要かつ既存 PR と重複しない `folder/delete` producer の revocation cleanup repair/ledger hardening を完遂する。folder archive CAS、security audit intent、cleanup repair、cleanup ledger、production cleanup worker を同じ operation identity で結び、部分失敗を成功扱いしない。

## 対象範囲

- Issue #358、関連する正本 FR/NFR/SQ/TC、traceability/open question
- open Draft PR、直近の Issue #358 bounded unit、task/report との重複確認
- `FolderArchiveService` の deny-first cleanup repair/ledger 登録
- archived folder の authoritative cleanup deny と folder-scoped queued-run/cache/evaluation cleanup
- crash/race/registration failure/tenant identity の contract tests
- task/report、Draft stacked PR、PR/Issue lifecycle 証跡

対象外:

- PR #426 までに完遂した document delete resolver、quarantine redrive operation
- existing `FolderDeleteAuditAuthoritativeResolver` の domain mutation 再実行
- sibling Draft PR が所有する作業の重複実装
- owner 判断を推測した契約変更
- actual AWS/manual operation、merge、deploy、release

## 方針

1. `confirmed`、`inferred`、`conflict`、`open_question` を分離し、発生・検知・影響拡大の因果を RCA する。
2. repository evidence だけで authorization、data/compatibility、operations、acceptance contract を一意に固定できる unit を優先する。
3. 最小 rollback unit 1件に限定し、先行/並行 PR の差分と明示的に非重複であることを確認する。
4. API/security を変更する場合は route-level permission、tenant/owner boundary、response filtering、static policy、contract test を同時に固定する。
5. 実行可能な検証を省略せず、失敗時は根本原因を修正して再実行する。

## 必要情報

- base: `9c771e4622b741708f06381edf8fbe266f8f4930`（Draft PR #426 final head）
- Issue #358 の本文・最新進捗コメント
- Issue #358 関連 open PR の base/head/files/body/checks
- `docs/` の open/TBD/partial/unverified 記載と requirements trace
- `tasks/done/`、`reports/working/` の Issue #358 証跡
- `.github/pull_request_template.md`、Taskfile/package scripts の実コマンド

## RCA 初期問題文

PR #426 final head 時点でも Issue #358 は open であり、全11カテゴリのうち未完了または未検証の bounded work が残る可能性があるが、複数の stacked Draft PR が並行しているため、残作業と ownership を再照合せず実装すると重複または未確定契約の推測実装になる。

### 初期 confirmed

- PR #426 は FR-086 quarantine redrive operation を final-head CI、PR/Issue 証跡まで完遂している。
- actual AWS conditional write/schedule/duplicate delivery/manual operation は PR #426 では未検証である。
- administrative principal transfer resolver は sibling Draft PR #422 の範囲である。

### 候補比較

| 候補 | repository evidence | open PR 重複 | owner/AWS依存 | 判定 |
| --- | --- | --- | --- | --- |
| folder archive cleanup repair/ledger | FR-086 正本と PR #415 task/report が同じ欠落を明示。既存 FR-066 coordinator/worker を再利用可能 | なし | なし | 採用。最小 producer hardening |
| FR-086 administrative principal transfer | sibling Draft PR #422 final head で完遂済み | あり | なし | 不採用 |
| quarantine alarm/管理 UI | Issue コメントでは残存だが alarm threshold/operator UI acceptance が正本で未確定 | なし | owner 判断あり | 不採用 |
| actual AWS S3/EventBridge/Lambda/manual evidence | 全直近 report が未検証を明示 | なし | deploy/account/operator が必須 | 本 unit 対象外 |
| SQ threshold / production benchmark | OQ-RD-004/005/006 と owner 承認待ち | 別stackあり | owner/live workload 必須 | 不採用 |

### confirmed

- `FolderArchiveService` は empty folder を CAS で `archived` にし、共通 `folder/delete` audit intent を保存する。
- archive 前に active descendants/documents と `full` permission を確認するため、folder 自体の source/chunk/index destruction は不要である。
- 現 producer は `ObjectStoreRevocationCleanupRepairOutbox` と `ObjectStoreRevocationCleanupCoordinator` を呼ばず、cache/session/queued-run/evaluation の cleanup repair/ledger を登録しない。
- FR-066 cleanup coordinator は `folder`、`archived` trigger、11 scopes、durable repair再生を既に表現できる。
- production cleanup worker は tenant-scoped repair/ledger を処理するが、default folder deny verifier は `share_revoked` しか受け付けず、`archived` folder を authoritative に確認できない。
- resource-group archive は同型の pre-CAS repair、archive後ledger、`resource-group:<id>` targetを既に実装している。
- open Issue #358 PR の head/ownership一覧に folder archive producer cleanup hardening は存在しない。

### inferred

- operation IDを`folder-archive:<auditIntentId>`、deny versionを`folder:<archived.updatedAt>`に固定すれば、audit/repair/ledger/current DocumentGroupを一意に相関できる。
- pre-CAS repairを保存してからarchiveし、CAS失敗時だけabandoned、archive成功後のregistration failureはrepairを保持すればworkerがmanifestを再生できる。
- archived empty folderではcontent/indexを削除せず、`folder:<id>` referenceからtenant cache、folderをscopeに持つactive run、retained evaluation artifactだけを収束させるのが既存FR-066境界と一致する。

### conflict

- archive後にcleanup登録が失敗したときauditを`failed`完了すると、既にarchivedのstateと非成功eventが矛盾するため不採用。audit intentとrepairをpendingに残し、APIはsuccessを返さない。
- producerだけをhardeningしてresolverを据え置くと、post-CAS登録失敗のpending auditをcurrent archived stateだけでsuccess確定できるため不採用。resolverはdomain mutationを再実行せず、exact repair/ledgerをread-only確認する。
- folder配下contentをcleanup対象にすると「active documentなし」というarchive preconditionを超えてhistorical documentを破壊し得るため不採用。
- folderに関係した全user sessionを列挙・revokeする契約は既存manifestにprincipal集合がなくowner判断を伴うため、本unitでは既存logical session fenceを維持する。

### open_question

- actual AWS S3 conditional write、DynamoDB current read、EventBridge duplicate delivery、Lambda retry timingは未検証のまま残る。
- historical/archived document artifactのretention policyは本unitで変更しない。

### 因果と根本原因

- 発生: folder archive producer追加時、audit outbox とCAS archiveは実装されたが、FR-066 cleanup repair/ledger登録が同じcommit boundaryの前後へ接続されなかった。
- 検知: resolver task #415 のproducer監査でcleanup evidence不在が確認され、resolverはcleanup完了を主張しない安全側契約に限定された。
- 影響: archive直後もtenant cache、folder scopeのqueued run、retained evaluation evidenceがcleanup workerへ登録されず、認可はdenyしてもderived stateの収束が追跡不能になる。
- 根本原因: security-impacting mutation producer追加時に、audit resolver coverageだけでなくrevocation cleanup trigger/repair/ledger/worker deny verifierまで同時に要求するcontract testが不足していた。

### 採用する期待動作

- archiveの全validation後、CAS前にexact cleanup repairをdurable保存する。
- repair永続化失敗ではarchiveせず、auditをfailedで完了する。
- CAS conflict/failureではrepairをabandonedにし、stateとauditを既存non-success contractへ戻す。
- archive成功後はdeny committed、ledger register、cleanup registeredを順に進め、失敗時はarchiveとrepairを保持してsuccessを返さない。
- audit resolverはcurrent archived stateに加えてexact repair/ledger登録を確認し、worker recovery前のsuccess確定を拒否する。
- workerはexact archived folder identity/versionだけをcurrent denyとして認め、missing/cross-tenant/reactivated/version drift/corruptをfail closedまたはsupersededにする。
- `folder:<id>` queued referenceは同tenant runのfolder scopeだけに一致し、他folder/tenantを変更しない。

### 残存する期待動作

- cleanup registration後のactual AWS worker convergenceは通常deploy後evidenceとしてopenに保つ。

## 実行計画

1. base/head/worktree/task state を固定する。
2. Issue #358、open PR、canonical docs、task/report、実装/test を横断検索する。
3. candidate ごとに evidence、重複、owner 判断、実行可能性、rollback size を比較し、folder archive cleanupを選定する。
4. producerのpre-CAS repair/post-CAS ledger、worker archived deny/folder reference、normal/negative/crash/race testsを実装する。
5. FR-066/FR-086、coverage/source docsを同期し、targeted validation、security/docs review、repository-wide validationを行う。
6. 作業レポート、commit/push、Draft stacked PR、semver、日本語 AC/self-review を作成する。
7. implementation/final-head CI、Issue #358 進捗、clean/upstream/remote 一致まで確認する。

## ドキュメントメンテナンス計画

- `FR-066` と `FR-086` の folder archive cleanup repair/ledger、worker convergence、actual AWS open evidenceを同期する。
- API/operation/data contract を変更する場合は OpenAPI、source-backed API docs、design/operations を同期する。
- README、API examples、local verification、operations、deploy docs、AGENTS.md への影響を検索し、非該当なら PR/report に理由を記録する。
- actual AWS/manual evidence を実行しない場合は、未検証項目と残存リスクを正本文書・PR/report で一貫して明記する。

## 受け入れ条件

- [x] AC1: Issue #358 の残作業候補を canonical docs、Issue/PR、task/report、code/test から列挙し、confirmed/inferred/conflict/open_question と因果・影響範囲を記録する。
- [x] AC2: open PR の ownership と差分を照合し、folder archive producer cleanupがPR #426以前およびsibling PRと重複しないことを証拠化する。
- [x] AC3: owner判断なしで固定できる最小unitとしてpre-CAS repair/post-CAS cleanup ledger/worker archived denyを選び、scope/対象外/rollback/残存リスクを確定する。
- [x] AC4: archive成功でexact repair/ledgerが登録され、audit ID、tenant、folder、before/after version、deny timestampが一意に相関する。
- [x] AC5: repair永続化失敗はarchive前にfail closed、CAS失敗はrepair abandoned、archive後registration失敗はdurable repair/pending auditを保持してsuccessを返さない。
- [x] AC6: production cleanup workerがprepared repairを再生し、exact archived stateだけを認め、folder-scoped cache/queued-run/evaluationを他tenant/resourceへ越境せず収束する。
- [x] AC7: `FR-066`/`FR-086`、requirements coverage、必要なgenerated source docsを実装/testと同期し、README/OpenAPI/UI/infra非該当理由を記録する。
- [x] AC8: targeted tests、API typecheck/full coverage、docs/source audit、verify、repository full CI、pre-commit/diff checkを成功させる。
- [ ] AC9: work report、目的別commit、Draft stacked PR、semver:patch、日本語PR body/AC/self-reviewを完遂する。
- [ ] AC10: implementation-head/final-head remote CI、Issue #358進捗、clean worktree、HEAD/upstream/remote一致を確認する。
- [x] AC11: actual AWS/manual evidence、merge、deploy、releaseを未実施として正直に記録する。

## 検証計画

- 選定後に `git diff --name-only` で変更範囲を確認し、最小 targeted test を決定する。
- API: API typecheck、関連 unit/contract/static access policy、API full coverage。
- Web: Web typecheck、関連 component/store test、Web full coverage。
- Infra: infra typecheck/test/synth。ただし deploy/bootstrap は実行しない。
- Docs: repository-defined docs check、source-backed generation/freshness、`git diff --check`。
- Shared/cross-workspace: `task verify`、source audit、`npm run ci`、scoped pre-commit。
- remote: implementation-head と final-head の GitHub Actions success。

## PRレビュー観点

- PR whole: 1 bounded goal、stacked base、semver、rollback、report、未検証事項が明確か。
- overlap: sibling Draft PR の ownership を侵食せず、依存と統合順を説明しているか。
- docs/requirements: 正本と実装/testが同期し、confirmed と推定を混同していないか。
- security: auth、permission、tenant/owner scope、機微 response、fail-closed を弱めていないか。
- RAG quality: 根拠性・拒否・引用境界を弱めず、benchmark期待語句・QA sample固有値・dataset固有分岐を追加していないか。
- operations: actual AWS/manual evidence、deploy/release、残存 operational risk を実施済み扱いしていないか。

## 未決事項・リスク

- 決定事項: PR #426 final head からの stacked PR とし、直前 unit の変更を前提に差分を最小化する。
- 決定事項: owner 判断が必要な product/security contract は推測実装しない。
- 確認結果: open PR 一覧と canonical docs を照合し、本unitをfolder archive cleanup repair/ledgerおよびread-only audit evidence確認に確定した。
- リスク: stacked Draft PR の一部が未統合なため、候補が repository base 上では open に見えても sibling branch で実装済みの可能性がある。
- リスク: actual AWS/manual operation だけが残る場合、production/external state を変更せず完遂できないため blocker となる。
