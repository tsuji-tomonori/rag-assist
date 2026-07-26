# Issue #345 cross-screen Phase B 作業レポート

- 日時: 2026-07-17 01:07 JST
- 状態: done（Phase B automated scope。Issue #345全体のmanual scopeは継続）
- 対象branch: `codex/issue-345-cross-screen-phase-b`
- base: PR #381 final head `b6acb24ff81acd08981ada8ebb3df63810f6d57b`

## 受けた指示

Phase A evidence / fail matrixを確認し、AppShell / RailNav / target / focus / reflow、assignee 768px overflow、history / favorites / benchmark / admin contrast、benchmark focusabilityを修正する。target-size / nested overflowは根拠なくpassへ変えず、Login / authはPR #382との競合を避ける。matrix、Playwright artifact、task、report、日本語draft PR、final-head CIまで実施し、manual screen reader / real-deviceは未検証とする。merge / deploy / releaseは行わない。

## 要件整理と判断

- Phase A artifact `8380727694`（workflow run `29511170528`）の32 baseline entryを再解析した。
- target-size 4件はassignee checkboxの18×18px、確定overflowはassignee 768px root、確定axe blockerは4画面のcontrastとbenchmark scroll region focusabilityだった。
- candidate overflowは実害のあるreflow / truncationを修正し、visually-hidden label、装飾、native input text viewport、keyboard操作可能なscroll containerだけを要素・意図・owner・代替操作付きの例外として記録する。未分類candidateはPlaywright failureとする。
- automated passだけでSQ-016適合を宣言せず、manual screen reader、実browser zoom、touch / real-deviceをblockedのまま残す。

## 実施作業

- AppShellのprimary `main` landmarkからRailNavを分離した。
- RailNav primary controlsを44px classの明示的なcomputed audit対象にし、home focus indicatorを追加した。
- assigneeを4 / 2 / 1 columnへreflowし、checkboxを24px、back controlを44pxへ変更した。
- muted foreground tokenをAA small-text contrast contractへ合わせ、benchmark hard-coded label colorをtoken化した。
- benchmark / documents horizontal scroll regionをaccessible name付きでfocus可能にし、focus indicatorを追加した。
- documents mobile manager rowのspecificity conflictとchat file-name truncationを修正した。
- computed audit schemaをversion 2へ更新し、根拠付きexceptionとunresolved candidate failure assertionを追加した。
- component / semantic contract testを更新した。Login / auth、製品API、permission、RAG、benchmark dataset固有分岐は変更していない。API配下の変更はSQ-016 task lifecycleを検証するtest-only trace path 1行だけである。

## 検証結果

- `npm ci`: pass。504 packages。npm auditは既存の8 vulnerabilities（low 2 / moderate 1 / high 5）を報告し、自動fixは実施していない。
- changed TypeScript / TSX targeted ESLint: pass。
- `npm run test:web-semantic-ui`: pass。
- targeted Vitest: 3 files / 87 tests pass。
- `npm run typecheck -w @memorag-mvp/web`: pass。
- `npm test -w @memorag-mvp/web`: 61 files / 443 tests pass。
- `npm run build -w @memorag-mvp/web`: pass。既存の500kB超chunk warningあり。
- `npm run docs:web-trace:test`: pass。
- `git diff --check`: pass。
- targeted Playwright cross-screen audit: local sandboxが`tsx` IPC listenを`EPERM`で拒否し、browser実行前にblocked。権限昇格せず、draft PR CI artifactを正式証跡にする。
- draft PR #385 initial Web UI Quality run `29515009875`: failure。artifact `8382337939`、SHA-256 `2e923bbd912f33131356a58a8b4158261ea726cd29b0e892e889d5ead3120528`を保存した。
- initial artifactのcross-screen gateはserious findingを0件、未解決overflow / targetをdocuments 320pxのpagination summary 1件だけと判定してfailureにした。axe blocker assertionはその後段で未到達のため、repair後artifactで確定する。summaryのellipsisを折り返しへ変更し、情報損失を解消した。
- initial visual failure 5件はmuted foreground / 44px RailNav targetによる意図した差分だった。actual / expected / diffを比較し、layout/content欠損がないことを確認してLinux Chromium snapshotを更新した。
- repair run `29515990630`はcross-screen auditを含む9 testをpassし、composite management visualのassignee snapshot差分だけでfailureになった。artifact `8382697984`、SHA-256 `ba773df0f420a702e0292511e326f199a416895cef84f96d98bbf9aa7a2110d2`のactual / diffを確認し、assignee 4-column desktop layoutと情報表示に欠損がないためsnapshotを更新した。
- composite management visualは1画面のsnapshot failureで後続画面を未実行にしないよう、4 screenshotをsoft assertionへ変更した。soft failureもtest全体をfailureにするためgateを弱めず、次回artifactでbenchmark / adminを含む全差分を一括収集する。
- collection run `29516346107`はcross-screen auditを含む9 testをpassし、soft assertionがbenchmark 3,387 pixels / admin 3,743 pixelsのvisual差分を同時に収集した。artifact `8382851928`、SHA-256 `e7083703b815ab525285124900c8d7610e01f19ce8c29746664cf38c4d41037c`のactual / diffを確認し、muted foregroundと44px RailNav / back targetによる意図した差分で、layout・content・操作の欠損がないため両snapshotを更新した。
- 同artifactのcross-screen baseline schema v2は32 entries、root overflow 0、unresolved finding 0、axe serious / critical blocker 0、例外23件（`not_applicable` 16、`supported_scroll` 7）を記録した。全例外に要素・理由・owner・代替操作があり、owner内訳はshared `.sr-only` 12、chat装飾4、documents scroll6、benchmark input1だった。
- snapshot更新後のWeb UI Quality run `29516940570`は10 tests / 10 pass。artifact `8383090126`、SHA-256 `f8c2195f6df4fd481b9d2cf369583ec56eea73c41d78d7fdf32619c5e381297d`をfinal implementation evidenceとして再解析した。
- final implementation artifactは32 entries、root overflow 0、unresolved finding 0、axe serious / critical blocker 0、例外25件（`not_applicable` 16、`supported_scroll` 9）、根拠欠落0だった。owner内訳はshared `.sr-only` 12、chat装飾4、documents scroll6、benchmark input1、assignee input2。viewportごとのnative input差は値と操作を失わないfocus / arrow / Home / End代替として記録されている。
- matrixは全8 AppViewsの`AC-SQ016-001` / `005` / `006`をautomated pass、Phase A failだったhistory / favorites / benchmark / adminの`AC-SQ016-004`とbenchmark `AC-SQ016-002`をautomated passへ更新した。manual statusとoverallは全項目blockedのまま維持する。
- matrix同期後のWeb UI Quality run `29517480218`はsuccessした。一方、同headのMemoRAG CI run `29517480207`はAPI test 801件中1件がfailureだった。coverage値はC0 90.46% / C1 80.42%で、failure原因はcoverage gateではなかった。
- failure test `product requirement documents have non-empty trace references`は、Phase Aでoverall taskを`tasks/todo/`から`tasks/do/`へ移したのに、`apps/api/src/rag/requirements-coverage.test.ts`のSQ-016 traceが旧pathを参照していたため`ENOENT`になった。workflowはPhase B、PR #381、current `origin/main`で同一で、current mainの他PRはtaskがまだ`todo`にあるためpassしていた。
- stale traceをtest-onlyの1行変更で`tasks/do/20260714-issue-345-cross-screen-a11y-responsive.md`へ同期した。targeted API testは1 / 1 pass、CI同等の`npm run test:coverage -w @memorag-mvp/api`は801 / 801 tests pass、C0 90.43% / C1 80.44% / functions 92.89% / lines 90.43%でexit 0だった。
- implementation head `dbf5a7d00b372e23bb4b0184f186dcc708288af6`でWeb UI Quality run `29543391307`とMemoRAG CI run `29543391329`がsuccessした。Web artifact `8393069549`はrequired Chromiumの正規証跡である。
- PR #385へ日本語の受け入れ条件comment `4997641285`とセルフレビューcomment `4997642807`をGitHub Appsで記録した。

## 成果物

- production / audit / test差分: `apps/web/`、`tools/web-inventory/semantic-ui-contract.test.mjs`
- canonical docs: `REQ_SERVICE_QUALITY_016.md`、`DES_UI_UX_001.md`
- task: `tasks/done/20260717-0054-issue-345-cross-screen-phase-b.md`
- matrix: `tools/web-inventory/ui-quality-matrix.json`と`docs/generated/web-ui-quality-matrix.md`へartifact実測を反映した。

## 指示へのfit評価

実装・local static/unit/build検証、CI repair、Playwright artifact / matrix同期、日本語draft PR / AC comment / self-review comment、task lifecycleまで指示範囲にfitしている。Login / auth競合を避け、例外を自動passへ昇格させていない。Phase B automated scopeは完了し、Issue #345全体はmanual scopeを未完了として継続する。

## 未対応・制約・リスク

- manual screen reader、200% / 400% browser zoom、touch / real-deviceは未検証であり、Issue #345全体のmanual evidence taskへ残す。
- Firefox / WebKitはscheduled scopeで未実行。
- local Playwrightはsandbox listen制約でblocked。required Chromium CI artifactで代替したが、local実行済みとは扱わない。
- merge / deploy / releaseは実施しない。
