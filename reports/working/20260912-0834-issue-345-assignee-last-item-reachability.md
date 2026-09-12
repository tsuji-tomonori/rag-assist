# Issue #345 担当者対応末尾viewport到達 作業レポート

## 結果

320×720 CSS pxの`E2E-UI-LAYOUT-STRESS-001`を、担当者対応32件／4 status laneへ拡張した。4レーンへ8件ずつ配置し、長いtitle／質問／部署名を含む全32件が存在することを確認した後、DOM末尾カードへscrollして上下端がviewport内に収まることを明示的に測定する。

production component／CSSは変更せず、#461が変更する`AssigneeWorkspace.tsx`との競合を避けた。reflow要求は既存`SQ-016`、E2Eは既存`E2E-UI-LAYOUT-STRESS-001`を再利用し、正本を増やしていない。

## 受けた指示と判断

- current main、前回head、open PR／Issue、task台帳、正本／生成文書を確認し、既存作業と重複しない小さな改善を1件選ぶ。
- 直近3回でお気に入り24件、履歴35件、文書30件の末尾到達が追加された一方、担当者対応は多数件／4レーンの末尾到達を測定していなかったため、次の優先sliceとした。
- 320 CSS pxは実browser 400% zoomの代替ではなく、automation境界を正本・設計・artifactへ維持する。

## 変更

- `apps/web/e2e/layout-stress.spec.ts`: 問い合わせ32件／4 status lane、長い先頭／末尾title・質問・部署名、末尾scroll／viewport矩形、root／region containment、browser別JSON evidenceを追加。
- `REQ_SERVICE_QUALITY_016.md`／`REQ_NON_FUNCTIONAL_018.md`: assigneeの多数件、4レーン、末尾viewport到達を既存E2E契約へ同期。
- `DES_UI_UX_001.md`: 320px content-extremeの画面固有境界とattachment項目を同期。
- `tools/web-inventory/ui-quality-matrix.json`: assigneeのAC-SQ016-001／006／007を同期。
- `docs/generated/web-ui-quality-matrix.md`: 正規generatorで同期。
- `apps/web/e2e/README.md`: required content-extremeの対象画面を5画面へ同期。
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
| ローカルE2E TypeScript | blocked。依存不在で`tsc: not found` |
| Web unit／coverage | CI pass。473件、C0 90.02%／C1 85.12% |
| E2E TypeScript | CI pass |
| Chromium required | pass。41件 |
| Firefox／WebKit required | pass。60件 |
| semver | pass |
| MemoRAG CI全体 | failure。API C1 80.75%と既存fixture型不整合によるAPI typecheck／build |

remote implementation head `b1cf2c57`の[Web UI Quality](https://github.com/tsuji-tomonori/rag-assist/actions/runs/34659235875)はsuccessとなり、E2E TypeScript、Chromium 41件、Firefox／WebKit 60件を通過した。[semver検査](https://github.com/tsuji-tomonori/rag-assist/actions/runs/34659235896)もsuccess。

evidence head `725a7f19`の[Web UI Quality](https://github.com/tsuji-tomonori/rag-assist/actions/runs/34659920279)と[semver検査](https://github.com/tsuji-tomonori/rag-assist/actions/runs/34659920335)もsuccess。[MemoRAG CI](https://github.com/tsuji-tomonori/rag-assist/actions/runs/34659920312)は外部証跡同期時点で実行中のため、完了待ちを未完了として扱う。

[MemoRAG CI](https://github.com/tsuji-tomonori/rag-assist/actions/runs/34659235842)ではWeb test 473件を通過した。API test 1,051件はpassしたが、C1 80.75%（目標85%）と既存test fixtureのreadonly／history input型不整合によるAPI typecheck／buildのため全体はfailure。

## 受け入れ判断

local implementation commit `2978c664`とremote implementation head `b1cf2c57`でAC-1〜5に対応する差分と3-browser gateを確認した。画面→要件→受け入れ条件→E2Eは`assignee → SQ-016 → AC-SQ016-001 / 006 / 007 → E2E-UI-LAYOUT-STRESS-001`で一致する。

[PR受け入れ確認](https://github.com/tsuji-tomonori/rag-assist/pull/470#issuecomment-5642014649)、[セルフレビュー](https://github.com/tsuji-tomonori/rag-assist/pull/470#pullrequestreview-5184347859)、[Issue #345進捗](https://github.com/tsuji-tomonori/rag-assist/issues/345#issuecomment-5642033845)を記録した。既存API blocker、evidence headのMemoRAG CI完了待ち、manual evidenceが残るため、taskは`do`、PRはDraftを維持する。

## 未完了

- evidence head `725a7f19`のMemoRAG CI完了確認。
- 既存API fixture型不整合によるtypecheck／build失敗とAPI C1 80.75%（目標85%）。
- representative screen reader、Firefox／WebKit native AX tree、実browser 200%／400% zoom、text-only zoom、OS scaling、touch／実機、manual keyboard／contrast。
- 実API／AWS認可、#461統合後の最終DOM再検証。
- FR-050／FR-051、TC-003、OQ-UI-002、branch protection／owner判断。

merge、deploy、release、force-pushは実施しない。

## Skill適合度

- worktree task PR flow: 専用worktree、task先行、既存Draft PRのfast-forward更新、検証・報告を維持した。
- canonical requirements review: SQ-016を一意な正本とし、新しい要求IDを作っていない。
- acceptance criteria／E2E／traceability: Given／When／Then、全件count、レーン別count、定量的なviewport矩形、画面→要件→AC→E2Eを記録した。
- mobile-first UI/UX/a11y: 320×720 CSS pxで末尾到達と水平containmentを測定し、実browser zoom／支援技術の代替ではない境界を明記した。
- no-mock product UI: fixtureはPlaywright routeに限定し、production sourceへ固定値やfallbackを追加していない。
- repository test runner: 依存不要の検査を実行し、依存不足はremote required gateへ委譲して未完了境界を分離した。
