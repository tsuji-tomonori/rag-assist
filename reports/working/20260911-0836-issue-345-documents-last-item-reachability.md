# Issue #345 文書末尾viewport到達 作業レポート

## 結果

320×720 CSS pxの`E2E-UI-LAYOUT-STRESS-001`を、長いファイル名1件から文書30件／6 file typeへ拡張した。表示件数を25件から50件へ変更した後、30件すべてが同一ページに存在することを確認し、defaultの更新日新しい順で末尾になる長いファイル名へscrollして上下端がviewport内に収まることを明示的に測定する。

production component／CSSは変更せず、#461が変更する文書workspaceとの競合を避けた。reflow要求は既存`SQ-016`、E2Eは既存`E2E-UI-LAYOUT-STRESS-001`を再利用し、正本を増やしていない。

## 受けた指示と判断

- current main、前回head、open PR／Issue、task台帳、正本／生成文書を確認し、既存作業と重複しない小さな改善を1件選ぶ。
- 前2回でお気に入り24件／履歴35件の末尾到達が追加された一方、documentsは長いファイル名1件だけだったため、多数件とpagination境界を次の優先sliceとした。
- 320 CSS pxは実browser 400% zoomの代替ではなく、automation境界を正本・設計・artifactへ維持する。

## 変更

- `apps/web/e2e/layout-stress.spec.ts`: 文書30件／6 file type、初期25件、50件表示後の全30件、長い先頭／末尾ファイル名、末尾scroll／viewport矩形、browser別JSON evidenceを追加。
- `REQ_SERVICE_QUALITY_016.md`: documentsの多数件、page-size、末尾viewport到達を既存E2E契約へ同期。
- `DES_UI_UX_001.md`: 320px content-extremeの画面固有境界とattachment項目を同期。
- `tools/web-inventory/ui-quality-matrix.json`: documentsのAC-SQ016-001／006／007を同期。
- `docs/generated/web-ui-quality-matrix.md`: 正規generatorで同期。
- 受け入れ条件付きtaskと本レポートを追加。

## 検証

| 検証 | 結果 |
| --- | --- |
| canonical docs structure | pass |
| Web trace | pass、13件 |
| semantic UI | pass、5件 |
| manual evidence schema | pass、7件。baselineはblocked 3／not_run 1、`ready: false` |
| quality matrix生成／鮮度 | pass |
| infra inventory freshness | pass |
| hidden Unicode | pass |
| Taskfile alias | pass |
| git diff check | pass |
| Web inventory freshness | blocked。`typescript`依存不在 |
| lint／Web・E2E typecheck／Web unit／build／3-browser E2E | final-head CI待ち |

`npm run`は依存解決のnetwork approvalが非対話実行で中断されたため、エスカレーションせずGitHub Actionsへ委譲する。

初回Web UI Quality `34543643737`は、`.document-file-row`がデータ25件にheader row 1件を加えた26件を返し、Chromiumでfailureとなった。DOM契約に合わせてデータrowを`.document-file-row:not(.document-file-head)`へ限定し、productionを変更せず修正した。final-headで同じ3-browser gateを再実行する。

## 受け入れ判断

実装head `a05916e2`でAC-1〜5に対応する差分を作成した。画面→要件→受け入れ条件→E2Eは`documents → SQ-016 → AC-SQ016-001 / 006 / 007 → E2E-UI-LAYOUT-STRESS-001`で一致する。

final-head CI、PR受け入れ確認／セルフレビュー、Issue #345への記録は未完了である。既存API blockerとmanual evidenceも残るため、taskは`do`、PRはDraftを維持する。

## 未完了

- final-headのWeb UI Quality、MemoRAG CI、semver検査。
- 既存API fixture型不整合によるtypecheck／build失敗とAPI C1 80.75%（目標85%）。
- representative screen reader、Firefox／WebKit native AX tree、実browser 200%／400% zoom、text-only zoom、OS scaling、touch／実機、manual keyboard／contrast。
- 実API／AWS認可、#461統合後の最終DOM再検証。
- FR-050／FR-051、TC-003、OQ-UI-002、branch protection／owner判断。

merge、deploy、release、force-pushは実施しない。

## Skill適合度

- worktree task PR flow: 専用worktree、task先行、既存Draft PRのfast-forward更新、検証・報告を維持した。
- canonical requirements review: SQ-016を一意な正本とし、新しい要求IDを作っていない。
- acceptance criteria／E2E／traceability: Given／When／Then、全件count、定量的なviewport矩形、画面→要件→AC→E2Eを記録した。
- mobile-first UI/UX/a11y: 320×720 CSS pxで末尾到達と水平containmentを測定し、実browser zoom／支援技術の代替ではない境界を明記した。
- no-mock product UI: fixtureはPlaywright routeに限定し、production sourceへ固定値やfallbackを追加していない。
- repository test runner: 依存不要の検査を実行し、依存不足はfinal-head CIへ委譲して未完了として分離した。
