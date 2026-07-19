# Issue #358 FR-086 resource-group delete reconciliation 作業レポート

## 受けた指示

Issue #358のFR-086 production reconciliationを対象security mutationへ拡張し、検証・日本語draft PR・セルフレビューまで進める。merge / deploy / releaseは行わない。

## 要件整理と判断

resource-group deleteはmembership deny、group archive、membership/archiveの2系統のrevocation cleanup registrationを含む複合mutationである。archive済みgroupだけを見てaudit successへ確定すると、membership cleanupまたはarchive cleanup未登録の部分成功をcompleteとして誤記録する。このためdurable delete lifecycle marker、authoritative archived group、empty membership state、対象operation IDのcleanup repairとledgerをすべて再検証する。

cleanup repair/ledgerのobject keyはtenant IDそのものではなくhashを含む。CloudFormationでaccount IDからtenant hashを導出できないため、worker IAMはcleanup namespace全体の`GetObject`に限定し、runtimeでは認可済みtenant・resource・audit IDから計算したdeterministic keyだけを読む。`ListBucket`、`PutObject`、`DeleteObject`は付与しない。

## 実施作業と成果物

- `ResourceGroupDeleteAuditAuthoritativeResolver`を追加し、production workerへ登録した。
- markerのschema/kind/status/tenant/actor/audit intent/group/archive/membership/version/permission/timestampをruntime検証した。
- successは`group_archived`または`completed`、authoritative archived group完全一致、current membership空、必要なcleanup repair/ledger完全一致の場合だけ確定する。
- cleanup manifestのpolicy、tenant、operation、resource、trigger、deny version、scope、target hash、known targetを再検証し、superseded/corrupt evidenceを拒否する。
- durable terminal failureはoriginal group/membershipが不変でlive repair/ledgerがない場合だけ確定し、early null non-successはstorageを読まずに確定する。
- duplicate worker 8件を既存audit CASでevent 1件へ収束させ、resolverからgroup/membership/cleanup mutationを呼ばない。
- workerへdelete lifecycle account限定prefixとcleanup repair/ledger namespaceの`S3 GetObject`だけを追加した。
- FR-086正本文書、coverage、static policy、CloudFormation snapshot、generated infra inventoryを同期した。

## 検証

- resolver追加後のAPI full coverage: 825 / 825成功、statement/line 90.46%、branch 80.35%、function 93.01%。
- targeted resolver / access-control policy / lifecycle / requirements coverage: 成功。
- infra full testとsnapshot通常検証: 成功。
- API / infra typecheck・build、root lint: 成功。
- `task docs:check`: 成功。OpenAPI、source-backed API docs（97 APIs / 582 documents）、canonical docs、web/infra inventory、hidden Unicodeを確認した。
- product runtime source audit: dataset-specific branch 0件、artifact mismatch 0件。
- `npm ci`: 成功。既存8 vulnerabilitiesを報告。
- `git diff --check`: 成功。

失敗と修復:

- sandbox内のAPI full coverageはHTTP route 5 filesで`tsx` IPC listenが`EPERM`となった。権限委譲後に同一full commandを再実行し、825 / 825成功を確認した。
- infra初回testは意図したIAM追加によるsnapshot不一致だった。IAM差分を確認してsnapshotを更新し、更新フラグなしの通常testを成功させた。
- docs初回checkは共有cleanup coordinatorへ追加したexportによりsource-backed locatorがずれた。共有実装の変更を取り消してresolver内へread-only manifest検証を局所化し、全docs checkを再実行して成功した。

## 指示への fit 評価

resolverはroute認可、deny、archive、cleanup registrationを再実行せず、設定tenantのauthoritative marker/store/evidenceだけを読む。archiveだけで成功へ変換せず、複合mutationの全必須証跡を確認できるcrash位置だけを収束させる。

## 未対応・制約・リスク

- folder/document share・move・delete、principal transfer、application role resolverは後続Phase。
- bounded retry、quarantine、poison-intent batch isolationは後続Phase。
- cleanup namespaceのIAMはhash key方式のためtenant-exact ARNにできない。read-only actionとdeterministic runtime keyで境界を補強している。
- 実AWS S3/DynamoDB/EventBridge worker実行は未検証。local test、final-head CI、CDK synth/testを証跡にする。
- stacked baseはPR #391のbranch。Draft PR #394を作成した。
- 初期head `ad781f95` のMemoRAG CI run 29545190334はsuccess。
- PR受け入れ条件コメント: https://github.com/tsuji-tomonori/rag-assist/pull/394#issuecomment-4997869922
- PRセルフレビューコメント: https://github.com/tsuji-tomonori/rag-assist/pull/394#issuecomment-4997871149
- task/report lifecycle commit後のfinal-head CIは継続確認し、PRコメントとIssue #358へ記録する。
- Issue #358全体は未完了として維持する。
- merge / deploy / releaseは実施しない。
