# Issue #345 / Draft PR #462: 個人設定a11y証跡のrequired gate追加

## 結果

Draft PR #462の既存integration branchをcurrent `main@0771521c`のまま更新する準備として、
個人設定のkeyboard-only journeyとChromium accessibility tree契約をrequired UI quality gateへ追加した。
production差分は個人設定controlのfocus indicatorに限定し、新規PRは作らない。

## 開始時点

- base: `main@0771521cbe505d3ffeddcbe34deff89f67de8702`
- Draft PR #462 head: `1b8e81c15b9d2e8ab34817008835dbfc49806020`
- mainとDraft baseは前回実行後に更新なし。PRはopen / draft / mergeable、behind 0、unresolved review thread 0。
- Issue #345、open PR / Issue、`tasks/todo/` / `tasks/do/`、`SQ-016`、`DES_UI_UX_001`、machine-readable / generated matrixを確認した。

## 選定理由

- `profile / AC-SQ016-002` / `003`は既存keyboard / AX tree検査が任意実行で、個人設定control固有の証跡が不足していた。
- `profile / AC-SQ016-007`のN/A / mutation feedback判断や、`chat`のstreaming / retry定義を仮定せず前進できる。
- open PR #461のchanged filesをGitHubプラグインで確認し、`layout.css`、対象E2E、正本、matrixとの重複がないことを確認した。
- API、auth、認可、RAG、benchmark datasetを変更しない小さなUI品質単位である。

## 原因と判断

- 直接原因: 既存2 specがrequired commandに含まれず、個人設定内control操作 / semantic valueも検査していなかった。
- 流出原因: cross-view testの存在、required selector、画面単位matrix statusを一括で検出する規則がなかった。
- 実欠陥: 個人設定select / buttonへnavigationと同等の3px `:focus-visible`が適用されていなかった。
- 対策: 局所focus style、keyboard実操作、AX name / role / value、required command、正本 / matrix / generated docsを同時に同期する。

## 変更

- 個人設定select / buttonへ3px focus outlineと2px offsetを追加。
- `E2E-UI-KEYBOARD-NAV-001`で個人設定到達、native selectのarrow-key value変更、focus、チャット復帰を検証。
- `E2E-UI-SR-SEMANTICS-001`で個人設定region / heading、combobox name / value、戻る・sign out buttonをChromium AX treeで検証。
- required UI quality commandを31件から33件へ拡張。
- `profile / AC-SQ016-002` / `003` automatedだけを`pass`へ更新し、manual / overall、`AC-SQ016-004` / `007`を`blocked`に維持。
- `SQ-016`、`DES_UI_UX_001`、machine-readable matrix、生成マトリクスを同期。

## ローカル検証

| 検証 | 結果 |
| --- | --- |
| required UI quality listing | pass（33件、追加2 specを検出） |
| targeted Chromium E2E | blocked（sandboxの`tsx` IPC `listen EPERM`） |
| lint | pass |
| Web typecheck | pass |
| Web unit | pass（61 files / 443 tests） |
| Web build | pass（既存chunk-size advisoryのみ） |
| UI traceability | pass（13 tests） |
| semantic UI contract | pass（5 tests） |
| canonical / generated / manual evidence / infra / hidden Unicode docs checks | pass |
| OpenAPI / API code docs checks | pass（OpenAPIは等価な`node --import tsx`で実行） |
| `git diff --check` | pass |

`task docs:check`は`task` CLIがないため実行できず、確認済みTaskfileの下位コマンドを直接実行した。

## GitHub Actions

| workflow | 結果 | 証跡 |
| --- | --- | --- |
| Web UI Quality | pass（33 / 33） | [run 30773229830](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30773229830) |
| MemoRAG CI | pass | [run 30773229895](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30773229895) |
| Validate Semver Label | pass | [run 30773229841](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30773229841) |

API coverageはC0 90.65% / C1 80.48%。workflowは既存改善task
`tasks/todo/20260712-coverage-api-c1-recovery.md`を参照して成功したが、C1 85%品質目標は未達のまま扱う。

## 未完了

- representative screen reader、実browser 200% / 400% zoom、touch / real device、Firefox / WebKit。
- `profile / AC-SQ016-007`のowner判断、`chat`のstate / retry evidence。
- `OQ-UI-002` owner / cadence / approved matrix。
- API C1品質目標85%（final CI実測80.48%）。

## 指示への適合

| 要件 | 状況 | 根拠 |
| --- | --- | --- |
| current main / open work / tasks / 正本・生成物を確認 | 対応 | GitHub・local sourceを再確認 |
| 重複しない小改善を1件選定 | 対応 | profile keyboard / semantic evidenceへ限定 |
| task・実装・正本・生成物を同期 | 対応 | focus CSS、E2E、2正本、matrix、generated docs |
| lint・typecheck・unit・E2E・docs check | 対応 | local static / unit / docsとGitHub required Chromium 33 / 33がpass。local E2Eはsandbox blockedを明記 |
| Draft PR更新・Issue進捗 | 対応 | Draft PR #462とIssue #345へfinal evidenceを記録 |
| 未検証を完了扱いしない | 対応 | taskは`do`、manual / overallは`blocked` |
| merge / deploy / release禁止 | 対応 | 未実施 |

総合fit: 4.8 / 5.0（約96%）。選定した小改善の自動受け入れ条件とGitHub記録は完了した。
ただしIssue #345全体のmanual evidence、owner判断、API C1目標は未完了であり、task / PRは`do` / Draftを維持する。

## 次の具体作業

1. 次回は`chat` state / retry契約またはmanual evidence owner判断を、根拠なしに完了扱いせず進める。
2. representative screen reader、実browser 400% zoom、touch / real deviceのapproved execution環境とownerを確定する。
3. API C1は既存coverage recovery taskで85%目標へ収束する。
