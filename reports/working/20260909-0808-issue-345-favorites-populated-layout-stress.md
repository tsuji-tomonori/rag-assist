# Issue #345 お気に入り実データ layout stress 作業レポート

## 結果

`E2E-UI-LAYOUT-STRESS-001`のお気に入り境界を、確認済み0件だけから、24件／8 target type、長いlabel／target ID、アクセス不可cue、末尾到達、reload後の確認済み0件へ拡張した。初回CIでfavorites regionの決定的な水平overflowを検出し、favorites限定CSSで長文を縮小・折り返し可能にした。既存のChromium／Firefox／WebKit required scopeとE2E IDを維持している。

## 変更

- `apps/web/e2e/layout-stress.spec.ts`: test-only favorites fixture、populated／empty assertion、browser別JSON evidenceを拡張。
- `apps/web/src/styles/features/history.css`: favorites itemだけを1列gridとし、label／target IDを任意位置で折り返す。
- `REQ_SERVICE_QUALITY_016.md`: `E2E-UI-LAYOUT-STRESS-001`のfavorites境界を同期。
- `DES_UI_UX_001.md`: 320px content extreme設計証跡を同期。
- `tools/web-inventory/ui-quality-matrix.json`: favoritesのAC-SQ016-001／007を同期。
- `docs/generated/web-ui-quality-matrix.md`: 正規quality matrix generatorで同期。
- task／spec analysis／本レポートを追加。

## 検証

| 検証 | 結果 |
| --- | --- |
| git diff check | pass |
| Web trace | pass、13 tests |
| semantic UI | pass、5 tests |
| manual evidence schema | pass、7 tests。baselineはblocked 3／not_run 1でrelease-readyではない |
| canonical docs structure | pass |
| hidden Unicode | pass |
| Taskfile alias | pass |
| quality matrix生成 | pass |
| implementation head `e9963d1d` Chromium E2E | fail。favorites region 320／1404pxを初回／retryで再現し、真因修正へ反映 |
| full Web inventory生成 | local blocked。`typescript` packageがなく、外部registry取得は実行環境境界で拒否 |
| Web UI Quality (`60c17342`) | pass。Chromium 41件、Firefox／WebKit required 60件。E2E TypeScript、lint、Web typecheck／unit／coverage／build、inventory freshnessを含む |
| Web coverage | pass。C0 90.02%／C1 85.12% |
| Validate Semver Label (`60c17342`) | pass |
| MemoRAG CI (`60c17342`) | failure。本slice対象のWeb・正本・trace・生成物検査はpass。既存API fixture型不整合によるAPI buildとAPI C1 80.75%（目標85%）でfailure |

## 受け入れ判断

実装、正本／quality生成物同期、選定したWeb検査、Chromium／Firefox／WebKit required E2Eは実装head `60c17342`で完了した。初回CIで再現した320／1404pxの水平overflowはfavorites限定CSSで解消し、retryなしで通過した。MemoRAG CI全体は既存API build／coverage blockerによりfailureのため、PRとtaskはDraft／`do`を維持する。

## 未完了

- PR会話の受け入れ確認／セルフレビュー、Issue #345へのfinal head証跡（repo証跡確定後に実施）。
- MemoRAG CIの既存API fixture型不整合によるbuild失敗とAPI C1 80.75%（目標85%）。
- representative screen reader、Firefox／WebKit native AX tree、実browser 200%／400% zoom、text-only zoom、OS scaling、touch／実機、manual keyboard／contrast。
- 実API／AWS認可、favorite resume／delete、#461統合後の再検証。
- FR-050／FR-051、TC-003、OQ-UI-002、API既存fixture／buildとC1 85%。

merge、deploy、release、force-pushは実施しない。

## Skill適合度

- worktree task PR flow: 100%。専用worktree、task先行、Draft PR更新、検証・報告を維持。
- canonical requirements review: 100%。SQ-016を一意な正本とし、FR-028を無承認で拡張していない。
- acceptance criteria／E2E／traceability: 100%。Given／When／Then、画面→要件→AC→E2E、未完了gapを仕様分析へ記録。
- nazenaze analysis: 100%。CI寸法、DOM／CSS、既存coverage gapから直接原因・流出原因・真因・全量対策をtaskへ記録。
- no-mock product UI: 100%。固定値はPlaywright test-only fixtureだけに閉じ、production差分はデータを持たないCSS規則だけ。
- repository test runner: 100%。ローカル依存不足を実装head CIで補完し、選定Web検査と3-browser required E2Eを確認。全体CIの既存API failureは未完了として分離した。
