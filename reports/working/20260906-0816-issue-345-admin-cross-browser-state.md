# Issue #345 管理画面 cross-browser state 必須証跡 作業レポート

## 実施内容

- Draft PR #470 の統合headを基準に、管理画面の `E2E-UI-CROSS-BROWSER-STATE-006` を追加した。
- Firefox／WebKit対象として、次の3 scenarioを独立したdeterministic route fixtureで検証する。
  - loading → 監査取得500によるpartial → retrying → recovered
  - ユーザー更新失敗時のsource・as-of付きstale data保持 → retrying → recovered
  - 管理権限不足deep linkのpermission表示、許可画面への正規化、protected request 0件
- production component、API、認可、RAG契約は変更していない。
- `SQ-016`、`NFR-018`、`DES_UI_UX_001`、machine-readable trace、quality matrixを同期し、生成Web文書は `npm run docs:web-inventory` で再生成した。

## トレーサビリティ

`admin → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-006`

- canonical requirement: `REQ_SERVICE_QUALITY_016.md`
- canonical NFR gate: `REQ_NON_FUNCTIONAL_018.md`
- canonical UI design: `DES_UI_UX_001.md`
- executable evidence: `apps/web/e2e/cross-browser-state.spec.ts`
- machine-readable join: `tools/web-inventory/ui-traceability.json`
- status matrix: `tools/web-inventory/ui-quality-matrix.json`

## ローカル検証

- `npm ci`: pass、505 packages、lockfile変更なし。
- 対象ESLint: pass。
- Web typecheck: pass。
- Web unit: 66 files / 473 tests pass。
- Web build: pass。既知の500kB超chunk warningのみ。
- Web trace／matrix: 13 tests pass。
- semantic UI contract: 5 tests pass。
- Web inventory freshness: pass。
- canonical docs validation、hidden Unicode、Taskfile alias、`git diff --check`: pass。
- Firefox／WebKit required discovery: 6 files / 56 testsとして解決。追加分は3 scenario × 2 browserの6件。
- Firefox／WebKit実走: ローカルwebServerの既定`tsx` IPCが`EPERM`となるため、同じAPI entryを `node --import tsx` で起動して回避した。browser本体は取得できたが、hostにGTK4／GStreamer等のrequired libraryがなくbrowser context生成前に停止した。環境へpackageを追加せず、GitHub Actionsの最終判定を待つ。

## レビュー所見

- partialは非緊急更新として `role=status`／`aria-live=polite`、permissionは既存のassertive alertとして扱う。自動証跡で状態の緊急度を混同しない。
- 成功したユーザーdataはpartial／retrying中も保持し、監査dataは回復確認後だけ表示する。
- targeted refresh失敗では確認済みユーザー、`authoritative_identity`、固定as-ofを保持し、private backend detailを表示しない。
- denied deep linkはadmin API requestを0件に保ち、許可されたchatへ正規化する。
- test fixtureはPlaywright route内だけで、production sourceとの差分はない。

## 未完了・blocker

- 初回CIで、監査actionの内部IDを表示文字列として期待していたことと、ユーザーtab遷移の自動refreshへ二重clickしていたことを検出した。表示ラベル／監査IDを検証し、tab遷移refreshを決定的に待つよう修正した。
- 修正head `9765f9e3` の [Web UI Quality](https://github.com/tsuji-tomonori/rag-assist/actions/runs/33999917574) はpass。Chromium requiredとFirefox／WebKit required 56/56を確認した。[semver検査](https://github.com/tsuji-tomonori/rag-assist/actions/runs/33999917571)もpassした。
- [MemoRAG CI](https://github.com/tsuji-tomonori/rag-assist/actions/runs/33999917562) はfail。Web lint／typecheck／473 tests／build、docs、infra、benchmarkはpass。本sliceが変更していないAPI側でtest fixtureの型不整合、API build、C1 branch coverage 80.75%（目標85%）が残る。
- representative screen reader、Firefox／WebKit native AX tree、実ブラウザ200%／400% zoom、text-only zoom、OS scaling、touch／実機は未実施。
- 実API／AWS／実認可での管理操作は未実施。
- FR-050／FR-051、TC-003 WebSocket transport判断、OQ-UI-002、API C1 85%は未完了。
- 上記のためIssue #345全体、累積task、Draft PRを完了／merge-readyとは扱わない。
