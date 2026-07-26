# Issue #358 document share tenant fallback fail-closed

- 保存先: `tasks/done/20260717-2126-issue-358-document-share-tenant-fail-closed.md`
- 状態: done
- タスク種別: バグ修正
- stacked base: PR #430 final head `f85902b6e607bab4ef50a03762f30a8b77562cbb`

## 背景

Issue #358 は P1-C で「`"default"` tenant 補完を grant 管理補助経路から除去する」と明示している。PR #430 lifecycle後にopen PR ownershipとcurrent codeを再監査したところ、`DocumentPermissionService` のauthorization decisionはtenant-less manifestを`resource_tenant_unresolved`で拒否する一方、share info、versioned policy read/replace、principal validation、legacy replace helperは`tenantIdForManifest`でtenant欠損を`default`へ補完していた。

## 目的

document share grant管理の全補助経路でtenant partitionの源泉を`metadata.tenantId`または`admission.tenantId`へ統一し、両方欠損・非canonical・競合時は`default` partitionへread/write/auditする前にfail closedにする。

## 対象範囲

- `DocumentPermissionService`のmanifest tenant解決
- share info/versioned policy/legacy replace/principal validationのread/write前guard
- metadata/admission tenant一致、fallback、missing/invalid/conflictのdirect tests
- FR-060/FR-062、requirements coverage、必要なsource-backed docs
- report、Draft stacked PR、local/remote CI lifecycle

対象外:

- `MemoRagService`全体のlegacy default tenant fallback撤去
-既存data migration/backfill、tenant claim/model変更
- alias compatibility、DocumentGroup全経路、UI
- actual AWS/manual operation、merge、deploy、release

## RCA

### confirmed

- Issue #358本文がgrant管理補助経路の`default` tenant補完除去を明示する。
- FR-060はserver-derived authoritative tenantをpartitionとし、tenant未指定を暗黙のdefaultとして扱わない境界を要求する。
- FR-062はdocument shareのactor/target/principalを同一tenantに限定する。
- `authoritativeManifestTenantId`はmetadata tenantを優先しadmission tenantへfallbackするが、canonicalityと両者競合は検証しない。
- `tenantIdForManifest`はmetadata tenantしか見ず、欠損時にadmission tenantではなく`default`を返す。
- share helperはこの値でper-document grant key、legacy ledger filter、audit tenant、principal directory/group lookupを選択する。
- open Issue #358 PRにこのfallbackを所有するbranch/title/filesはない。

### inferred

- metadataとadmissionの両方がcanonicalで一致する場合、または片方だけcanonicalな場合をauthoritative tenantとして扱えば、既存ingest/legacy manifest compatibilityを維持しつつ暗黙defaultを除去できる。
- 両方がcanonicalでも不一致ならresource identityが衝突しており、どちらかを推測せず拒否すべきである。

### conflict

- metadata欠損を即拒否すると、admissionにtenant evidenceを持つ正規manifestまで破壊するため不採用。
- actor tenantをresource tenantの代替にするとcaller contextで欠損resourceを補完し、FR-060のresource partition evidenceを弱めるため不採用。
-既存dataを`default`へ移行・backfillする判断はmigration/owner scopeを伴うため本unitに含めない。

### open_question

- tenant-less legacy manifestのmigration/backfillと廃止期限はowner未確定。
- `MemoRagService`等に残る別のdefault fallbackはより広いtenant migration unitとして残る。
- actual S3/DynamoDB上のlegacy object分布は未検証。

### 因果と根本原因

- 発生: direct grant ledgerがdefault tenant前提で追加され、後からadmission/metadata tenantとauthorization fail-closedが導入されたが、read/mutation helperの古いresolverが残った。
- 検知: Issue #358監査とPR #430後のproduction-path検索で、同一service内のauthorizationとgrant partitionのtenant解決差を確認した。
- 影響: tenant-lessまたはadmission-only manifestが誤ったdefault grant partitionをread/write/auditし、tenant Aのactorがresource identity欠損を介してdefault partitionへ到達し得る。
- 根本原因: manifest tenant resolutionを単一validated helperに集約せず、authorization用とgrant管理用で別実装したこと。

## 採用する期待動作

- metadata/admission tenantが両方canonicalかつ一致する場合はそのtenantを使う。
- 片方だけ存在しcanonicalならそのtenantを使う。
- missing、empty/trim不一致、metadata/admission conflictはshare grant store/audit/directoryへ触れる前にsafe validation errorで拒否する。
- actor tenantはresource tenantの代替にせず、既存authorizationでsame-tenantを確認する。
- cross-tenant ledger rowのexact filter、legacy fallback precedence、cleanup/audit contractは変更しない。

## 実行計画

1. task/RCA/ACを実装前に固定する。
2. validated manifest tenant helperへshare補助経路を統一する。
3. normal/admission fallback/missing/invalid/conflict/no-store-touchをdirect testする。
4. FR-060/FR-062/coverage/source docsの影響を同期する。
5. targeted/full validation、report、commit、Draft stacked PR、2段階CI、Issue進捗、clean/remote一致を完遂する。

## 受け入れ条件

- [x] AC1: #430後のIssue/open PR/docs/code/testを再監査し、非重複かつowner判断不要の最小unitを選定する。
- [x] AC2: confirmed/inferred/conflict/open_question、因果、影響、rollback境界を記録する。
- [x] AC3: metadata/admission tenantをcanonicalかつconflict-freeに解決し、暗黙`default` fallbackを除去する。
- [x] AC4: missing/invalid/conflict tenantでgrant store/audit/principal lookup前にfail closedする。
- [x] AC5: admission-only manifest、same tenant normal flow、cross-tenant isolation、legacy exact filterを維持する。
- [x] AC6: FR-060/FR-062、coverage、必要なgenerated docsを同期し、README/OpenAPI/UI/infra非該当理由を記録する。
- [x] AC7: selected targeted/API coverage/docs/source audit/verify/full CI/pre-commit/diff checkを成功させる。
- [x] AC8: work report、目的別commit、Draft stacked PR、semver:patch、日本語body/AC/self-reviewを完遂する。
- [ ] AC9: implementation/final-head CI、Issue #358進捗、clean/upstream/remote一致を最終external evidenceへ記録する。
- [x] AC10: actual AWS/manual evidence、merge、deploy、releaseを未実施として記録する。

## 検証計画

- API targeted: document permission service、document share route、requirements coverage、static access policy。
- API full: typecheck、coverage。
- docs: canonical/source-backed freshness、OpenAPI非変更確認。
- repository: `task verify`、source audit、`npm run ci`、pre-commit、diff check。
- remote: implementation head / final head GitHub Actions。

## PRレビュー観点

- tenant sourceをactorやdefaultで補完していないか。
- missing/invalid/conflict時にstore/audit/directoryへ副作用がないか。
- legacy admission-only compatibilityとexact tenant filteringを必要以上に破壊していないか。
- docs/test/implementationが同じtenant precedenceを表すか。
- benchmark固有分岐、mock production fallback、公開API/UI/infra変更を追加していないか。

## リスク

- tenant-less legacy manifestはshare helperで拒否されるため、実dataが存在する場合は別migrationが必要。
- stacked Draft chainが未mergeのため、本unitはPR #430 final headを前提とする。

## 完了証跡

- implementation commit: `f3396a9223116b609ec76dfe4a5707f53d35f597`
- Draft stacked PR: #432 `https://github.com/tsuji-tomonori/rag-assist/pull/432`
- base: `codex/issue-358-fr086-folder-archive-cleanup` / PR #430 final head `f85902b6e607bab4ef50a03762f30a8b77562cbb`
- semver label: `semver:patch`
- implementation-head CI: run `29581813956` success（6m39s）
- 受け入れ条件コメント: `https://github.com/tsuji-tomonori/rag-assist/pull/432#issuecomment-5003479077`
- セルフレビューコメント: `https://github.com/tsuji-tomonori/rag-assist/pull/432#issuecomment-5003479074`
- AC9はfinal evidence commit自身のremote CI、Issue progress、clean/upstream/remote一致を必要とする循環的external evidenceのため、このtask fileをdoneへ移す時点では未達のまま記録する。完了後はPR/Issue top-level commentと最終報告をauthoritative evidenceとする。
