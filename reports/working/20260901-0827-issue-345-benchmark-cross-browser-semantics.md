# Issue #345 性能テスト cross-browser semantics working report

## 結果

- `E2E-UI-CROSS-BROWSER-SEMANTICS-008`を追加し、性能テストworkspace、job panel、suite／dataset／model／concurrency value、実行履歴scroll region／table、主要actionをFirefox／WebKit required scopeへ組み込んだ。
- `benchmark → SQ-016 → AC-SQ016-003 → E2E-UI-CROSS-BROWSER-SEMANTICS-008`をSQ-016正本、UI正本、authored trace／quality matrix、generated Web docsへ同期した。
- required Firefox／WebKit scopeはsemantic 16件、全32件となった。
- production component／CSS／API／authorization／RAG contractは変更していない。
- local実ブラウザ実走はsandbox内API serverの`tsx` IPC socketが`EPERM`となるため未完了。final-head GitHub Actionsの結果を別証跡として記録する。

## 実装範囲

| 区分 | 内容 |
|---|---|
| E2E | benchmark route fixture、region／heading／job panel、suite／dataset／model／concurrency value、run／refresh／back action、history scroll region／table |
| evidence | browser project名付きPlaywright ARIA snapshot、control／history state JSON、representative screen reader／native AXではない境界 |
| canonical | `SQ-016` current evidence、`DES_UI_UX_001` view trace／required scope／benchmark semantic contract |
| authored joins | `ui-traceability.json`、`ui-quality-matrix.json` |
| generated | `web-screens.md`、`web-traceability.md`、`web-ui-inventory.json`、`web-ui-quality-matrix.md` |
| workflow | acceptance付きtask、spec analysis、本report |

## Local verification

| check | result | note |
|---|---|---|
| targeted ESLint | pass | `cross-browser-semantics.spec.ts` |
| Web typecheck | pass | `tsc -p apps/web/tsconfig.json --noEmit` |
| Web unit | pass | `TZ=Asia/Tokyo`で62 files／449 tests。UTC既定では既存の日付表示2件がtimezone差でfail |
| Web build | pass | Vite build成功。既存chunk size warningのみ |
| targeted Firefox／WebKit discovery | pass | 2 tests |
| required Firefox／WebKit discovery | pass | 32 tests／6 files |
| Firefox／WebKit targeted実走 | blocked | API serverの`tsx` IPC socket `/tmp/tsx-0/*.pipe` listenがsandbox `EPERM`。assertion failureではない |
| trace tests | pass | 13 tests |
| semantic UI tests | pass | 5 tests |
| generated freshness | pass | authored sourceから最新 |
| docs validation | pass | canonical docs validation成功 |
| hidden Unicode | pass | docs／reports／tasks |
| authored JSON parse | pass | generator／trace testがtrace／quality matrixをparse |
| Taskfile alias check | pass | active legacy aliasなし |
| `git diff --check` | pass | whitespace errorなし |

## Evidence boundary and residual risk

- Playwright ARIA snapshotとDOM stateはrepresentative screen readerやFirefox／WebKit native AX tree debug outputではない。
- browser UIを操作する実200%／400% zoom、text-only zoom、OS scaling、manual keyboard／contrast、touch／実機は未実施で、manual／overallは`blocked`のままである。
- 実AWS上のbenchmark start／cancel／download journeyは本sliceのroute fixtureで完了扱いしない。
- `FR-051`、`OQ-UI-002`、API C1 85%はowner判断または別task待ちである。
- #461統合後は最終production DOMとgenerated inventoryに対して再検証が必要である。
- Draft PR #462は累積stackであり、本sliceのCI成功だけでmerge-readyとはしない。

## CI / GitHub evidence

- final implementation head: CI完了後に追記する。
- Web UI Quality: pending。
- MemoRAG CI: pending。
- Validate Semver Label: pending。
- PR受け入れ確認: pending。
- セルフレビュー: pending。
- Issue #345進捗: pending。

## Lifecycle / cleanup recommendation

- evidence artifact retentionはworkflow既定の14日を維持する。
- taskとPRはmanual evidence、実AWS journey、owner判断、#461統合後の再検証が未完了のため`do`／Draftを維持する。
- merge、deploy、release、force-pushは行わない。
