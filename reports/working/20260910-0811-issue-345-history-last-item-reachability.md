# Issue #345 履歴末尾viewport到達 作業レポート

## 結果

320×720 CSS pxの`E2E-UI-LAYOUT-STRESS-001`で、履歴35件の長い末尾titleへscrollし、その上下端がviewport内に収まることを明示的に測定するようにした。従来の`toBeVisible()`だけでは証明できなかった末尾到達を、Chromium／Firefox／WebKitのrequired gateとbrowser別JSON evidenceへ追加した。

production componentは変更せず、#461が変更する`HistoryWorkspace.tsx`との競合を避けた。reflow要求は既存`SQ-016`、E2Eは既存`E2E-UI-LAYOUT-STRESS-001`を再利用し、正本を増やしていない。

## 変更

- `apps/web/e2e/layout-stress.spec.ts`: 履歴35件の末尾scroll、viewport矩形assertion、先頭／末尾title長と末尾矩形のJSON evidenceを追加。
- `REQ_SERVICE_QUALITY_016.md`: 履歴の長い先頭／末尾titleと末尾viewport到達を既存E2E契約へ同期。
- `DES_UI_UX_001.md`: 320px content-extremeの画面固有境界とattachment項目を同期。
- `tools/web-inventory/ui-quality-matrix.json`: historyのAC-SQ016-001／006／007を同期。
- `docs/generated/web-ui-quality-matrix.md`: 正規generatorで同期。
- task、spec analysis、本レポートを追加。

## 検証

| 検証 | 結果 |
| --- | --- |
| git diff check | pass |
| Web trace | pass、13 tests |
| semantic UI | pass、5 tests |
| manual evidence schema | pass、7 tests。baselineはblocked 3／not_run 1で`ready: false` |
| canonical docs structure | pass |
| hidden Unicode | pass |
| Taskfile alias | pass |
| quality matrix生成／鮮度 | pass。正規Node generatorを直接実行 |
| local npm wrapper／依存型検査 | blocked。cloneに`node_modules`がなく、registry access承認が実行環境で拒否されたためfinal-head CIへ委譲 |
| Web UI Quality (`344535d7`) | pass。E2E TypeScript、Chromium 41件、Firefox／WebKit required 60件 |
| MemoRAG CI内Web | pass。lint、typecheck、unit 473件、C0 90.02%／C1 85.12%、build、正本／trace／生成物検査 |
| Validate Semver Label (`344535d7`) | pass |
| MemoRAG CI (`344535d7`) | failure。既存API fixture型不整合によるAPI typecheck／buildとAPI C1 80.75%（目標85%）。API testは1051件pass |
| PR／Issue証跡 | [受け入れ確認](https://github.com/tsuji-tomonori/rag-assist/pull/470#issuecomment-5610390593)、[セルフレビュー](https://github.com/tsuji-tomonori/rag-assist/pull/470#pullrequestreview-5161080227)、[Issue #345進捗](https://github.com/tsuji-tomonori/rag-assist/issues/345#issuecomment-5610398347)を記録 |

## 受け入れ判断

AC-1〜4は実装head `344535d7`で成立した。履歴35件の末尾titleは3 engineでviewport矩形assertionを通過し、root／history regionの水平overflow 0も維持した。画面→要件→受け入れ条件→E2Eは`history → SQ-016 → AC-SQ016-001 / 006 / 007 → E2E-UI-LAYOUT-STRESS-001`で一致する。

全体CIは既存API blockerでfailureのため、taskは`do`、PRはDraftを維持する。PR受け入れ確認／セルフレビュー、Issue #345への記録はhead `76183181`で完了した。task／report同期だけの証跡専用final headはCIを再確認し、結果をPR／Issueへ追記する。

## 未完了

- 既存API fixture型不整合によるtypecheck／build失敗とAPI C1 80.75%（目標85%）。
- representative screen reader、Firefox／WebKit native AX tree、実browser 200%／400% zoom、text-only zoom、OS scaling、touch／実機、manual keyboard／contrast。
- 実API／AWS認可、#461統合後の最終DOM再検証。
- FR-050／FR-051、TC-003、OQ-UI-002、branch protection／owner判断。

merge、deploy、release、force-pushは実施しない。

## Skill適合度

- worktree task PR flow: 100%。専用worktree、task先行、既存Draft PRのfast-forward更新、検証・報告を維持した。
- canonical requirements review: 100%。SQ-016を一意な正本とし、新しい要求IDを作っていない。
- acceptance criteria／E2E／traceability: 100%。Given／When／Then、定量的なviewport矩形、画面→要件→AC→E2Eをtask／spec analysisへ記録した。
- mobile-first UI/UX/a11y: 100%。320×720 CSS pxで末尾到達と水平containmentを測定し、実browser zoom／支援技術の代替ではない境界を明記した。
- no-mock product UI: 100%。fixtureはPlaywright routeに限定し、production sourceへ固定値やfallbackを追加していない。
- repository test runner: 100%。ローカル依存不足をfinal-head CIで補完し、Web／3-browser対象はpass、全体CIの既存API failureは未完了として分離した。
