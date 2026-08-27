# Issue #345 documents cross-browser semantics working report

## Summary

- 対象: Draft PR #462 / `integration/issue-345-ui-evidence`
- slice: documents画面のFirefox／WebKit semantic required gate
- trace: `documents → SQ-016 → AC-SQ016-003 → E2E-UI-CROSS-BROWSER-SEMANTICS-004`
- production変更: なし
- 状態: local checks成功、GitHub Actions実走待ち

## Selection evidence

- current main: `8e542b31`（前回確認時から変更なし）
- slice開始head: `b06bff82`、mainに対してbehind 0
- documentsは132操作要素を持つ高密度画面であり、既存required evidenceはChromium AX、cross-browser keyboard／reflow／layout stressまでだった。
- Draft PR #461は`DocumentWorkspace.tsx`を含むproduction sourceとgenerated inventoryを変更するため、本sliceはtest、正本、authored source、generated docsに限定した。
- #341〜#344はmerge／close済みで、既存の正本文書一意性を維持した。

## Changes

- Firefox／WebKitでdocuments workspace、breadcrumb、folder tree、検索、filter value、tableをARIA snapshotとして検証する。
- 文書detailを開き、selected row、名前付きdialog、close／question action、technical disclosureのcollapsed→expanded stateを検証する。
- browser project、E2E ID、snapshot／DOM state境界をPlaywright artifactへ添付する。
- SQ-016、UI正本、authored trace／quality matrixを更新し、generated Web inventoryをgeneratorで同期した。
- required Firefox／WebKit scopeをsemantic 8件／合計24件へ更新した。

## Local verification

| check | result |
|---|---|
| `npm ci` | pass（504 packages） |
| targeted ESLint | pass |
| standalone E2E TypeScript strict compile | pass |
| Web typecheck | pass |
| Web unit | pass（62 files / 449 tests、`TZ=Asia/Tokyo`） |
| Web build | pass（既存chunk size warningのみ） |
| targeted Firefox／WebKit discovery | pass（2 tests / 1 file） |
| required Firefox／WebKit discovery | pass（24 tests / 6 files） |
| trace / quality matrix unit | pass（13 tests） |
| semantic UI unit | pass（5 tests） |
| generated inventory freshness | pass |
| docs validation / hidden Unicode | pass |
| authored／generated JSON parse | pass |
| `git diff --check` | pass |

## Evidence boundary and incomplete work

- local環境にはPlaywright Firefox／WebKit browser binaryがなく、対象2 browserの実走は未実施。GitHub Actions required jobを最終証跡とするため、CI成功までは受け入れ未完了とする。
- Playwright ARIA snapshot／DOM stateはrepresentative screen readerまたはnative Firefox／WebKit AX treeの証跡ではない。
- representative screen reader、native AX tree、実browser 200%／400% zoom、text-only zoom、OS scaling、touch／実機、manual keyboard／contrastは未完了。
- #461統合後は最終production DOMに対する再検証が必要。
- FR-051、OQ-UI-002、API C1 85%はowner判断／別scope待ち。
- taskは`do`、PRはDraftを維持する。merge、deploy、release、force-pushは行わない。

## CI plan

1. Draft PR #462へimplementation commitを追加する。
2. Web UI QualityのFirefox／WebKit required 24件とChromium、MemoRAG CI、semver検査を確認する。
3. browser差分を検出した場合はsnapshot contractを過剰緩和せず、原因を分類して修復する。
4. 最終headで受け入れ確認、セルフレビュー、Issue #345進捗を記録する。
