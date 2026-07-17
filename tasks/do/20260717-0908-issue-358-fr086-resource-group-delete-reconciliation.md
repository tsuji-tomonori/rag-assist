# Issue #358: FR-086 resource-group delete reconciliation（Phase 2c）

- 状態: do
- 対象: Issue #358 / FR-086 / `resourceGroup.delete`
- ブランチ: `codex/issue-358-fr086-resource-group-delete`
- 起点: PR #391 lifecycle head `3662f880`

## 変更前の gap

resource-group deleteはmembership deny、group archive、2系統のrevocation cleanup registrationを含む複合mutationである。production audit resolverが未登録であり、group archiveだけを見てsuccessへ確定すると、membership cleanupまたはarchive cleanup未登録の部分成功をcompleteとして誤記録する。

## 受け入れ条件

- [x] `resourceGroup / delete`をtenant-scoped archived group、empty membership state、durable delete lifecycle intent、対象cleanup repair/ledgerから解決する。
- [x] delete markerのschema/kind/status/tenant/actor/auditIntentId/group/archivedGroup/memberships/membershipVersion/permission/timestampsをruntime検証する。
- [x] markerが`group_archived`または`completed`で、authoritative groupがarchivedGroupと完全一致し、current membershipsが空の場合だけ次の検証へ進む。
- [x] 元membershipがある場合はmembership cleanup repairとledger、常にarchive cleanup repairとledgerが対象auditIntentId由来のoperation ID・deny version・registration identityで`cleanup_registered`であることを必須にする。
- [x] `prepared` / `authorized` / `memberships_cleared`、missing/corrupt marker、active/missing/mutated group、non-empty membership、missing/mismatched cleanupをfail closedにする。
- [x] durable requested completionがある場合もauthoritative stateとcleanup証跡を再検証し、矛盾時はfinalizeしない。early null non-successはtarget stateを捏造しない。
- [x] duplicate workerは既存CASでaudit event 1件へ収束し、resolverはmembership/group/cleanup mutationを再実行しない。
- [x] worker IAMはdelete lifecycle markerのaccount限定prefixと、hash key方式のcleanup repair/ledger namespaceへの`GetObject`だけに限定する。runtimeはauthorized tenant・resource・audit IDからdeterministic keyだけを読み、List/Put/Deleteを付与しない。
- [ ] docs/coverage/security policy/infra snapshot+inventory、selected/full tests、lint/typecheck/build、PR comments、implementation-head CIを完了する。
- [x] 他domain resolver、bounded retry/quarantine/poison isolationを後続とし、FR-086全体を完了扱いにしない。
- [x] merge / deploy / releaseを実施しない。

## 実施計画

1. delete lifecycle markerとcleanup repair/ledgerのcanonical identityをfail closedに検証するresolverを追加する。
2. production worker wiringと最小read IAM、static policy、infra assertionを追加する。
3. partial crash、corrupt/cross-tenant、cleanup欠落、duplicate workerを自動テストで固定する。
4. FR-086 coverage/docs/generated inventoryを同期し、最小十分+full検証を行う。
5. 日本語draft PR lifecycle、task/report done commit、final-head CI、Issue #358進捗コメントまで完了する。

## Done条件

成果物と検証がfinal PR headに揃い、未検証の実AWS worker、他domain resolver、retry/quarantineを明記し、merge / deploy / releaseを行わないこと。
