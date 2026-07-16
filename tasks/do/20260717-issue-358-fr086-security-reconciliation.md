# Issue #358: FR-086 resource-group membership reconciliation（Phase 1）

- 状態: do
- 対象: Issue #358 / FR-086 / AC-FR086-001〜003
- ブランチ: `codex/issue-358-fr086-security-reconciliation`
- 起点: PR #375 final head `01ff8b75`

## 変更前の gap

共通 security mutation audit outbox は document share/move/delete、resource group lifecycle/membership、administrative principal transfer、application role、source governance で利用されている。一方、production reconciliation worker に登録される authoritative resolver は source governance だけであり、他の pending intent は worker が一意に解決できない。

## Phase 1 受け入れ条件

- [x] outboxを発行するcurrent production mutationをtarget type / operation / authoritative store / recovery boundaryのmatrixで固定する。
- [x] resource-group `membership.replace` pending intentをtenant-scoped authoritative stateから解決できるproduction resolverを追加する。
- [x] stateがbefore/proposedAfterのどちらにも一致しない、targetが不明、cross-tenant、stale/corrupt intentはfail closedにする。
- [x] success/denied/conflict/failedのrequested completionとauthoritative stateが矛盾する場合はfinalizeしない。
- [x] duplicate worker / retryはCASによりaudit event 1件へ収束する。
- [x] resource-group membership以外の未登録resolverと、retry上限・隔離・batch継続を後続taskとして明示し、FR-086全体を完了扱いにしない。
- [x] worker/dependencies/IAMが必要最小のtenant・store権限に限定され、route-level authorizationを迂回しないことを確認する。
- [ ] API security policy test、targeted/full test、lint、typecheck、docs checks、final-head CIを確認する。
- [x] benchmark期待語句、QA sample固有値、dataset固有分岐をproduct runtimeへ追加しない。
- [ ] 日本語draft PR、AC comment、self-review、task/report lifecycleを完了する。
- [x] merge / deploy / releaseを実施しない。

## 実施計画

1. current outbox producerと既存domain recovery/fenceを棚卸しし、authoritative readに必要なportを限定する。
2. crash位置ごとにpending/finalization_pendingとdomain stateの組合せをcharacterization testへ固定する。
3. resolver registryとworker wiringを拡張し、tenant逸脱・unknown・ambiguous・corruptを拒否する。
4. resolver未登録targetとpoison intent isolationを後続Phaseへ分割する。
5. FR-086、coverage、API generated docsを同期し、最小十分な検証からfull CIへ進む。

## セキュリティ境界

reconciliation workerはcaller入力を権限根拠にせず、設定済みtenantとauthoritative storeを再確認する。before/afterへtoken、secret、本文を追加せず、resolverはmutationを再実行せず監査確定だけを行う。

## Current producer / resolver matrix

| target / operation | authoritative state / recovery marker | production resolver |
| --- | --- | --- |
| `source / source_governance.*` | source governance record + audit reconciliation marker | 既存（confirmed） |
| `resourceGroup / membership.replace` | tenant-scoped `GroupMembershipStore` state | 本Phaseで追加 |
| `resourceGroup / create, update, delete` | `UserGroupStore` + lifecycle intent | 後続 |
| `folder / share.replace, move, delete` | folder policy/group + move/archive intent | 後続 |
| `document / share.replace, move, revoke.delete` | grant/manifest + move/delete intent | 後続 |
| `administrativePrincipal / ownership.transfer` | transfer state/fence + authoritative inventory | 後続 |
| `applicationRolePrincipal / applicationRole.replace` | Cognito identity + mutation lock | 後続 |

継続失敗のretry上限・quarantine・1件のpoison intentでbatch全体を停止させない境界も後続Phaseで扱う。

## 検証結果（PR作成前）

- membership resolver / worker targeted tests: 成功
- access-control static policy / requirements coverage: 成功。初回はguard profile環境変数なしで起動前failし、repository test scriptと同じ環境を指定して再実行後成功
- API full suite: 811 tests / 811 pass / 0 fail
- API / infra typecheck、API / infra build: 成功
- root full lint: 成功（`npm run lint -w @memorag-mvp/api` はworkspaceにlint scriptがなく失敗したため、正規root scriptで再実行）
- infra full test: 38 / 38成功。初回はbuildとtestの同時bundleでasset競合し14件失敗、単独再実行後はsnapshotのみ期待差分、snapshot更新後に更新フラグなしで38 / 38成功
- CloudFormation snapshot: workerへdocument-groups table/indexの`dynamodb:GetItem` / `dynamodb:Query`だけを追加
- OpenAPI / source-backed API docs / canonical docs / hidden Unicode: 成功
- infra inventory: PR初回CIでworker IAM追加に対するgenerated inventory staleを検出。正規generatorでIAM policy / resource inventoryを更新し、check再実行後に成功
- product runtime source audit: dataset-specific branch 0件
- `git diff --check`: 成功
- `npm ci`: 成功（既存8 vulnerabilitiesを報告）
- PR初回CI: infra inventory staleのため失敗（run `29516680418`）。generated inventoryを同期して再実行対象とした
