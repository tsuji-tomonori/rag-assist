# Issue #358 FR-086 quarantine 解除・手動再投入操作面

- 状態: done
- タスク種別: 機能追加
- 対象: Issue #358 P1-A / FR-086 / production audit reconciliation quarantine operation
- stacked base: PR #424 final head `cba627f18a442a4b68efd51459ef3579d7e61f42`

## 背景

FR-086 の production reconciliation は resolver と bounded retry/quarantine まで実装されたが、正本文書では quarantine された intent の解除・手動再投入操作面が open である。administrative principal transfer resolver は sibling Draft PR #422 で完遂済みであり、本タスクでは重複実装しない。

## 目的

既存の quarantine store、worker、API、認証・認可、監査基盤を RCA し、tenant-scoped authorization、audit、idempotency、fail-closed を根拠から固定できるか判定する。owner 判断なしで安全な契約を確定できる場合だけ、最小 rollback unit 1件として production-quality の操作面を実装する。確定できない場合は推測実装をせず decision/design bounded unit に切り替える。

## スコープ

- FR-086 と quarantine producer/store/worker/API/permission/audit contract の証拠確認
- confirmed / inferred / conflict / open_question を区別した RCA
- 実装可能な場合の tenant-scoped manual redrive operation 1件
- authentication、route-level permission、tenant/owner boundary、audit、idempotency、fail-closed の contract test
- static access-control policy、OpenAPI/source docs、FR-086、inventory の必要最小同期
- local/full CI、Draft stacked PR、PR/Issue lifecycle 証跡

## 対象外

- sibling PR #422 の administrative principal transfer resolver
- quarantine 原因そのものの自動修復
- 複数 intent の bulk redrive、cross-tenant 管理、quarantine delete/purge
- UI の推測実装
- actual AWS/manual operation の実行
- merge、deploy、release

## RCA 初期問題文

PR #424 final head 時点で、production reconciliation worker は解決不能 intent を bounded retry 後に quarantine へ保存するが、正本文書が要求する quarantine 解除・手動再投入の operator contract と操作面は未実装または未確定であり、運用者は fail-closed の intent を安全に再処理へ戻せない。

### confirmed

- exact document delete resolver は PR #424、administrative principal transfer resolver は sibling PR #422 に存在する。
- FR-086 は quarantine 解除・手動再投入操作面を open としている。
- quarantine は tenant-prefixed `security-audit/intents/<tenant>/<intent>.json` の同一 schema-v1 object で、`status=quarantined`、safe failure code、attempt 上限、時刻を保持する。
- outbox は tenant/intent identity と object key を照合し、S3/local object version の conditional write で state を一意に更新する。
- quarantine record は通常 `listPending` から除外され、scheduled production worker は1分ごとに tenant-scoped pending intentを既存 resolverへ渡す。
- `requestedCompletion` の有無により、quarantine 前が `finalization_pending` または `pending` のどちらだったかを一意に復元できる。
- API auth は verified identity から authoritative single tenant を付与し、`SYSTEM_ADMIN` は「システム全体の管理と復旧」を担う。一方 `ACCESS_ADMIN` は role assignment/policy read/audit export を担い、復旧操作は責務に含まれない。
- canonical role catalog は versioned であり、permission set変更は catalog version の更新対象である。
- API Lambda は既に security audit producer のため docs bucket read/writeを持ち、本操作用の追加 IAM/prefix/queue は不要である。
- sibling PR #422 は resolver/worker/read-only IAM/docsだけを変更し、quarantine store/API/permissionを変更しない。
- actual AWS/manual operation は本タスクでは実行しない。

### inferred

- quarantine recordへactor、reason、idempotency key、requestedAt、旧retry evidence、復元statusを履歴として追記し、同じCASでstatusを復元すれば、操作監査とredriveを不可分にできる。
- 同じ idempotency key を同一 actor/reason で再送した場合は保存済み履歴を返し、異なる payload や別 key の同時操作は conflict にすれば二重 redrive を防げる。
- resolver/domain mutationをAPIから直接呼ばず、status復元後は既存scheduled workerへ委譲することで、resolverのfail-closed契約を再利用できる。
- tenantはrequest bodyから受け取らずverified actorだけから取得し、別tenantのintent IDは同tenant prefixに存在しない404として扱えばenumerationを防げる。

### conflict

- 既存permissionにはaudit read/exportやdebug replayはあるが、security audit quarantine redriveと意味が一致しない。流用するとleast privilegeと説明可能性を損なうため不採用とする。
- `ACCESS_ADMIN`にも新permissionを付与する案は、同roleの既存責務がアクセスpolicy管理・監査参照でありsystem recoveryではないため不採用とする。
- quarantine objectを削除・コピー・別queueへ投入する案は、監査証跡の喪失、追加IAM、二重処理境界を作るため不採用とする。

### open_question

- actual AWS S3 conditional write visibility、1分schedule、Lambda duplicate delivery時の応答timingは未検証。
- manual redrive後も根本原因が未修復なら再び3回でquarantineする。原因修復を自動化・判定する契約は対象外。
- sibling PR #422 がstackへ未統合の間、administrative principal transfer intentはredriveしてもresolver selectionで再quarantineする。

### 因果と根本原因

- 発生: bounded retry実装はquarantineをterminal operational stateとして保存したが、schema/portにoperator transitionが定義されなかった。
- 検知・運用: `listAll`とworker resultでquarantine evidenceは残るが、認証済みoperatorが安全に再処理へ戻すAPIがない。
- 拡大防止: 通常workerがquarantineを除外するfail-closed動作は正しいため、record削除やattempt改ざんで迂回してはならない。
- 根本原因: retry/quarantine単位の初回scopeで、automatic failure containmentとmanual recoveryを別rollback unitに分け、後者のpermission/audit/idempotency contractを未定義のままopenにした。

### 採用する期待動作

- exact single-intent `POST /admin/security-audit/quarantines/{intentId}/redrive` を追加する。
- 新しい `access:audit:redrive` permission は `SYSTEM_ADMIN` だけへ割り当て、canonical catalog versionを更新する。
- actor tenant以外はbody/paramから受け取らず、intent keyとstored draft tenantを二重照合する。
- bodyはcanonicalな`idempotencyKey`と非空`reason`だけを受け取る。
- `quarantined`から、`requestedCompletion`ありなら`finalization_pending`、なしなら`pending`へ復元する。
- 同一CASでredrive履歴を追記し、旧quarantine evidenceをimmutable snapshotとして保持してからcurrent reconciliation counterをresetする。
- 同一key・同一actor/reasonはworker完了後でも同じaccepted responseへ収束し、同一keyのpayload差、別keyのconcurrent/non-quarantined requestは409とする。
- missing/cross-tenantは404、malformed requestは400、corrupt/store/CAS non-convergenceはdetailを漏らさない503とする。
- responseはintent draft/before/after/failure detailを返さず、intent ID、accepted status、idempotency key、requestedAt、redrive countだけを返す。
- APIはresolver/domain mutationを直接呼ばず、次回scheduled workerへ処理を委譲する。

## 実施計画

1. #424 final head の FR-086、worker/store、security audit、permission、API/OpenAPI/infra を証拠ベースで確認する。
2. 因果・権限・状態遷移を整理し、implementation / decision-design の gate を判定する。
3. implementation の場合は exact single-intent redrive の最小 contract と tests を先に固定し、route/service/store/infra/docs を同期する。
4. security/access-control review と targeted/full validation を行い、失敗は修正して再実行する。
5. report、commit、Draft stacked PR、semver、AC/self-review、task done、final-head CI、Issue進捗を完遂する。

## ドキュメント保守計画

- `docs/` の FR-086 正本文書と関連 API/operation design を検索し、確定した契約だけを更新する。
- route/OpenAPI を追加する場合は source-backed contract と生成物を同期する。
- UI/README/運用手順が非該当なら、理由を report/PR に記載する。

## 受け入れ条件

- [x] AC1: quarantine/manual redrive の既存事実、推定、矛盾、未確定点、根本原因、全影響範囲を RCA として記録する。
- [x] AC2: permission、tenant boundary、audit event、idempotency key/state transition、fail-closed cases を根拠から確定するか、owner 判断が必要な項目を明示して decision/design unit に切り替える。
- [x] AC3: 実装する場合、exact single-intent 操作だけを追加し、bulk/purge/domain mutation/admin-transfer を含めない。
- [x] AC4: unauthenticated、permission denied、cross-tenant、malformed/stale/quarantine missing、duplicate/concurrent request を production-quality test で固定する。
- [x] AC5: protected route を変更する場合、`access-control-policy.test.ts`、OpenAPI/source docs、response の機微情報最小化を同期する。
- [x] AC6: manual operation 自体を durable security audit に残し、audit failure 時は redrive を開始しない fail-closed contract を固定する。
- [x] AC7: redrive は既存 reconciliation 経路を再利用し、resolver/domain mutation を直接実行しない。
- [x] AC8: selected targeted/API/infra/docs/source audit/lint/typecheck/build/pre-commit/diff check と full CI が成功する。
- [x] AC9: Draft stacked PR の base が #424 branch で、semver、rollback、actual AWS/manual operation 未検証、残存リスクを日本語で記録する。
- [ ] AC10: PR の日本語 AC/self-review、task done/report、final-head CI、Issue #358 進捗、clean/upstream 一致まで完遂する。

AC10 のうち PR AC/self-review、task done/report、実装head remote CI success は確認済み。task done commit後にしか存在しない final head のCI、Issue進捗、clean/upstream一致は、PR #426 の最終top-level commentを完了証跡とする。

## 実装・検証証跡

- 実装commit: `d2fce0c4a726ffefdd72d184487637bedc7cf271`
- Draft stacked PR: https://github.com/tsuji-tomonori/rag-assist/pull/426
- base: `codex/issue-358-fr086-document-delete-resolver`（PR #424 final head）
- label: `semver:minor`
- 受け入れ条件comment: https://github.com/tsuji-tomonori/rag-assist/pull/426#issuecomment-5002392415
- self-review comment: https://github.com/tsuji-tomonori/rag-assist/pull/426#issuecomment-5002392418
- 実装head CI: https://github.com/tsuji-tomonori/rag-assist/actions/runs/29574802075 (`success`)
- local/API coverage/docs/source audit/full CI/pre-commit/diff check: 成功
- actual AWS/manual operation: 未検証

## 検証計画

- RCA 後に変更範囲から targeted command を選定する。
- API route/store/security 変更時は API typecheck/full test と static access-control policy testを必須とする。
- infra/IAM 変更時は infra typecheck/test/synth、docs変更時は `task docs:check` を実行する。
- repository-wide `task verify`、`npm run ci`、source audit、pre-commit、`git diff --check` を最終候補とする。

## PR レビュー観点

- permission と tenant boundary が UI や caller payload だけに依存していないか。
- quarantine payload や failure detail を過剰返却していないか。
- audit を redrive 後付けにして未監査操作を許していないか。
- duplicate/concurrent request が二重 enqueue や quarantine 証跡喪失を起こさないか。
- dataset/QA sample/期待語句固有分岐を追加していないか。

## リスク

- 既存 permission vocabulary または audit schema が manual operation を表現できない場合、owner 判断なしの実装は危険である。
- actual AWS の conditional write、queue delivery、operator IAM/runtime auth は local/CI だけでは検証できない。
- quarantine record に必要な immutable identity/version がない場合、safe redrive の data migration または別 ledger が必要になり得る。
