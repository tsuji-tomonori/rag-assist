# Issue #358 FR-086 document share 監査 resolver

- 状態: do
- タスク種別: 修正
- 対象: Issue #358 P1-A / FR-086 / `document/share.replace`
- stacked base: PR #405 `codex/issue-358-fr086-folder-share-resolver`

## 背景

共通 security mutation audit outbox は document direct share policy の完全置換を durable intent として保存するが、PR #405 head の production reconciliation worker には document operation resolver がない。grant ledger の commit 後から audit completion 前に crash すると、tenant/document-scoped S3 state と cleanup repair が残っていても監査を収束できない。

## 目的

exact `document/share.replace` intent を current document grant ledger から authoritative に解決し、grant mutation や revocation cleanup を再実行せず、成功、durable non-success、曖昧・不正 state を fail closed に扱う。

## スコープ

- document share authoritative resolver と production worker 登録
- per-document grant file / legacy ledger、before / proposedAfter / requestedCompletion、revocation cleanup repair の canonical 照合
- duplicate worker、entry order、early failure、missing/empty/cross-tenant/corrupt/ambiguous/unsupported contract test
- authoritative grant ledger 用の authorized-tenant-scoped read-only IAM
- FR-086 production coverage、requirements coverage、static security policy、infra assertion の同期

## 対象外

- document grant の再書き込み、cleanup registration / cleanup action
- document manifest、folder policy、effective inherited permission の再計算
- folder move / delete、document move / delete resolver
- administrative principal transfer resolver
- 実 AWS S3 / EventBridge / Lambda worker 実行
- quarantine 手動解除、merge、deploy、release

## なぜなぜ分析（RCA）

### 問題文

2026-07-17 の PR #405 stacked head では `document/share.replace` producer が pending / finalization_pending intent を作成できる一方、worker registry に同 target / operation がなく、grant write 後の crash intent は resolver selection failure として bounded retry 後に quarantine される。

### confirmed

- `DocumentPermissionService.replaceVersionedDocumentSharePolicy` は targetType `document`、operation `share.replace` と before / proposed grants を共通 outbox に保存する。
- authoritative state は `documents/share-grants/<tenant>/<document>.json` に完全置換で保存され、per-document file がない legacy data は `documents/share-grants.json` に存在する。
- current version は full `DocumentShareGrant[]` の canonical hash である。
- revocation cleanup repair は `document-share:<auditIntentId>` で mutation 前に prepare され、current deny version と cleanup targets を保持する。
- group direct grant の downgrade は cleanup repair 対象になる。user direct grant は inherited permission が downgrade ceiling を上回る場合、producer が cleanup 不要として対象から除外する。
- PR #386/#389/#391/#394/#399/#401/#405 は membership、group update/create/delete、retry/quarantine、application role、folder share を実装済みで、open PR に exact document share resolver はない。
- production worker は audit/repair object read を持つが、document share grant ledger の read IAM は持たない。

### inferred

- proposedAfter は principal/type/permission の semantic state、authoritative/current と completed after は tenant/document/updatedAt を含む audit stateであるため、semantic comparison と exact completed-state comparison を分離する必要がある。
- grant ID、createdBy、reason、createdAt は共通 audit before/after に保存されないため、repair の expected-before hash は audit state から再構成できない。audit ID相関、canonical non-empty expected version、current deny version、target集合で repair identityを確認する。
- group downgrade は必ず repairを要求できる。user downgrade は inherited permission により cleanup 不要になり得るため、repairがないことだけを異常と断定せず、repairがある場合は semantic revocation の部分集合かつ完全な4 target組として厳密照合する。
- authoritative read に List/Put/Delete は不要で、authorized tenant prefix と legacy ledgerの GetObjectだけでよい。

### open_question

- 実 S3 read-after-write / version visibility、EventBridge duplicate delivery、Lambda timing は未検証。
- legacy global ledger は複数tenantを含むため、exact tenant/document rowだけを選択し、per-document fileでは全rowがexact boundary内であることを要求する。
- user downgrade cleanup不要の判断自体はproducerのeffective permission計算に依存し、resolverはmanifest/folder stateを再計算しない。

### 根本原因

document share producer追加時に、security mutation target/operationごとの production resolver coverage と authoritative read-only IAMを同時に要求するcontractがなく、generic outboxとworker registry/IAMの対応が部分的なまま残った。

### 全影響範囲を覆う是正

- exact resolverを追加し、tenant/document/principal/grant schemaをcurrent stateとdurable audit stateの双方で再検証する。
- pending、durable completion、early failure、duplicate、order差、empty/missing/cross-tenant/corrupt/ambiguousを自動testで固定する。
- revocation時はaudit ID相関repair、authoritative deny version、principal/ceilingごとの4 cleanup targetを照合する。
- worker registry、read-only IAM、static no-mutation guard、FR-086正文、requirements coverage、infra assertionを同時更新する。
- move/delete/principal transferは別rollback unitとしてopenに保つ。

## 採用する期待動作

- current canonical grant semantic stateがproposedAfterと一致するpending intentのみsuccessへ確定し、afterはcurrent authoritative audit stateを保存する。
- durable requestedCompletionはcurrent audit stateとexact一致するときだけ元result/afterを維持し、successはproposed semantic stateとの一致も要求する。
- before/afterが空配列のdurable early non-successはgrant readなしに確定する。
- current=before、第三状態、cross-tenant/resource、duplicate/corrupt grant、unsupported intentは推測しない。
- group revocationはaudit-correlated repairを必須とし、user-only revocationはrepair存在時に厳密照合する。
- grant write、cleanup registration、cleanup actionは再実行しない。

## 実施計画

1. #405 stacked base、open PR overlap、producer/store/repair/IAMを固定する。
2. document share resolver/read modelとcontract testsを追加する。
3. worker registry、read-only IAM、static/infra policy、FR-086、coverageを同期する。
4. targetedからAPI/infra full、docs、source audit、verifyへ検証し、失敗を修復する。
5. report、commit、Draft stacked PR、AC/self-review、task done、final-head CI、Issue進捗を完遂する。

## ドキュメント保守計画

- `REQ_FUNCTIONAL_086.md` のproduction coverageにdocument shareをconfirmedとして原子的に追記する。
- requirements coverageにresolver/testを追加する。
- route/OpenAPI/README/operationsは変更しない。IAM差分と次回通常deploy必要性はPR/reportへ明記する。

## 受け入れ条件

- [x] AC1: exact `document/share.replace` だけをsupportする。
- [x] AC2: current semantic grants=proposedのpending intentだけsuccessへ確定し、authoritative audit afterを保存する。
- [x] AC3: grant orderをcanonical化し、duplicate/invalid grant、tenant/document境界違反を拒否する。
- [x] AC4: durable completionはrequested after=currentの場合だけ元resultを維持し、successはproposedとも一致させる。
- [x] AC5: empty before/afterのdurable early non-successはgrant readなしに確定する。
- [x] AC6: duplicate workersが一つのcompleted eventへ収束する。
- [x] AC7: current=before、第三状態、corrupt/malformed evidence、非空proposedに対するmissing state、unsupported intentをfail closedにする。
- [x] AC8: group revocationはaudit ID相関repairを必須とし、repairのidentity/deny version/complete target集合を照合する。
- [x] AC9: resolverはgrant/cleanup mutationを再実行せず、authoritative path IAMはGetObject only、authorized tenant prefixに限定する。
- [x] AC10: worker registry、static/infra security policy、FR-086 docs、requirements coverageを同期する。
- [x] AC11: selected targeted/API/infra/typecheck/build/lint/docs/source audit/pre-commitが成功する。
- [ ] AC12: Draft stacked PRにbase #405、semver、IAM/redeploy、未検証AWS、rollback、後続resolverを記載し、日本語AC/self-review/final-head CI evidenceを残す。

## 検証計画

- resolver、worker registry、requirements coverage、static security policy targeted tests
- infra IAM targeted/full test
- API full test、API/infra typecheck、root lint/build
- `task docs:check`、source audit、`task verify`
- `git diff --check`、pre-commit、final-head GitHub Actions

## PRレビュー観点

- S3 keyとstored rowのtenant/document境界がexactか
- legacy global ledgerでunrelated tenant/resourceをauthoritative stateへ混入させないか
- proposed semantic stateとcompleted exact audit stateを混同しないか
- current=beforeをfailed/successへ推測しないか
- group/user revocationのcleanup必要条件差をproducer contractどおり扱うか
- repair targetがsemantic revocation外principalや不完全scopeを受理しないか
- grant mutation/cleanupをworkerが再実行しないか
- IAMがGetObject onlyかつauthorized tenant/legacy exact pathに限定されるか
- docsと実装、test範囲、RAG根拠性・認可境界、dataset固有分岐が同期するか

## リスク

- 実S3 consistency、EventBridge、Lambda workerは未検証。
- user-only downgradeでrepairがない場合、resolverはproducerのeffective-permission判断を再計算しない。
- current=before pendingは自動確定せずquarantineし得る。
- legacy ledger GetObjectは複数tenant dataを含むため、resolver内exact filterとdata minimizationを維持する必要がある。
- stacked chain #386→#389→#391→#394→#399→#401→#405 の順序が必要。

## 検証結果（PR前）

- `node --import tsx src/security/document-share-audit-reconciler.test.ts`: 10/10 pass。
- `npm test -w @memorag-mvp/api`: 854/854 pass（最終実装 head で再実行）。
- `npm test -w @memorag-mvp/infra`: 38/38 pass。
- `npm run typecheck -w @memorag-mvp/api` / `npm run typecheck -w @memorag-mvp/infra`: pass。
- `task docs:check`: pass。IAM snapshot 更新後に stale となった infra inventory を `npm run docs:infra-inventory` で再生成して再実行した。
- `npm run rag:release:source-audit`: pass。audit ID `sha256:381f6fdd32434d7abeb69e904330d2252db1245c0f2cdde79122eb63292fda2f`、dataset-specific branch 0。
- `task verify`: lint、全workspace typecheck/build pass。Web bundle size と Lambda bundle size の既存 warning は継続。
- `git diff --check`: pass。
- `pre-commit run`: 7 hooks pass、2 hooks skip（対象ファイルなし）。
- actual AWS S3/EventBridge/Lambda は未検証。
