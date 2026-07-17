# Issue #358 folder parent integrity mandatory deny order

- 保存先: `tasks/do/20260718-0141-issue-358-folder-parent-integrity-order.md`
- 状態: in_progress
- タスク種別: セキュリティ修正
- stacked base: PR #438 final head `16309a37c2dd36c5f04a29c9be64e3608f18e144`

## 背景

Issue #358 P1-C は「親フォルダ integrity と admin invariant の評価順を安全側へ統一する」と明示する。PR #438 lifecycle 後の read-only 監査で、`FolderPermissionService.resolveEffectiveFolderPermissionDetail` は folder 自身の tenant / lifecycle と `hasFolderCycle` を確認した後、administrative principal の `full` を早期 return し、その後で `parentGroupId` が active same-tenant parent を指すか確認していた。

深掘り監査で `hasFolderCycle` は traversal 中に parent が missing になった場合も `true` を返すため、missing parent は現状でも admin 判定前に fail closed であると確認した。一方、一覧内に存在する archived / cross-tenant parent は cycle と判定されず、active administrative principal だけが後段の parent check を迂回して `full` を得られる。非管理主体は後段の check で `none` となるため、同じ resource integrity に対する principal 別 drift が生じる。

## 目的

explicit parent reference integrity を administrative-principal invariant より先に評価し、親参照が非 active・tenant 不一致なら全 principal を `resource_integrity_unverified` で fail closed にする。missing parent の既存 fail-closed を回帰 test で固定し、root folder と active same-tenant parent を持つ folder の有効な administrative principal は従来どおり `full` とする。

## 対象範囲

- `FolderPermissionService.resolveEffectiveFolderPermissionDetail` の parent integrity と administrative-principal 判定の順序
- missing / archived / cross-tenant parent × administrative principal の direct negative tests（missing は既存挙動の回帰 control）
- root / active parent × administrative principal の positive control
- cycle / tenant / account / folder lifecycle / ordinary inheritance の回帰確認
- `FR-061` / `FR-077` の実装 evidence、requirements coverage、source-backed generated docs の必要範囲
- work report、Draft stacked PR、local / remote CI lifecycle

対象外:

- parent record の修復、migration、backfill、cross-tenant data cleanup
- administrative principal transfer、folder policy mutation、document permission の挙動変更
- public API schema、OpenAPI contract、Web UI、infra、IAM
- actual AWS / manual E2E、scanner、merge、deploy、release

## RCA

### confirmed

- Issue #358 P1-C が parent folder integrity と admin invariant の評価順を安全側へ統一する gap を明示する。
- `FR-061` AC-FR061-002 は lifecycle / tenant / integrity の mandatory deny を全 principal に適用し、mandatory deny のない adminPrincipal だけを `full` とする。
- `FR-077` AC-FR077-001 は resource lifecycle / integrity の強制 deny がない場合だけ administrative principal の `full` を保証する。
- 現行 `hasFolderCycle` は cycle に加えて traversal 中の missing parent も admin 判定前に拒否する。
- 現行 service は一覧内に存在する archived / cross-tenant parent を admin `full` の早期 return 後に評価するため、administrative principal が explicit parent check を迂回する。
- 現行 test は cycle / actor tenant mismatch × owner を検証するが、missing / archived / cross-tenant parent × owner を直接検証しない。
- open PR / branch にこの residual gap を所有する unit はなく、PR #422 の administrative-principal transfer resolver と PR #386 の membership reconciliation は対象 file を変更しない。

### inferred

- explicit parent reference integrity check を admin resolution より前へ移動すれば、正本文書が定める mandatory deny の優先順位を最小差分で実現できる。
- root folder は parent reference を持たないため新しい拒否条件の対象外であり、admin `full` を維持できる。
- active same-tenant parent は integrity 条件を満たすため、admin `full` を維持できる。

### conflict

- administrative principal を broken parent folder の修復主体として `full` にする案は、FR-061 / FR-077 の mandatory deny 優先と衝突するため不採用。
- missing parent を root とみなす案は、破損した hierarchy を暗黙補完して tenant / inheritance boundary を変えるため不採用。
- parent record を本 unit で修復・削除する案は、read-only authorization decision の範囲を越え、migration owner 判断を伴うため不採用。

### open_question

- actual data に missing / archived / cross-tenant parent を持つ active child が存在するかは未確認。
- 破損 folder の修復 owner、migration 手順、管理操作面は未確定であり、本 unit では authorization を fail closed に限定する。

### 因果と根本原因

- 発生: administrative-principal invariant を ordinary policy より先に確定する実装時、explicit parent active / tenant integrity が mandatory deny ではなく ordinary inheritance の前処理として後段に置かれた。missing parent は cycle helper が偶然包含したが、archived / cross-tenant parent は包含しなかった。
- 検知: Issue #358 の明示 residual と PR #438 後の code / test / canonical requirement の順序比較で確認した。
- 影響: archived / cross-tenant parent を持つ同じ broken folder が admin には `full`、non-admin には `none` となり、resource integrity mandatory deny が principal によって変化する。
- 根本原因: resource integrity の全条件を一つの precondition block に集約せず、cycle / missing-parent traversal と explicit parent active / tenant validation を admin 判定の前後へ分断したこと。

## 採用する期待動作

- `parentGroupId` がある folder は、対応 parent が actor tenant の一覧に存在し、same tenant かつ active である場合だけ administrative-principal 判定へ進む。
- parent が missing / archived / cross-tenant の場合、administrative principal を含む全 actor に `none` / `resource_integrity_unverified` を返す。missing は既存 `hasFolderCycle` fail-closed を維持する。
- root folder と active same-tenant parent を持つ folder の active same-tenant administrative principal は `full` を維持する。
- cycle、identity、account、tenant、folder lifecycle の既存 mandatory deny と、ordinary inheritance / explicit policy の意味は変更しない。

## Rollback 境界

- rollback は parent integrity check の移動、追加 tests、FR-061 / FR-077 evidence、生成文書を一括で戻す。
- store schema、永続 data、API schema、infra / IAM を変更しないため data rollback は不要。
- rollback 後は broken parent の administrative principal が再び `full` を得る既知の security gap が復活する。

## 実行計画

1. fresh worktree / task / RCA / AC を実装前に固定する。
2. explicit parent active / tenant integrity check を administrative-principal resolution より前へ移動する。
3. missing / archived / cross-tenant parent negative tests と root / active parent positive controlsを追加する。
4. FR-061 / FR-077、requirements coverage、source-backed generated docsを同期する。
5. targeted / full validation、report、commit、Draft stacked PR、two-head CI、Issue progress、clean / upstream / remote 一致を完遂する。

## 受け入れ条件

- [x] AC1: PR #438 後の Issue / open PR / branch / docs / code / test を read-only 監査し、非重複かつ owner 判断不要の最小 unit を選定する。
- [x] AC2: confirmed / inferred / conflict / open_question、因果、影響、rollback 境界を実装前に記録する。
- [ ] AC3: missing parent を持つ folder の administrative principal が既存 `hasFolderCycle` 経路で `none` / `resource_integrity_unverified` となることを回帰固定する。
- [ ] AC4: archived / cross-tenant parent を持つ folder の administrative principal を explicit parent integrity 経路で `none` / `resource_integrity_unverified` とする。
- [ ] AC5: root folder と active same-tenant parent を持つ folder の有効な administrative principal は `full` を維持する。
- [ ] AC6: cycle、identity、account、actor/resource tenant、folder lifecycle の mandatory deny を admin `full` より優先したまま維持する。
- [ ] AC7: non-admin の parent inheritance / explicit policy と mutation / audit / cleanup contract を変更しない。
- [ ] AC8: FR-061 / FR-077、requirements coverage、必要な generated docs を同期し、public schema / OpenAPI / UI / infra / IAM 非変更を記録する。
- [ ] AC9: targeted folder permission / requirements coverage、API typecheck / full coverage、docs check / source audit、task verify、repository full CI、pre-commit / diff check を成功させる。
- [ ] AC10: report、目的別 commit、Draft stacked PR、`semver:patch`、日本語 body / AC / self-reviewを完遂する。
- [ ] AC11: implementation / final-head CI、Issue #358 progress、clean / upstream / remote 一致を最終 external evidence へ記録する。
- [ ] AC12: actual AWS / manual evidence、migration、scanner、merge、deploy、release を未実施として記録する。

## Done 条件

- AC1〜AC12 の成果物と検証が揃い、未実施事項を pass と表現していない。
- security access-control review で mandatory deny、tenant、administrative-principal boundary を弱めていない。
- docs と実装、変更範囲に見合う tests、RAG 根拠性、dataset 固有分岐不在をセルフレビューする。
- task を `tasks/done/` へ移す lifecycle commit 後に final-head CI と外部証跡を確認する。

## 検証計画

- direct: folder permission service、requirements coverage。
- API: typecheck、full test coverage。
- docs: canonical docs、source-backed generated docs freshness、OpenAPI 非変更確認。
- repository: `task verify`、`task docs:check`、`npm run rag:release:source-audit`、`npm run ci`、`pre-commit run`、`git diff --check`。
- remote: implementation head / final head GitHub Actions。

## PR レビュー観点

- parent integrity の missing / archived / tenant mismatch が admin を含む全 principal へ mandatory deny か。
- root / valid parent admin と ordinary inheritance を過剰拒否していないか。
- public contract、store mutation、audit / cleanup、infra / IAM を不要に変更していないか。
- docs と実装、tests、generated docs が同じ優先順位を表すか。
- RAG 根拠性、tenant / auth boundary、benchmark / QA sample / dataset 固有分岐、production mock fallback を弱めていないか。

## リスク

- actual data に broken parent の active child がある場合、この変更後は修復されるまで admin を含む全利用者が操作できない。これは正本文書どおりの fail-closed 動作であり、repair / migration は別 owner decision unit とする。
- stacked Draft chain が未 merge のため、本 unit は PR #438 final head を前提とする。
