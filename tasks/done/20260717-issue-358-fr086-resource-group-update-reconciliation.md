# Issue #358: FR-086 resource-group update reconciliation（Phase 2a）

- 状態: done
- 対象: Issue #358 / FR-086 / `resourceGroup.update`
- ブランチ: `codex/issue-358-fr086-resource-group-lifecycle`
- 起点: PR #386 repair head `ec9cd9d2`

## 変更前の gap

Phase 1で`resourceGroup / membership.replace`をproduction resolverへ追加したが、resource-group lifecycleの`update` pending auditはworkerに一意なresolverがなく収束しない。`create`と`delete`はgroup stateだけでなくdurable lifecycle intentとmembership/cleanup stateの確認が必要なため、本Phaseでは単一store CASで完了する`update`だけを分離する。

## 受け入れ条件

- [x] `resourceGroup / update` pending intentをtenant-scoped `UserGroupStore.get`のauthoritative stateから解決する。
- [x] current stateがproposedAfterと一致する場合だけsuccessへ確定し、beforeのままresult markerなし、before/after不一致、target不在、cross-tenant、corrupt stateはfail closedにする。
- [x] durable requested completionはcurrent authoritative stateとの一致を再確認し、矛盾時はfinalizeしない。
- [x] early lookup failureの`before: null / after: null` durable non-successは存在しないtarget stateを捏造せず確定する。
- [x] duplicate worker / retryは既存CASによりaudit event 1件へ収束する。
- [x] worker IAMは既存のdocument-groups table `GetItem`権限内に収め、route-level authorizationやmutationを再実行しない。
- [x] `create` / `delete`はlifecycle intent・membership・cleanup markerを含む後続Phaseとして明示し、FR-086全体を完了扱いにしない。
- [x] docs / coverage / access-control policy / targeted-full tests / lint / typecheck / build / implementation final-head CIを確認する。
- [x] benchmark期待語句、QA sample固有値、dataset固有分岐をproduct runtimeへ追加しない。
- [x] post-task report、日本語draft PR、AC comment、self-review、task done lifecycleを完了する。
- [x] merge / deploy / releaseを実施しない。

## 実施計画

1. `auditGroup`の永続shapeと`UserGroupStore.get`のtenant partitionをcharacterization testへ固定する。
2. update専用authoritative resolverを追加し、worker registryへ一意に登録する。
3. normal / durable failure / ambiguous / missing / corrupt / cross-tenant / duplicateを検証する。
4. FR-086 production coverageとgenerated inventoryの適用有無を同期する。
5. 選定検証、日本語PR lifecycle、final-head CIまで進める。

## Done条件

上記成果物と検証がfinal PR headに揃い、`create` / `delete`および他domain resolver・bounded retry/quarantineを未完として追跡し、merge / deploy / releaseを行わないこと。

## PR作成前の検証結果

- targeted resolver / access-control policy / requirements coverage: 3 / 3成功
- API full suite: 815 / 815成功
- API typecheck / build、root lint: 成功
- OpenAPI、source-backed API docs（97 APIs / 582 documents）、canonical docs、infra inventory: 成功
- product runtime source audit: dataset-specific branch 0件
- `npm ci`: 成功（既存8 vulnerabilities）
- Draft PR #389: https://github.com/tsuji-tomonori/rag-assist/pull/389
- implementation head `559d7dd2`: MemoRAG CI run `29518011207`成功
- AC comment: https://github.com/tsuji-tomonori/rag-assist/pull/389#issuecomment-4994604734
- self-review: https://github.com/tsuji-tomonori/rag-assist/pull/389#issuecomment-4994604999
