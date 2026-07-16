# Issue #358 FR-086 resource-group create reconciliation 作業レポート

## 受けた指示

Issue #358のFR-086 production reconciliationを対象security mutationへ拡張し、検証・日本語draft PR・セルフレビューまで進める。merge / deploy / releaseは行わない。

## 要件整理と判断

resource-group createはgroup rowとinitial owner membershipを別storeへ確定する複合mutationである。groupが存在するだけでaudit successへ確定すると、membership作成前crashを成功として誤記録する。このためcurrent group、initial membership、対象audit IDに相関するdurable lifecycle intentの3点が一致し、markerが`membership_created`以降の場合だけ成功を証明する。

deleteはmembership deny、group archive、複数cleanup registrationを含み、archive stateだけでは完了を証明できないため別Phaseに残した。

## 実施作業と成果物

- `ResourceGroupCreateAuditAuthoritativeResolver`を追加し、production workerへ登録した。
- lifecycle markerのschema/kind/status/tenant/actor/audit ID/group/membership/timestampをruntimeで再検証した。
- current groupのfull identityとaudit projection、initial owner membership完全一致を必須にした。
- `prepared`/`group_created`、missing marker、audit ID不一致、cross-tenant、unexpected member、corrupt stateをfail closedにした。
- duplicate worker 8件を既存audit CASでevent 1件へ収束させた。
- workerへtenant/account限定create lifecycle prefixの`S3 GetObject`だけを追加し、List/Put/Deleteを付与しないinfra assertionを追加した。
- FR-086正本文書、coverage、static policy、CloudFormation snapshot、generated infra inventoryを同期した。

## 検証

- targeted resolver / access-control policy / requirements coverage: 3 / 3成功。
- API full suite: 819 / 819成功。
- infra full test: 38 / 38成功。
- API / infra typecheck・build、root lint: 成功。
- OpenAPI、source-backed API docs（97 APIs / 582 documents）、canonical docs、infra inventory: 成功。
- product runtime source audit: dataset-specific branch 0件。
- `npm ci`: 成功。既存8 vulnerabilitiesを報告。

失敗と修復:

- infra初回testは意図したS3 IAM追加によりsnapshot 1件だけが不一致。IAM差分を確認してsnapshotを更新し、更新フラグなしの通常testで38 / 38成功を確認した。

## 指示への fit 評価

resolverはmutationやroute authorizationを再実行せず、設定tenantのauthoritative marker/storeだけを読む。部分createを成功へ変換せず、監査結果を証明できるcrash位置だけを収束させる。

## 未対応・制約・リスク

- resource-group delete resolverは後続Phase。
- folder/document share・move・delete、principal transfer、application role resolverは後続Phase。
- bounded retry、quarantine、poison-intent batch isolationは後続Phase。
- 実AWS S3/DynamoDB/EventBridge worker実行は未検証。final-head CIとCDK synth/testを証跡にする。
- stacked baseはPR #389。PR comments、task done lifecycle、final-head CIはPR作成後。
- merge / deploy / releaseは実施しない。
