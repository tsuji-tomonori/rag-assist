# Issue #345 cross-browser content-extreme required gate 作業レポート

保存先: `reports/working/20260815-0849-issue-345-cross-browser-layout-stress-required-gate.md`

## 1. 受けた指示

- current main、前回以降の変更、open PR／Issue、task、正本・生成物を確認する。
- Issue #345を重複しない最優先の小さな改善1件で前進させる。
- 受け入れ条件付きtask、実装、正本・生成物同期、最小十分な検証、Draft PR更新、Issueコメントまで行う。
- 320px／400% zoom、keyboard／screen reader、各種状態、追跡可能性、並行PR競合、正本文書の一意性を優先する。
- manual／CI／owner未確認を完了扱いせず、merge／deploy／release／破壊的変更を行わない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
| --- | --- | ---: | --- |
| R1 | latest mainと#462、open PR／Issueを確認 | 高 | 対応 |
| R2 | 非重複の小さなUI改善を1件選定 | 高 | Firefox／WebKit content-extreme required gateを選定 |
| R3 | task→実装→正本→生成物→E2Eの追跡 | 高 | 対応 |
| R4 | lint、typecheck、unit、E2E、docs check | 高 | local実ブラウザ以外は成功、E2E実走はCI待ち |
| R5 | Draft PR #462とIssue #345を更新 | 高 | final-head CI後に更新予定 |
| R6 | manual／owner未検証を残す | 高 | blocked／未完了を維持 |

## 3. 検討・判断

- current `main@8e542b31`と#462 `fd668b85`はbehind 0であり、main再統合は不要だった。
- open UI PR #461はshared UI primitiveとproduction componentを広く変更するため、当初はproduction UI／shared sourceを変更しない方針とした。ただしrequired CIが履歴CSSの実不具合を検出したため、#461が変更しない`history.css`の検索入力selectorだけを修正対象へ追加した。
- 前回の640／320 CSS px到達・root overflow gateを、長文回答、長い引用・ファイル名、履歴35件、確認済み0件、reduced motion、region overflowへ深める既存`E2E-UI-LAYOUT-STRESS-001`を選定した。
- cross-browser required増分は2 scenario×2 browserの4件だけとし、より広いvisual scopeはscheduledのまま維持した。
- #461との新規path overlapは正規generator出力`docs/generated/web-ui-inventory.json`だけである。authored sourceは競合せず、#461統合時は最終sourceからgeneratorを再実行する。
- 自動viewport／fixture証跡は実browser zoom、screen reader、touch、実機を証明しないため、manual／overall statusを`blocked`のまま維持した。

## 4. 実施作業

- `tasks/do/20260815-0849-issue-345-cross-browser-layout-stress-required-gate.md`を作成し、5件の受け入れ条件を固定した。
- `layout-stress.spec.ts`のJSONとattachment名へPlaywright browser projectを追加した。
- Firefox／WebKit required scriptへ既存layout-stress 2 scenarioを追加し、workflow表示名を同期した。
- `SQ-016`、`NFR-018`、UI設計、machine-readable trace／quality matrix、E2E READMEを同期した。
- 正規generatorでWeb trace／inventory／quality matrixを再生成した。
- 14件のcross-browser discovery、repository lint、Web typecheck／unit／build、trace／semantic／manual evidence、canonical／generated docs checksを実行した。
- 実装head `c5b8a8d9` のrequired CIではFirefoxが全件成功し、WebKitの履歴35件だけが再試行を含め`clientWidth=320`／`scrollWidth=386`で失敗した。artifactのスクリーンショットではcheckboxが横幅全体を占有してラベルをregion外へ押し出していた。
- `.history-toolbar input`がsearch inputとcheckboxの両方へ`width: 100%`を与えていたため、`input[type="search"]`へ限定した。期待値やE2E fixtureは緩和していない。

## 5. 検証結果

| 検証 | 結果 | 補足 |
| --- | --- | --- |
| `npm ci --cache /tmp/npm-cache-issue345-20260815` | pass | lockfile install 504 packages |
| `npm run lint` | pass | warning 0 |
| Web typecheck | pass | `tsc --noEmit` |
| Web unit | pass | 62 files／447 tests |
| Web build | pass | 既存chunk-size advisoryのみ |
| cross-browser required discovery | pass | Firefox 7＋WebKit 7、合計14 tests／5 files |
| cross-browser layout-stress実走 | blocked | webServer起動前にsandbox network approval boundaryで拒否。CIを必須証跡とする |
| 実装head Web UI Quality | fail（修正前） | Firefox 7／7、WebKit 6／7。履歴region overflowを再試行でも検出し、CSS selectorを修正 |
| 修正head Web UI Quality | pass | run `31853021631`。初回attemptは別のWebKit長文chatが1 flaky、cross-browser job再実行はretryなし14／14 |
| cross-browser artifact | pass | `9238209862`、digest `sha256:103156b62fcf3b270d457028c8a516b0e0ab2bb6d4056b075e2e5154b16e1504` |
| 修正head MemoRAG CI | pass | run `31853021579`。lint、typecheck、docs、unit、coverage、build、synthを含む |
| 修正head semver | pass | run `31853021619` |
| UI trace | pass | 13 tests |
| semantic UI | pass | 5 tests |
| manual evidence contract | pass | 7 tests。baselineはblocked 3／not_run 1、release-ready false |
| Web generated freshness | pass | 正規generator後にfresh |
| canonical docs | pass | `scripts/validate_docs.py` |
| OpenAPI | pass | `node --import tsx`でquality check |
| API code docs | pass | 98 APIs／588 documents |
| infra／hidden Unicode／Taskfile alias／diff | pass | 差分なし |

## 6. 成果物

| 成果物 | 内容 | 指示との対応 |
| --- | --- | --- |
| task | 受け入れ条件、検証計画、未完了境界 | task要件 |
| E2E／workflow | Firefox／WebKit 4件のrequired増分 | 320px・content extremes |
| 正本／authored matrix | SQ-016、NFR-018、UI設計、trace、quality matrix | 追跡・正本同期 |
| generated docs | Web trace、inventory、quality matrix | 生成物同期 |
| 本レポート | 判断、検証、blocker、次作業 | 作業報告 |

## 7. 未完了・制約・リスク

- evidence-only headのGitHub Actions、Draft PR本文／受け入れ確認／セルフレビュー、Issue #345コメントはrepository evidence公開後に実施する。
- 修正headのFirefox／WebKit required 14件は再実行でretryなし全件成功した。初回attemptの別scenario 1 flakyは隠さず記録し、履歴overflowの再発ではないことをjob logで確認した。
- representative screen reader、browser UIを操作する実200%／400% zoom、text-only zoom、OS scaling、touch／real device、Firefox／WebKit native accessibility treeは未実施である。
- FR-051永続化／profile state contract、API C1 85%、OQ-UI-002 owner／cadenceは未解決である。
- PR #461との生成物重複は、統合順に応じて最終sourceからgeneratorを再実行する必要がある。

## 8. 次の具体的作業

1. 履歴CSS selector修正を#462 branchへ非破壊pushする。
2. evidence-only headのGitHub Actionsを確認する（修正headの必須3 workflowは成功済み）。
3. task／completion status／本レポートへCI証跡を追記する。
4. Draft PR本文、受け入れ確認、セルフレビュー、Issue #345を更新する。

## 9. 指示へのfit評価

総合fit: 4.7 / 5.0（約94%）

理由: 実装・正本・生成物・local検証・実装head CIは同期したが、evidence-only headとGitHub記録、manual／owner依存項目が未完了であるため、Issue全体は完了扱いにしない。
