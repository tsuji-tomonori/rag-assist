# Issue #345 documents cross-browser semantics working report

## Summary

- 対象: Draft PR #462 / `integration/issue-345-ui-evidence`
- slice: documents画面のFirefox／WebKit semantic required gate
- trace: `documents → SQ-016 → AC-SQ016-003 → E2E-UI-CROSS-BROWSER-SEMANTICS-004`
- production変更: なし
- 状態: 今回sliceの自動受け入れ条件を満たす。manual／native／owner／統合後の証跡は未完了

## Selection evidence

- current main: `8e542b31`（前回確認時から変更なし）
- slice開始head: `b06bff82`、mainに対してbehind 0
- documentsは132操作要素を持つ高密度画面であり、既存required evidenceはChromium AX、cross-browser keyboard／reflow／layout stressまでだった。
- Draft PR #461は`DocumentWorkspace.tsx`を含むproduction sourceとgenerated inventoryを変更するため、本sliceはtest、正本、authored source、generated docsに限定した。
- #341〜#344はmerge／close済みで、既存の正本文書一意性を維持した。

## Changes

- Firefox／WebKitでdocuments workspace、breadcrumb、folder tree、検索、filter value、tableのrole／name／valueを検証し、完全ARIA treeをartifactへ保存する。
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

- local環境にはPlaywright Firefox／WebKit browser binaryがなく、対象2 browserの実走は未実施。GitHub Actions required jobでFirefox／WebKit 24/24を確認した。
- Playwright ARIA snapshot／DOM stateはrepresentative screen readerまたはnative Firefox／WebKit AX treeの証跡ではない。
- representative screen reader、native AX tree、実browser 200%／400% zoom、text-only zoom、OS scaling、touch／実機、manual keyboard／contrastは未完了。
- #461統合後は最終production DOMに対する再検証が必要。
- FR-051、OQ-UI-002、API C1 85%はowner判断／別scope待ち。
- taskは`do`、PRはDraftを維持する。merge、deploy、release、force-pushは行わない。

## CI result and repair

- initial record head `6d945ff52a5a0c6c8f5cf19a760a05fa46f1ebf9`は既存22件を成功させ、新規2件だけでworkspace全体の部分期待値をexact比較していたtest defectを検出した。
- 主要landmark／control／value／selected／expandedを個別required assertionとし、完全ARIA treeをbrowser別artifactへ分離した。contractを過剰緩和していない。
- repaired head `b5a09cd96597a29f5c2047fc810ffd1695de6f5d`で[Web UI Quality](https://github.com/tsuji-tomonori/rag-assist/actions/runs/33127853499)（Firefox／WebKit 24/24、Chromium required成功）、[MemoRAG CI](https://github.com/tsuji-tomonori/rag-assist/actions/runs/33127853319)、[semver](https://github.com/tsuji-tomonori/rag-assist/actions/runs/33127854262)が成功した。
- [PR受け入れ確認](https://github.com/tsuji-tomonori/rag-assist/pull/462#issuecomment-5446667981)、[セルフレビュー](https://github.com/tsuji-tomonori/rag-assist/pull/462#issuecomment-5446668090)、[Issue #345進捗](https://github.com/tsuji-tomonori/rag-assist/issues/345#issuecomment-5446668206)を記録した。

## Remote publication

- implementation head: `75a415472745907049ca6e055f07b270fae88bb1`
- remote tree転送時に2件のUnicode pathが引用文字列として追加されたため、`6f481c66870ae8ede693415edd178b24e1c19535`で誤pathを削除し、既存の正本pathへ同一内容を反映した。履歴はfast-forwardで保持し、force-pushしていない。
- GitHub Actionsを発火させるrecord commit `6d945ff52a5a0c6c8f5cf19a760a05fa46f1ebf9`を追加した。
- task acceptance、CI、PR／Issue証跡をまとめたacceptance record headは`caaad53be4706b5469982bbdcba8bc6183e1c7ca`。

## Requirement fit

| requirement | status | evidence |
|---|---|---|
| 既存作業と重複しない小さな改善 | 対応 | #461のproduction ownershipを避けたtest／docs slice |
| task／実装／正本／生成物同期 | 対応 | task acceptance、E2E、SQ-016、UI正本、authored／generated inventory |
| lint／typecheck／unit／E2E／docs | 対応 | local checksとGitHub Actions成功 |
| Draft PR／Issue進捗 | 対応 | PR #462本文・2コメント、Issue #345コメント |
| 未検証事項を未完了として明記 | 対応 | manual／native／real zoom／device／owner／#461統合後をblocked維持 |
| merge／deploy／release禁止 | 対応 | いずれも未実施。force-pushも未実施 |

総合fit: 4.7 / 5.0（約94%）。今回の自動sliceは受け入れ条件を満たしたが、依頼全体のmanual／native／owner判断と#461統合後の再検証は未完了のため満点ではない。
