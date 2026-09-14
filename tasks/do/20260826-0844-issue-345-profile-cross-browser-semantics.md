# Issue #345 個人設定 cross-browser semantic required gate

- 状態: do
- タスク種別: 修正
- 対象Issue: #345
- 対象PR: #462

## 背景

profileの`AC-SQ016-003`はChromium AX treeで合格しているが、Firefox／WebKitのrequired semantic証跡はlogin / chatだけに限定される。個人設定はkeyboard・contrast・session-only stateを3 browserで検証済みであり、同じproduction stateのname / role / value / live semanticsをcross-browser contractへ接続する余地が残る。

## 目的

個人設定の静的ARIA snapshotと送信キー変更後のvalue / visible polite statusをFirefox／WebKit required E2Eで検査し、`profile → SQ-016 → AC-SQ016-003 → E2E-UI-CROSS-BROWSER-SEMANTICS-002`を正本・authored source・生成文書で同期する。

## スコープ

- profile region、heading、送信キーcombobox、戻る・sign out buttonのPlaywright ARIA snapshot
- 送信キー変更後のcombobox value、可視status text、`role=status`、`aria-live=polite`
- browser project名と自動証跡境界を持つsnapshot / JSON attachment
- SQ-016、UI design、trace、quality matrix、generated Web docsの同期
- Draft PR #462、受け入れ確認、セルフレビュー、Issue #345の更新

## 対象外

- production component / CSS / API / permissionの変更
- representative screen reader、Firefox／WebKit native AX tree、実browser zoom、touch / real device
- FR-051永続化、保存失敗/retry/permission、OQ-UI-002 owner判断
- PR #461が所有するshared production UI

## なぜなぜ分析

### 問題

profileの`AC-SQ016-003`はautomated passだが、screen固有のFirefox／WebKit semantic証跡を持たず、chatと証跡密度が非対称である。

### confirmed

- profileはrequired Chromium AX tree、Chromium／Firefox／WebKit keyboard、Chromium contrast証跡を持つ。
- required cross-browser semantics suiteはlogin / chatだけを対象にする。
- profileのcombobox name/valueとvisible polite statusはproduction実装済みである。
- PR #461のproduction ownershipに触れず、test / docsだけで回帰検出を追加できる。

### inferred

- cross-browser suiteの初期sliceをlogin / chatへ限定したため、後から自動証跡が充実したprofileが同じsemantic gateへ接続されていない。

### open question

- representative screen readerとFirefox／WebKit native AX tree、実browser zoom、実機の結果は未確認である。
- FR-051永続化と失敗・permission contractはowner判断待ちである。

### 根本原因

profileの実装不足ではなく、既存production semanticsをFirefox／WebKit required contractへ結ぶscreen固有E2E IDとtraceが欠落している。

### 全影響範囲への対応

profile限定のrequired semantic E2Eを追加し、evidence helperをE2E ID引数化してchatとのprovenanceを分離する。正本・authored trace / matrix・生成文書を同期し、manual / native AX / FR-051境界はblockedを維持する。

## 受け入れ条件

- [x] `E2E-UI-CROSS-BROWSER-SEMANTICS-002`がprofileのheading、combobox name/value、戻る・sign out buttonをFirefox／WebKit ARIA snapshotで検証する。
- [x] 同E2Eが送信キー変更後のcombobox value、可視status text、`role=status`、`aria-live=polite`を検証する。
- [x] snapshot / state JSONにbrowser project名、新しいE2E ID、native AX tree／代表screen readerではない境界が記録される。
- [x] `profile → SQ-016 → AC-SQ016-003 → E2E-UI-CROSS-BROWSER-SEMANTICS-002`が正本、authored trace / matrix、生成文書で一致する。
- [x] manual / overallと`AC-SQ016-007`はblockedを維持し、自動証跡をrepresentative screen readerやFR-051完了へ読み替えない。
- [x] 最小十分なlint、typecheck、unit、build、targeted E2E、trace / matrix / docs checkが成功する。
- [x] Draft PR #462、受け入れ確認、セルフレビュー、Issue #345へ結果と残件を記録する。

## 検証計画

- `npm run lint -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/web`
- `TZ=UTC npm test -w @memorag-mvp/web`
- `npm run build -w @memorag-mvp/web`
- `npm exec -w @memorag-mvp/web -- playwright test e2e/cross-browser-semantics.spec.ts --project=firefox --project=webkit --grep E2E-UI-CROSS-BROWSER-SEMANTICS-002`
- `npm run docs:web-trace:test`
- `npm run test:web-semantic-ui`
- `npm run docs:web-inventory:check`
- `python3 scripts/validate_docs.py`
- `git diff --check`

## リスク

- Playwright ARIA snapshotとDOM ARIA stateはrepresentative screen readerやnative browser AX treeのengine固有出力を代替しない。
- required suiteの実走はbrowser起動とlocalhost serverを必要とするため、local環境でblockedの場合はGitHub Actions結果を未完了のまま待つ。
- #461統合後はfinal production DOMに対する再検証が必要である。

## 実装head検証・記録

- head: `38bab5d5c74cb6d60ac61a74f78ebb8c5c15c73f`
- [Web UI Quality](https://github.com/tsuji-tomonori/rag-assist/actions/runs/32913144798): Chromium 41/41、Firefox／WebKit 20/20、retry・flakyなし
- [MemoRAG CI](https://github.com/tsuji-tomonori/rag-assist/actions/runs/32913144785): 成功
- [semver検査](https://github.com/tsuji-tomonori/rag-assist/actions/runs/32913144813): 成功
- [受け入れ確認](https://github.com/tsuji-tomonori/rag-assist/pull/462#issuecomment-5418735540)
- [セルフレビュー](https://github.com/tsuji-tomonori/rag-assist/pull/462#pullrequestreview-5025528414)
- [Issue #345進捗](https://github.com/tsuji-tomonori/rag-assist/issues/345#issuecomment-5418735369)

今回sliceの自動受け入れ条件は満たした。Issue #345全体のrepresentative screen reader、native AX、実browser zoom、実機、FR-051 owner判断が未完了のため、状態は`do`を維持する。
