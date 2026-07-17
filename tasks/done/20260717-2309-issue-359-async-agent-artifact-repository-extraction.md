# Issue #359 Phase 4m: async-agent artifact repository 抽出

- 状態: done
- Issue: #359
- stacked base: PR #433 / `codex/issue-359-async-agent-run-repository-extraction`
- exact base: `65aeca3630861428c671f98a3d934288a3de75fe`

## 目的・スコープ

async-agent execution全体を分断せず、artifact textのsanitization、filename/key/metadata mapping、object write、permission-revoked cleanupだけをnarrow `AsyncAgentArtifactRepository`へ抽出する。facade public API、route/RBAC/non-enumeration、4 worker authorization boundary、provider invocation、run status/save、writeback approvalは不変とする。

対象外: execute orchestration、current authorization、run repository、writeback、partial-write compensation追加、AWS/IAM、UI、merge/deploy/release。

## なぜなぜ分析

### confirmed

- facade private helperがprovider artifactsとoptional logを結合し、ID/file/key/sanitized text/size/writeback metadataを作って`objectStore.putText`する。
- keyはrun tenant hashとencoded run ID配下で、filenameはallowlist置換・先頭underscore除去・空なら`artifact.txt`である。
- permission revoke後はnewly written artifactの`storageRef`を`Promise.all(deleteObject)`で削除してからfailed runをsaveする。delete failureはfailed run saveより前にrejectする。
- persistは`Promise.all`であり、1 write failure時に既成功writeを新規cleanupしない。補償追加はbehavior/owner policy変更なので本unitでは行わない。
- `putText`、`deleteObject`、ID factory、text sanitizerだけで閉じ、broad `Dependencies`/auth/provider adapter/AWS/global configは不要。

### inferred / root cause

artifact storage mappingとpermission cleanupにrepository/port境界がなく、execution facadeがblob namespaceとmetadata projectionを直接所有しているため、tenant key・redaction・cleanup failureをexecution変更から独立して検証できない。

### open_question / decision

- partial writeのdurable cleanup/reconciliationはowner policyが必要。現行error propagationを固定し新規補償しない。
- cleanup delete failure後のrun state更新順はsecurity state machineの変更となるため維持する。
- actual S3/AWSは未実施としlocal/GitHub CIを代替扱いしない。

## 受け入れ条件

- [x] repositoryは`putText`/`deleteObject`、ID factory、text sanitizerのnarrow portsだけに依存する。
- [x] provider artifactsとnonblank logを現行順でpersistし、blank logは追加しない。
- [x] tenant-hashed/encoded run namespace、sanitized/fallback filename、artifact ID、UTF-8 byte size、default writeback statusを維持する。
- [x] same raw run IDはtenantごとに分離し、raw tenantをkeyへ出さない。
- [x] persist failureはrejectし、暗黙successや新規partial compensationを追加しない。
- [x] cleanupは渡されたstorageRefだけを削除し、delete failureを伝播してrun failure saveへ進ませない現行順序を維持する。
- [x] facade public/API/auth/provider/run/writeback/RAG/schemaは非変更で、artifact object-store helperはrepository delegateになる。
- [x] targeted/full CI、docs generation/check、source audit、diff/pre-commit、implementation-head GitHub CIが成功した。final-head CIはlifecycle push後に記録する。
- [x] Draft stacked PR #435、semver、日本語AC/self-review、report/task doneを記録した。Issue progressはfinal-head後に記録する。

## 完了証跡

- implementation commit: `e8940940`
- Draft PR: #435 / base PR #433 exact `65aeca3630861428c671f98a3d934288a3de75fe`
- AC: `issuecomment-5004282980`
- self-review: `issuecomment-5004284087`
- implementation CI: success（9m09s、run `29587939084`）

## Done条件・計画

1. repository unit testを先行追加し、narrow production moduleとfacade composition/delegateを実装する。
2. DES Phase4mとcanonical API-code docsを同期する。
3. targeted/API full/root CI/docs/source/pre-commitを成功させる。
4. implementation commit/push、Draft stacked PR、両head CI、task done/report/final comments/Issue progressを完遂する。

実施できないactual AWS/manual検証とpartial-write recovery owner decisionをPR/reportへ明記する。merge/deploy/releaseは実行しない。
