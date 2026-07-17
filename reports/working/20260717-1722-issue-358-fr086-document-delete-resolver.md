# Issue #358 FR-086 document delete 監査 resolver 作業完了レポート

## 受けた指示

PR #419 の後続となる最小 bounded unit として document delete resolver を優先し、重複しない stacked branch/worktreeで実装・検証・Draft PR・semver・受け入れ条件確認・セルフレビュー・final-head CI・Issue進捗まで進める。actual AWSを未検証のまま代替せず、merge/deploy/releaseは行わない。

## 要件整理

- exact `document/revoke.delete`、`document-revocation-policy-v1` だけを解決する。
- durable delete lifecycle、source/tombstone manifest、audit draft/requested completion、cleanup repair/ledgerを相関する。
- successはexact tombstoneまたはcleanup workerと同じsource checkpoint付きmissingだけを認める。
- marker-free preflight denied/conflictと、markerありCAS conflictをproducerの実status/evidenceに限定する。
- tombstone、cleanup、permission、repair/ledger mutationを再実行しない。
- workerの追加権限はtenant-scoped delete lifecycleのS3 GetObjectに限定する。

## 検討・判断

- producerではbenchmark cleanupの認可actorと監査actorが意図的に異なり得るため、削除後に監査actorをcurrent認可actorとして再評価しない。durable deny/tombstone/cleanup evidenceを権威とした。
- manifest missingは一般化せず、production cleanup workerがdeny継続に使うsource scope `discoveredAt` またはsource target `cleaned` checkpointがある場合だけ認めた。
- requested successはimmediate cleanup成功後にのみ保存されるが、repair/ledger identityと全registered targetも照合し、部分・別operationのcleanup証拠を採用しない。
- CAS conflictはlifecycle `prepared`、requested result `conflict`、current=requested、repair `abandoned`、cleanup ledger不存在を同時に要求した。

## 実施作業

- `DocumentDeleteAuditAuthoritativeResolver` と7 contract testsを追加。
- production reconciliation workerへresolverを登録。
- no-mutation static security guardとrequirements coverageを追加。
- security audit workerへ `document-mutations/delete/${AWS::AccountId}/*` のS3 GetObjectだけを追加。
- CDK contract、snapshot、generated infra inventoryを同期。
- FR-086 coverage tableをdocument delete confirmed、administrative principal transfer openへ更新。
- dedicated worktree/task mdを作成し、Draft stacked PR lifecycle用の証跡を準備。

## 成果物

- `apps/api/src/security/document-delete-audit-reconciler.ts`
- `apps/api/src/security/document-delete-audit-reconciler.test.ts`
- worker/security/requirements coverage更新
- CDK IAM、infra test/snapshot、generated infra inventory更新
- `REQ_FUNCTIONAL_086.md` 更新
- `tasks/do/20260717-1655-issue-358-fr086-document-delete-resolver.md`

## 検証結果

- resolverを含むAPI full test: 成功（885 tests）。sandbox内の初回はlocalhost `listen EPERM` でroute系5 fileが失敗したため、固定scriptをsandbox外で再実行して全件成功。
- infra typecheck: 成功。
- infra full test: snapshot同期後に成功（38 tests）。
- `task docs:check`: 成功。sandbox内の初回はtsx IPC socket `listen EPERM` のため、同じTaskfile commandをsandbox外で再実行。
- source audit: 成功。audit ID `sha256:eb7701f8c651f35673cac2e6de9f2ffef641e2982b88d3fef503e72c8645e4e6`、dataset-specific branch 0、artifact mismatch 0。
- `task verify`: 初回lintで未使用type import 1件を検出・修正し、再実行成功。
- `npm run ci`: 成功。API 885、Web 442、infra 38、benchmark 102を含む全workspace lint/typecheck/test/buildが成功。
- `git diff --check`: 成功。
- Web 500 kB超chunkとLambda bundle sizeの既存警告は出たが、各commandはexit 0。

## 指示への fit 評価

- exact bounded unitに限定し、#419 final headをstacked baseとしてdocument delete resolverだけを追加した。
- production resolver、read-only IAM、tests、docs、generated inventoryを同時に同期した。
- actual AWSをlocal/CDK testで代替したとは扱わず、未検証として維持する。
- merge/deploy/releaseは実施しない。

## 未対応・制約・リスク

- actual AWS S3/EventBridge/Lambdaのread visibility、duplicate delivery、retry timingは未検証。
- 物理cleanup実体の個別readbackは行わず、producer requested completionとdurable cleanup evidenceを収束証跡とする。
- valid delete後の同一document ID再利用では、exact current-state照合が過去resultを推測せずquarantineする可能性がある。
- FR-086の残存production resolver gapはadministrative principal transfer。
- Draft PR、CI evidence、最終AC/self-review、Issue進捗、task done移動はこのレポート作成後のPR lifecycleで追記する。
