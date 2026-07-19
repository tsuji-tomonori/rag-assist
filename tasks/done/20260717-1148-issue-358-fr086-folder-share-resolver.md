# Issue #358 FR-086 folder share 監査 resolver

- 状態: done
- タスク種別: 修正
- 対象: Issue #358 P1-A / FR-086 / `folder/share.replace`
- stacked base: PR #401 `codex/issue-358-fr086-application-role-resolver`

## 背景

共通 security mutation audit outbox は folder share policy の完全置換を durable intent として保存するが、PR #401 head の production reconciliation worker には folder operation の resolver がない。policy 永続化後から audit completion 前に crash すると、tenant-scoped `FolderPolicyStore` に確定 state が残っていても監査を収束できない。

## 目的

exact `folder/share.replace` intent を current versioned folder policy から authoritative に解決し、policy mutation や revocation cleanup を再実行せず、成功・durable non-success・曖昧/不正 state を fail closed に扱う。

## スコープ

- folder share authoritative resolver と production worker 登録
- current `FolderPolicyStore`、before / proposedAfter / requestedCompletion、revocation cleanup repair intent の canonical 照合
- duplicate worker、entry order、early failure、missing/cross-tenant/corrupt/ambiguous/unsupported の contract test
- FR-086 production coverage、requirements coverage、static security policy の同期

## 対象外

- folder policy の再書き込み、revocation cleanup の再登録
- folder move / delete resolver
- document share / move / delete resolver
- administrative principal transfer resolver
- 実 AWS DynamoDB / EventBridge / Lambda worker 実行
- quarantine 手動解除、alarm、管理 UI
- merge / deploy / release

## なぜなぜ分析（RCA）

### 問題文

2026-07-17 の PR #401 stacked head では `folder/share.replace` producer が pending / finalization_pending intent を作成できる一方、worker resolver registry に同 target / operation がなく、crash 後の intent は resolver selection failure として #399 の上限到達後に quarantine される。

### confirmed

- `FolderPermissionService.replaceVersionedFolderPolicy` は targetType `folder`、operation `share.replace`、before / proposed policy を outbox に保存する。
- authoritative policy は tenant / folder key の `FolderPolicyStore.getVersionedByFolderId` で取得できる。
- PR #386/#389/#391/#394 は resource-group、#399 は retry/quarantine、#401 は application role resolver を実装し、folder share は FR-086 文書で open のままである。
- 2026-07-17 時点の open PR 群に exact folder share resolver はない。
- reconciliation worker は既に DocumentGroups table への tenant-scoped `GetItem` / `Query` read IAM を持ち、folder policy store は同 table を使用する。

### inferred

- policy entry は完全状態であり順序に意味がないため、principal key で canonical sort して比較するのが producer の意味を保つ。
- requestedCompletion がない current=before は、失敗 result の durable 根拠がないため success / non-success を推測せず retry/quarantine に送るべきである。
- resolver は current policy と audit evidence を照合し、revocation を含む場合は mutation 前に durable 化された cleanup repair intent と現行 deny version の一致も要求する。cleanup worker / policy mutation 自体は再実行しない。

### open_question

- 実 DynamoDB read consistency、EventBridge duplicate delivery、policy write と cleanup registration / audit completion の実タイミングは未検証。
- cleanup registration failure 後の durable requestedCompletion は current policy と repair intent を確認できるが、cleanup 自体の実行は既存 cleanup worker の責務であり本 resolver の対象外である。

### 根本原因

folder share producer 追加時に、security mutation target / operation ごとの production resolver coverage を必須化する contract がなく、generic outbox と worker registry の対応が部分的なまま残った。

### 全影響範囲を覆う是正

- exact resolver を追加し、tenant / folder / policy / principal entry schema を current state と durable state の双方で再検証する。
- normal、durable non-success、early failure、duplicate、order差、missing/cross-tenant/corrupt/ambiguous を自動 test で固定する。
- revocation 時は audit intent ID に相関する cleanup repair intent と authoritative deny version を確認する。
- worker registry、static no-mutation guard、FR-086 正本文書、requirements coverage を同時に更新する。
- folder move/delete、document、principal は未実装として明示し、別 rollback unit に保つ。

## 採用する期待動作

- current canonical policy が proposedAfter と一致する pending intent のみ success として確定する。
- valid な entry 順序差は同一完全状態として扱い、duplicate principal は拒否する。
- durable requestedCompletion は current policy が requested after と一致するときだけ元 result / after を維持する。
- before=null / after=null の durable early non-success は policy read なしに確定する。
- current=before、第三状態、missing / cross-tenant / corrupt policy、revocation repair 欠損・不整合は推測せず resolution failure とする。
- policy write、cleanup registration、session/cache/run cleanup は再実行しない。

## 実施計画

1. #401 stacked base と open PR overlap を固定する。
2. folder share resolver と contract test を追加する。
3. worker registry、static policy、FR-086、coverage を同期する。
4. targeted から API full / docs / source audit / verify へ検証し、失敗を修復する。
5. report、commit、Draft stacked PR、AC / self-review、task done、final-head CI、Issue進捗を完遂する。

## ドキュメント保守計画

- `REQ_FUNCTIONAL_086.md` の production coverage に folder share を confirmed として原子的に追記する。
- requirements coverage に resolver / test を追加する。
- route / OpenAPI / README / infra / operation 手順は変更しない。既存 IAM 内の read path のため generated infra 更新不要を test / diff で確認する。

## 受け入れ条件

- [x] AC1: exact `folder/share.replace` だけを support する。
- [x] AC2: current canonical policy が proposed policy と一致する pending intent を success へ確定し、durable success も proposed state 一致を要求する。
- [x] AC3: entry order は canonical 化し、duplicate / invalid principal entry は拒否する。
- [x] AC4: durable non-success は requested after と current policy が一致する場合だけ元 result を維持する。
- [x] AC5: early non-success before / after null は policy read なしで確定する。
- [x] AC6: duplicate workers が一つの completed event へ収束する。
- [x] AC7: missing / cross-tenant / wrong-folder / corrupt / before / third state / unsupported intent を fail closed にする。
- [x] AC8: revocation 時は audit ID 相関 cleanup repair と authoritative deny version を要求する。
- [x] AC9: resolver は policy / cleanup mutation を再実行せず、worker registry / static policy / docs / coverage と同期する。
- [x] AC10: selected API test / typecheck / build / lint / docs / source audit / pre-commit が成功する。
- [x] AC11: Draft stacked PR に base #401、semver、未検証 AWS、rollback、後続 resolver を記載し、日本語 AC / self-review / CI evidence を残す。task-only lifecycle commit 後の final-head CI は PR comment に追記する。

## 検証計画

- resolver / worker / outbox / requirements coverage / static policy test
- API full test、API typecheck / build、root lint
- `task docs:check`、source audit、`task verify`
- `git diff --check`、pre-commit
- final-head GitHub Actions / semver validation

## PR レビュー観点

- actor / request input でなく tenant-scoped current policy を authoritative source にしているか
- tenant / folder / policy / principal boundary と exact operation selection が fail closed か
- entry 順序だけを正規化し、duplicate や未知 enum を黙って受理しないか
- current=before を勝手に failed / success へ変換しないか
- requestedCompletion の result / after と current state を両方再確認するか
- policy mutation / cleanup registration / cleanup action を worker が再実行しないか
- #399 の retry/quarantine と既存 cleanup repair outbox の責務を混同していないか
- docs と実装、変更範囲に見合う test、RAG 根拠性・認可境界、dataset 固有分岐が同期しているか

## リスク

- 実 DynamoDB consistency と worker delivery は未検証。
- current=before の pending intent は自動確定せず quarantine し得る。
- cleanup repair intent は確認するが、cleanup 完遂そのものは別 worker の責務であり、本 resolver の成功監査は cleanup completion evidence ではない。
- stacked chain #386→#389→#391→#394→#399→#401 の順序が必要。base 更新時は contract / full tests を再実行する。

## 実施結果（PR 作成前）

- exact resolver、production worker 登録、8 contract tests、static security policy、FR-086 coverage / 正本文書を同期した。
- セルフレビューで durable success `after=null` が missing policy と一致し得る余地と、非 ISO timestamp を受理する余地を検出し、proposed state 一致と canonical ISO timestamp を必須化した。
- 初回 targeted test は missing current policy の期待メッセージが actual third-state 判定と不一致で 1 件失敗した。期待値を仕様に合わせて修正し、targeted test を再実行して成功した。
- `node --import tsx src/security/folder-share-audit-reconciler.test.ts`: 8/8 成功。
- `npm test -w @memorag-mvp/api`: 844/844 成功。
- `npm run typecheck -w @memorag-mvp/api`: 成功。
- `task docs:check`: 成功（docs、OpenAPI、API docs 97 APIs / 582 documents、UI / infra inventory、hidden Unicode）。
- `npm run rag:release:source-audit`: dataset-specific branch 0、artifact manifest mismatch 0、audit ID `sha256:0cb39423bb1c791a6c8882d45cc235a0afaea22bc05c0a96046d028cc49aa210`。
- `task verify`: lint、全 workspace typecheck / build 成功。web build の既存 500 kB chunk warning は残る。
- `git diff --check`: 成功。
- `pre-commit run`（staged files）: 成功。`--all-files` 初回は既存レポートの末尾空白を検出して停止したため、無関係な自動変更を復元し、対象 staged files に限定して再実行した。
- `npm ci`: 成功。依存変更なし。npm audit は既存 8 vulnerabilities（low 2 / moderate 1 / high 5）を報告した。
- 実 AWS DynamoDB / EventBridge / Lambda、cleanup 完遂、merge / deploy / release は未実施。

## PR lifecycle

- Draft PR: #405 `🛡️ folder共有監査resolverを追加`
- base / head: `codex/issue-358-fr086-application-role-resolver` ← `codex/issue-358-fr086-folder-share-resolver`
- semver: `semver:patch`
- 日本語 AC comment / self-review: 投稿済み。blocking 指摘なし。
- implementation head: `471bdcc657c510a258ae192f89e09dc88208f860`
- MemoRAG CI: run 29551796247、`success`（2026-07-17 03:11:42Z–03:20:01Z）。
- task-only lifecycle commit 後の final-head CI は PR top-level comment と Issue #358 進捗へ外部 evidence として記録する。
