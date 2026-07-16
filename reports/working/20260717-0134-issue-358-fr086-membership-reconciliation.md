# Issue #358 FR-086 membership reconciliation Phase 1 作業レポート

## 受けた指示

Issue #358 の未解決要件を優先順に解消し、FR-086のproduction audit reconciliationをsource governance専用から対象security mutationへ段階的に拡張する。検証・日本語draft PR・セルフレビューまで進め、merge / deploy / releaseは行わない。

## 要件整理と判断

current outbox producerを再監査した結果、source、resource group、folder、document、administrative principal、application roleへ広がっている一方、worker resolverはsourceだけだった。1PRで全domainのrecovery stateを混在させず、Phase 1はresource-group `membership.replace`を対象とした。

resolverはmutationを再実行しない。tenant/group-scoped authoritative membershipsを監査before/proposedAfterまたはdurable requested completionと照合し、結果を証明できる場合だけaudit finalizeを行う。beforeのままresult markerがない場合、想定外state、cross-tenant、duplicate principalは推測せずfail closedにする。

## 実施作業と成果物

- `ResourceGroupMembershipAuditAuthoritativeResolver`を追加し、production workerへ登録した。
- state-write後/audit-complete前のcrash、durable non-success、early lookup failure、duplicate workers、順序差、cross-tenant、ambiguous stateをテストした。
- access-control static policyとFR-086 requirements coverageを更新した。
- workerへdocument-groups table/indexの`dynamodb:GetItem` / `dynamodb:Query`だけを追加し、Scan/書込権限がないことをinfra testへ固定した。
- CloudFormation snapshotとFR-086正本文書を同期した。
- producer/resolver matrixへ後続targetとpoison-intent isolationのopen状態を記録した。

## 検証

- membership resolver / worker targeted tests、access-control static policy、requirements coverage: 成功。
- API full suite: 811 / 811成功。
- API / infra typecheck、API / infra build、root full lint: 成功。
- infra full test: snapshot更新後、更新フラグなしで38 / 38成功。
- OpenAPI、source-backed API docs（97 APIs / 582 documents）、canonical docs、infra inventory、hidden Unicode: 成功。
- product runtime source audit: dataset-specific branch 0件。
- `git diff --check`: 成功。
- `npm ci`: 成功。既存8 vulnerabilitiesを報告。

失敗と修復:

- access-control policy testをrepository環境変数なしで直接実行してguard profile起動前fail。正規test環境を指定して再実行し成功。
- `npm run lint -w @memorag-mvp/api` はworkspaceにlint scriptがなく失敗。正規root `npm run lint`で成功。
- infra build/testを同時実行して同じ`lambda-dist`を競合更新し14件asset missing。単独再実行ではsnapshot差分1件のみとなり、意図したIAM差分を更新後、通常再実行で38 / 38成功。

## 指示への fit 評価

FR-086全体を完了扱いにせず、source以外で最初のproduction resolverを、tenant境界・fail-closed・最小IAM・自動回帰証跡とともに追加した。API routeやcaller authorizationを迂回せず、監査before/afterへtoken、secret、文書本文を追加していない。

## 未対応・制約・リスク

- resource group lifecycle、folder/document share・move・delete、principal transfer、application roleのresolverは後続Phase。
- bounded retry、quarantine、poison intentのbatch isolationも後続Phase。
- 実AWS DynamoDB/EventBridge worker実行は未検証。CDK synth/testとfinal-head CIで構成を検証する。
- final-head GitHub Actions、PR comments、task `done` lifecycleはPR作成後。
- stacked baseはPR #375 final head。merge / deploy / releaseは実施しない。
