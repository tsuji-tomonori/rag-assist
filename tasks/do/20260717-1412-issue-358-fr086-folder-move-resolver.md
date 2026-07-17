# Issue #358 FR-086 folder move 監査 resolver

- 状態: do
- タスク種別: 修正
- 対象: Issue #358 P1-A / FR-086 / exact `folder/move`
- stacked base: PR #409 `codex/issue-358-fr086-document-share-resolver`

## 背景

共通 security mutation audit outbox は folder subtree move を durable intent として保存する。一方、PR #409 final head の production reconciliation worker には exact `folder/move` resolver がなく、subtree/document projection commit 後かつ audit completion 前の crash では、domain recovery marker と current folder state が確定していても audit を収束できない。

## 目的

exact `folder/move` audit intent を tenant-scoped move marker、current subtree、current verified actor、source/destination permission から authoritative に解決する。folder/path/projection mutation を再実行せず、成功、durable non-success、部分・不正・unauthorized state を fail closed に扱う。

## スコープ

- folder move authoritative resolver と production worker 登録
- move lifecycle marker、before/proposedAfter/requestedCompletion、current subtree、actor/source/destination authorization の canonical 照合
- crash/retry、duplicate worker、preflight non-success、rolled back、partial/mixed/corrupt/cross-tenant/unauthorized contract test
- move marker 用の read-only IAM
- FR-086 production coverage、requirements coverage、static security policy、infra assertion/generated inventory の同期

## 対象外

- folder move state machine、subtree/path lock、manifest/vector projection の再実行
- folder delete、document move/delete resolver
- administrative principal transfer resolver
- folder move producer/API/UI の挙動変更
- actual AWS S3/DynamoDB/Cognito/EventBridge/Lambda 実行
- merge、deploy、release

## なぜなぜ分析（RCA）

### 問題文

2026-07-17 の PR #409 final head では `folder/move` producer が common audit intent と tenant-scoped domain recovery marker を作成できる一方、worker registry に同 target/operation がなく、audit completion crash intent は resolver selection failureとして bounded retry 後に quarantine される。

### confirmed

- `FolderLifecycleMutationCoordinator.moveFolder` は exact target `folder`、operation `move`、before/proposed subtree audit state を共通 outbox に保存する。
- domain marker は production で `tenant-artifacts/<tenant-hash>/folder-mutations/move/<folder>.json` に保存され、audit intent ID、actor/tenant/folder、before/after folder snapshots、document snapshots、state machine status を保持する。
- state machine は current actor と source/destination full permission を subtree commit 前と projection convergence 前に再確認する。
- `projections_converged` は current subtree commit と affected document/vector projection convergence 後、audit completion 前の durable status である。
- `subtree_committed` / `reconciliation_pending` は document projection が未完了になり得る部分状態であり、successを確定できない。
- preflight denial/conflict は marker 作成前でも、current source before image と同じ after を持つ durable requested completion を残す。
- pre-commit failure は documents/subtree を before へ rollbackし、marker `rolled_back` と failure result を残す。
- worker は authorized tenant event、DocumentGroups table read、Cognito read を既に持つが、folder move marker S3 readは持たない。

### inferred

- pending successはmarkerのaudit ID/actor/tenant/folder相関、`projections_converged|completed`、draft before/proposed一致、current subtree=marker after、current actor active same-tenant + `folder.move` + source/destination fullをすべて必要とする。
- durable successもrequested after=current proposedをexact確認する。
- marker前のdurable non-successはcurrent sourceがcanonical preflight before/requested afterと一致する場合だけ維持できる。
- rolled-back durable non-successはmarker failure result、current subtree=marker before、draft/requested after=marker beforeを必要とする。
- administrative principal/owner/local sharing fieldsはmoveで移譲されないため、before/after snapshotで不変を要求する。
- tenant hashはCDK deploy時に静的計算できないため、IAM resourceは`tenant-artifacts/*/folder-mutations/move/*`とし、runtime authorized tenantから導出するexact keyと組み合わせる。

### open_question

- actual AWSのS3 read-after-write、DynamoDB current state visibility、Cognito timing、EventBridge duplicate deliveryは未検証。
- audit completionより後の正当なfolder/policy変更が先行した場合、exact current-state照合は推測せずretry/quarantineへ進める。
- marker statusはprojection convergenceのdurable証拠とし、resolverはmanifest/vectorを再列挙しない。

### 根本原因

folder move producer追加時に、target/operationごとのproduction resolver coverageとdomain marker read-only IAMを同時に要求するcontractがなく、generic outboxとdomain state machine/worker registry/IAMの対応が部分的なまま残った。

### 全影響範囲を覆う是正

- exact resolverでmarker、draft、current subtree、owner/admin不変、current actor/permissionを同時検証する。
- preflight failure、rolled back、success crash window、partial/mixed/corrupt/unauthorizedを自動testで固定する。
- worker registry、marker `GetObject` only IAM、static no-mutation guard、FR-086、coverage、infra/generated inventoryを同時更新する。
- folder delete、document move/delete、principal transferは別rollback unitとしてopenに保つ。

## 採用する期待動作

- markerがexact intentと相関し、statusが`projections_converged|completed`、current subtreeがfull after snapshot、current actor/source/destinationがauthorizedな場合だけpending successを確定する。
- durable successはrequested afterとcurrent proposedをexact照合する。
- marker前のdurable preflight non-successはcurrent source before imageがrequested afterと一致するときだけ維持する。
- `rolled_back` non-successはfailure result/current before/draft before/requested afterが一致するときだけ維持する。
- partial/mixed/before/third/missing/corrupt/cross-tenant/owner-transfer/unauthorized stateは推測しない。
- folder/path/projection/permission mutationは再実行しない。

## 実施計画

1. #409 final head、producer marker/state、current store、auth/IAMを固定する。
2. folder move resolverとcontract testsを追加する。
3. worker registry、read-only IAM、static/infra policy、FR-086、coverage/generated docsを同期する。
4. targetedからAPI/infra full、docs、source audit、verifyへ検証し、失敗を修復する。
5. report、commit、Draft stacked PR、AC/self-review、task done、final-head CI、Issue進捗を完遂する。

## ドキュメント保守計画

- `REQ_FUNCTIONAL_086.md` のproduction coverageにexact folder moveをconfirmedとして原子的に追記する。
- requirements coverageとgenerated infra inventoryを同期する。
- route/OpenAPI/UI/README/operationsは変更しない。IAM差分と次回通常deploy必要性はPR/reportへ明記する。

## 受け入れ条件

- [x] AC1: exact `folder/move`だけをsupportする。
- [x] AC2: markerがaudit ID/actor/tenant/folderと相関し、`projections_converged|completed`のときだけsuccess候補にする。
- [x] AC3: draft before/proposed、requested completion、marker audit state、current full subtreeをcanonicalにexact照合する。
- [x] AC4: owner/admin/local sharing identityをbefore/afterで不変にし、cross-tenant/resource/duplicate/corrupt markerを拒否する。
- [x] AC5: current verified actorがactive same-tenantで`folder.move`を持ち、source/destination fullの場合だけsuccessを確定する。
- [x] AC6: marker前のpreflight non-successと`rolled_back` non-successをcurrent before evidenceが一致するときだけ維持する。
- [x] AC7: `initialized|prepared|documents_*|subtree_committed|reconciliation_pending`、mixed/before/third/missing stateをfail closedにする。
- [x] AC8: duplicate workersが一つのimmutable completed eventへ収束する。
- [x] AC9: resolverはfolder/path/projection/auth mutationを行わず、marker IAMは`GetObject` onlyかつmove prefixだけに限定する。
- [x] AC10: worker registry、static/infra security policy、FR-086 docs、requirements coverage、generated infra inventoryを同期する。
- [x] AC11: selected targeted/API/infra/typecheck/lint/build/docs/source audit/pre-commit/diff checkが成功する。
- [ ] AC12: Draft stacked PRにbase #409、semver、IAM/redeploy、actual AWS未検証、rollback、後続resolverを記載し、日本語AC/self-review/final-head CI evidenceを残す。

## 検証計画

- resolver、worker registry、requirements coverage、static security policy targeted tests
- infra IAM targeted/full test
- API full test、API/infra typecheck、root lint/build
- `task docs:check`、source audit、`task verify`
- `git diff --check`、pre-commit、implementation/final-head GitHub Actions

## PRレビュー観点

- marker keyとstored tenant/folder/audit/actor identityがexactか
- `projections_converged`未満をsuccessにしないか
- current subtreeの一部だけがafterでもsuccessにしないか
- administrative principal/ownerをdestinationへ暗黙移譲しないか
- current actor/role/source/destination resource permissionをfail closedで確認するか
- preflight failureとrolled-back failureをsuccess/current afterと混同しないか
- resolverがdomain mutationを再実行しないか
- IAMがmove markerのGetObject onlyか
- docs/実装/test、RAG根拠性・認可境界、dataset固有分岐が同期するか

## リスク

- actual AWS S3/DynamoDB/Cognito/EventBridge/Lambdaは未検証。
- current state/policyがaudit completion前に別の正当なmutationで変化するとresolverは推測せずquarantineし得る。
- markerをprojection convergenceのdurable evidenceとし、manifest/vectorの再列挙は行わない。
- hashed tenant pathをCDK tokenから導出できないためIAMはmove-only prefix内でtenant segment wildcardを使い、runtime authorized tenant keyで境界を補強する。
- stacked chain #386→#389→#391→#394→#399→#401→#405→#409 の順序が必要。

## 検証結果（PR前）

- `node --import tsx src/security/folder-move-audit-reconciler.test.ts`: 11/11 pass。success/durable failure/partial/mixed/corrupt/document snapshot/current authorization/duplicate workerを確認した。
- `npm test -w @memorag-mvp/api`: 865/865 pass（最終実装 head）。
- `npm test -w @memorag-mvp/infra`: 5 test files pass。IAM assertionとCDK snapshotを含む。
- `npm run typecheck -w @memorag-mvp/api` / `npm run typecheck -w @memorag-mvp/infra`: pass。
- `task docs:check`: pass。CDK snapshot更新後に`task docs:infra-inventory`でgenerated inventoryを再生成した。
- `npm run rag:release:source-audit`: pass。audit ID `sha256:c5dc07964eebf01ccd913d3d8975d1c23b707ecf427d4b7ce1d81bed70d1c59c`、dataset-specific branch 0、artifact manifest mismatch 0。
- `task verify`: lint、全workspace typecheck/build pass。Web/Lambda bundle sizeの既存warningは継続。
- `git diff --check`: pass。
- `pre-commit run`: 7 hooks pass、2 hooks skip（対象ファイルなし）。
- actual AWS S3/DynamoDB/Cognito/EventBridge/Lambdaは未検証。
