# Issue #358: FR-086 resource-group create reconciliation（Phase 2b）

- 状態: done
- 対象: Issue #358 / FR-086 / `resourceGroup.create`
- ブランチ: `codex/issue-358-fr086-resource-group-create`
- 起点: PR #389 lifecycle head `9d51e9b2`

## 変更前の gap

membership replaceとresource-group updateはproduction resolverへ追加済みだが、createはgroup createと初期owner membership作成の複合mutationである。groupが存在するだけでは部分成功をcompleteと証明できず、durable lifecycle intentもworker IAM対象外である。

## 受け入れ条件

- [x] `resourceGroup / create`をtenant-scoped current group、initial membership、durable create lifecycle intentから解決する。
- [x] lifecycle intentのtenant/group/actor/auditIntentId/group/membership identityをruntime検証し、対象audit intentと完全に相関させる。
- [x] `membership_created`以降かつcurrent group/membershipがintentと一致する場合だけpendingをsuccessへ確定する。
- [x] `prepared` / `group_created`部分状態、missing/corrupt marker、cross-tenant、unknown/corrupt state、audit ID不一致をfail closedにする。
- [x] durable requested completionはauthoritative stateと矛盾する場合finalizeしない。early null non-successはtarget stateを捏造しない。
- [x] duplicate workerは既存CASでaudit event 1件へ収束し、resolverはcreate/membership mutationを再実行しない。
- [x] worker IAMはlifecycle intent exact prefixへのS3 GetObjectだけを追加し、list/write/deleteや他tenant prefixを付与しない。
- [x] resource-group deleteはcleanup registrationを含む後続Phaseとし、FR-086全体を完了扱いにしない。
- [x] docs/coverage/security policy/infra snapshot+inventory、selected/full tests、lint/typecheck/build、PR comments、implementation-head CIを完了する。
- [x] merge / deploy / releaseを実施しない。

## 実施計画

1. create lifecycle intent schema/keyとgroup/membership audit shapeをresolver内部でfail-closedに再検証する。
2. current group、membership、markerを照合し、証明できるcrash位置だけを確定する。
3. worker wiringと最小S3 IAM、static policy、infra assertionを追加する。
4. FR-086 coverage/docs/generated infra inventoryを同期する。
5. local/full/final-head検証と日本語PR lifecycleを完了する。

## Done条件

上記成果物と検証がfinal PR headに揃い、delete・他domain resolver・bounded retry/quarantineを未完として明記し、merge / deploy / releaseを行わないこと。

## PR作成前の検証結果

- targeted resolver / access-control policy / requirements coverage: 3 / 3成功
- API full suite: 819 / 819成功
- infra full test: snapshot更新後の通常実行で38 / 38成功
- API / infra typecheck・build、root lint: 成功
- OpenAPI、source-backed API docs（97 APIs / 582 documents）、canonical docs、infra inventory: 成功
- product runtime source audit: dataset-specific branch 0件
- `npm ci`: 成功（既存8 vulnerabilities）
- infra初回testは意図したIAM snapshot差分1件だけで失敗し、snapshot更新後の通常再実行で成功

## PR lifecycle証跡

- Draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/391
- 初期head: `ca9d0bdc`
- 初期head MemoRAG CI: https://github.com/tsuji-tomonori/rag-assist/actions/runs/29543374851 （success）
- 受け入れ条件確認: https://github.com/tsuji-tomonori/rag-assist/pull/391#issuecomment-4997611149
- セルフレビュー: https://github.com/tsuji-tomonori/rag-assist/pull/391#issuecomment-4997614360
- semver: `semver:patch`
- task/report lifecycle commit後のfinal-head CIは、commit hashとrun URLをPR final commentへ追記する。
- 実AWS worker実行は未検証。resource-group delete、他domain resolver、bounded retry/quarantineは後続。
