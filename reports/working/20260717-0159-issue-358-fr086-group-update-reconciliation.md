# Issue #358 FR-086 resource-group update reconciliation 作業レポート

## 受けた指示

Issue #358 のFR-086 production reconciliationを対象security mutationへ段階的に拡張し、検証・日本語draft PR・セルフレビューまで進める。merge / deploy / releaseは行わない。

## 要件整理と判断

Phase 1後もresource-group lifecycleのcreate/update/deleteは未登録だった。updateは`UserGroupStore.replace`の単一CAS後のcurrent stateで結果を証明できる。一方、create/deleteはmembership、lifecycle intent、cleanup registrationを含む複合mutationであり、group stateだけから成功を推測すると部分失敗を誤確定する。このため本Phase 2aはupdateだけを独立resolverへ分離した。

## 実施作業と成果物

- `ResourceGroupUpdateAuditAuthoritativeResolver`を追加し、production reconciliation workerへ登録した。
- tenant/group identityとaudit shapeをruntimeで再検証し、missing、cross-tenant、corrupt、ambiguous、before/after不一致をfail closedにした。
- current stateがproposedAfterと一致する場合だけpendingをsuccessへ確定する。durable requested completionはcurrent stateとの一致を再確認する。
- early lookup failureは`before: null / after: null`のdurable non-successだけをtarget readなしで確定する。
- duplicate worker 8件が既存CASで監査event 1件へ収束することを固定した。
- access-control static policy、FR-086 requirements coverage、正本文書を同期した。
- 既存worker IAMのdocument-groups table `GetItem`内で動作し、追加IAMは不要と確認した。

## 検証

- targeted resolver / access-control policy / requirements coverage: 3 / 3成功。
- API full suite: 815 / 815成功。
- API typecheck / build、root lint: 成功。
- OpenAPI、source-backed API docs（97 APIs / 582 documents）、canonical docs、infra inventory: 成功。
- product runtime source audit: dataset-specific branch 0件。
- `npm ci`: 成功。既存8 vulnerabilitiesを報告。

## 指示への fit 評価

監査resolverはcaller入力をauthorityにせずtenant-scoped current groupを再読し、mutationやroute authorizationを再実行しない。証明可能なupdate結果だけを確定し、FR-086全体を完了扱いにしていない。

## 未対応・制約・リスク

- resource-group create/deleteはlifecycle intent、membership、cleanup registrationを合わせる後続Phase。
- folder/document share・move・delete、principal transfer、application role resolverは後続Phase。
- bounded retry、quarantine、poison-intent batch isolationは後続Phase。
- 実AWS DynamoDB/EventBridge worker実行は未検証。final-head CIと既存CDK構成テストを証跡にする。
- Draft PR #389: https://github.com/tsuji-tomonori/rag-assist/pull/389
- AC comment: https://github.com/tsuji-tomonori/rag-assist/pull/389#issuecomment-4994604734
- self-review: https://github.com/tsuji-tomonori/rag-assist/pull/389#issuecomment-4994604999
- implementation head `559d7dd2`のMemoRAG CI run `29518011207`は成功。task lifecycle commit後のfinal-head CIは追加確認する。
- stacked baseはPR #386。依存順収束前の単独mergeは禁止。
- merge / deploy / releaseは実施しない。
