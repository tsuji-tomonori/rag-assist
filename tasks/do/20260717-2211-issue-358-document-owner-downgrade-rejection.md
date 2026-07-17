# Issue #358 document administrative principal downgrade rejection

- 保存先: `tasks/do/20260717-2211-issue-358-document-owner-downgrade-rejection.md`
- 状態: do
- タスク種別: セキュリティ修正
- stacked base: PR #432 final head `5f059db4d12fa39acb8319cea4c465e7443097ae`

## 背景

Issue #358 P1-Cは「documentでもowner降格entry保存を拒否し、他resourceと対称にする」と明示する。PR #432 lifecycle後の再監査で、folder policyはadministrative principalへ`permissionLevel !== "full"`のentryを拒否する一方、document shareは同principalへの`deny`だけを拒否し、`readOnly`を保存できることを確認した。

## 目的

document administrative principalを対象とするordinary direct share entryは`full`以外をversioned/legacy mutationの副作用前に拒否し、folder resourceと同じpost-state invariantへ統一する。

## 対象範囲

- `DocumentPermissionService`のversioned/legacy document share mutation validation
- owner `readOnly` / `deny` rejectionと`full` acceptanceのdirect tests
- audit/store/principal side-effect順序の確認
- FR-077/FR-085、requirements coverage、source-backed generated docsの必要範囲
- report、Draft stacked PR、local/remote CI lifecycle

対象外:

- 親folder integrityとadministrative invariantの評価順
- ownership transfer、folder policy、account lifecycleの挙動変更
- owner自体のinactive/cross-tenant validation変更
- actual data migration、AWS/manual operation、merge、deploy、release

## RCA

### confirmed

- Issue #358本文がdocument owner降格entry保存拒否を明示する。
- `FolderPermissionService.saveFolderPolicy`はadministrative principalの`permissionLevel !== "full"`を拒否する。
- `DocumentPermissionService.replaceVersionedDocumentSharePolicy`のpost-state checkはowner `deny`だけを拒否する。
- legacy `replaceDocumentShareGrants`と`validateSharePrincipals`もowner `deny`だけを拒否する。
- effective permission計算ではpersonal owner/admin principalをmandatory fullとして扱うため、owner `readOnly` entryは権限を実効的に下げないが、保存policyとmandatory authorityが矛盾する。
- open Issue #358 PRにこのgapを所有するbranch/titleはない。

### inferred

- ownerを対象とするordinary direct entryは`full`だけを許可すれば、mandatory administrative authorityと保存policyが一致し、folder policyと対称になる。
- owner `full` entry自体は冗長でも、既存caller互換を保ち明示policyとして許可できる。

### conflict

- owner `readOnly`を黙って`full`へ昇格するとcallerが送ったcomplete-state policyを改変するため不採用。
- effective permissionでfullになることだけを理由に保存を許すとpolicy/audit/reconciliation evidenceが矛盾するため不採用。
- owner entryをすべて禁止すると既存owner `full` policyとの互換を不要に破壊するため不採用。

### open_question

- actual legacy ledgerにowner `readOnly` entryが存在するか、そのmigration/repair ownerは未確認。
- read pathで既存owner downgrade entryをunavailable扱いにするかはdata migrationと可用性判断を伴うため本unit外である。

### 因果と根本原因

- 発生: document owner protectionがexplicit deny対策として実装され、folder側の一般的なadministrative-principal downgrade invariantへ追随しなかった。
- 検知: Issue #358本文とPR #432後のcross-resource policy validation比較で確認した。
- 影響: effective authorityはfullでも、保存policy/audit/reconciliationがownerをreadOnlyと表現し、post-state invariantと証跡の整合性を失う。
- 根本原因: administrative principal invariantをresource共通の「full以外拒否」ではなくdocument固有の「denyのみ拒否」として重複実装したこと。

## 採用する期待動作

- document administrative principalをtargetとするuser grantは`full`だけ許可する。
- `readOnly`と`deny`はversioned/legacy mutationでstore write/audit success前にvalidation errorで拒否する。
- owner以外のprincipal、owner `full`、same-tenant/active principal、CAS/audit/cleanup contractは変更しない。
- migration/read compatibilityは本unitで推測変更しない。

## 実行計画

1. task/RCA/ACを実装前に固定する。
2. versioned/legacy validationを`full`以外拒否へ統一する。
3. readOnly/deny/full、audit/store副作用、既存principal negative matrixをdirect testする。
4. FR-077/FR-085/coverage/source docsを同期する。
5. targeted/full validation、report、commit、Draft stacked PR、two-head CI、Issue進捗、clean/remote一致を完遂する。

## 受け入れ条件

- [x] AC1: #432後のIssue/open PR/docs/code/testを再監査し、非重複かつowner判断不要の最小unitを選定する。
- [x] AC2: confirmed/inferred/conflict/open_question、因果、影響、rollback境界を実装前に記録する。
- [x] AC3: document administrative principalへの`readOnly`/`deny` entryを拒否し、`full`を許可する。
- [x] AC4: versioned/legacy mutationの両方で同じinvariantを適用する。
- [x] AC5: rejectionがgrant store write、audit success、cleanup registrationより前に成立することをtestする。
- [x] AC6: owner以外のgrant、same-tenant/active principal、CAS/audit/cleanup/effective permission contractを維持する。
- [x] AC7: FR-077/FR-085、coverage、必要なgenerated docsを同期し、README/OpenAPI/UI/infra非該当理由を記録する。
- [x] AC8: selected targeted/API coverage/docs/source audit/verify/full CI/pre-commit/diff checkを成功させる。
- [ ] AC9: work report、目的別commit、Draft stacked PR、semver:patch、日本語body/AC/self-reviewを完遂する。
- [ ] AC10: implementation/final-head CI、Issue #358進捗、clean/upstream/remote一致を最終external evidenceへ記録する。
- [x] AC11: actual AWS/manual evidence、merge、deploy、releaseを未実施として記録する。

## 検証計画

- API targeted: document permission service、document share route、requirements coverage、static access policy。
- API full: typecheck、coverage。
- docs: canonical/source-backed freshness、OpenAPI非変更確認。
- repository: `task verify`、source audit、`npm run ci`、pre-commit、diff check。
- remote: implementation head / final head GitHub Actions。

## PRレビュー観点

- owner `readOnly`と`deny`を同じdowngradeとして扱うか。
- owner `full`とowner以外の既存grantを過剰拒否していないか。
- versioned/legacyでvalidation順とaudit/store/cleanup副作用が一致するか。
- docs/test/implementationがfolderと対称のpost-state invariantを表すか。
- RAG根拠性、tenant/auth boundary、benchmark固有分岐、production mock fallbackを弱めていないか。

## リスク

- legacyにowner `readOnly` entryが存在する場合、次回complete-state replaceで明示修正が必要になる。
- stacked Draft chainが未mergeのため、本unitはPR #432 final headを前提とする。
