# Issue #345 管理監査36件の320px末尾到達

## 結果概要

Draft PR #470へ、管理者設定の監査履歴36件を320×720 CSS pxで表示し、DOM末尾項目のviewport内到達とdocument root／管理者設定regionの水平overflowなしをChromium／Firefox／WebKit required E2Eで検証するsliceを追加した。

既存`E2E-UI-LAYOUT-STRESS-001`へ統合したためrequired test件数は増やしていない。production component／CSS／API／認可は変更せず、並行PR #461が変更していない`AdminAuditPanel`の既存DOM契約をtest-only fixtureから検証した。

## 選定根拠

- current `main@8e542b31`は前回から更新されていない。
- Draft PR #470の前head `1cc3b018`はmainを祖先に含みbehind 0だった。
- 既存populated layout stressはchat、favorites、history、documents、assigneeを対象とし、adminは未対象だった。
- adminはkeyboard、semantic、loading／partial／retry／stale／permissionの横断ブラウザ証跡を持つ一方、多数件の縦到達は未測定だった。
- open PR #461は`AdminWorkspace.tsx`、`AdminOverviewGrid.tsx`、`AdminUserPanel.tsx`を変更するため、本sliceではproduction pathを変更せず競合を限定した。

## 変更内容

- 管理APIのtest-only成功fixtureを`layout-stress.spec.ts`へ追加した。
- 監査履歴36件に、長い対象・実行者・理由・policy・監査IDと複数resultを含めた。
- 管理者設定から監査sectionへ移動し、36件全件と件数summaryを確認した。
- DOM末尾の監査項目へ`scrollIntoViewIfNeeded()`で移動し、`top >= 0`、`bottom <= 720`を定量確認した。
- JSON evidenceへfixture量、文字列長、末尾矩形、root／region dimensionsを追加した。
- `SQ-016`、`DES_UI_UX_001`、authored quality matrix、生成quality matrixを同期した。

## トレーサビリティ

`admin → SQ-016 → AC-SQ016-001 / AC-SQ016-006 / AC-SQ016-007 → E2E-UI-LAYOUT-STRESS-001`

正本は既存`REQ_SERVICE_QUALITY_016.md`の1件を維持し、画面固有境界を`DES_UI_UX_001.md`とquality matrixへ反映した。生成文書は`npm run docs:web-inventory`から更新し、手編集していない。

## ローカル検証

- `npx eslint apps/web/e2e/layout-stress.spec.ts --max-warnings=0`: pass
- Web typecheck／E2E typecheck: pass
- Web build: pass
- `TZ=Asia/Tokyo npm test -w @memorag-mvp/web`: 66 files／473 tests pass
- E2E discovery: Chromium／Firefox／WebKit、2 scenarioずつ、合計6件
- Web trace: 13 tests pass
- semantic UI contract: 5 tests pass
- manual evidence schema: 7 tests pass
- Web inventory freshness、hidden Unicode、Taskfile alias、`git diff --check`: pass

初回のWeb unitはhost timezoneで日付表示が前日となる既存2件が失敗したが、repository運用タイムゾーンの`TZ=Asia/Tokyo`を明示した再実行で473件すべて成功した。本sliceは日付formatterや該当unitを変更していない。

Playwright browser本体のローカル取得はCDNへの30秒timeoutを繰り返したため停止した。ローカル3-browser実走はpassとせず、GitHub Actions required gateで検証した。

## GitHub Actions

- implementation head `ea5e2bfc`
- [Web UI Quality 34791137327](https://github.com/tsuji-tomonori/rag-assist/actions/runs/34791137327): success。Required E2E TypeScript、Chromium required、Firefox／WebKit requiredを通過。
- [Validate Semver Label 34791137353](https://github.com/tsuji-tomonori/rag-assist/actions/runs/34791137353): success。
- [MemoRAG CI 34791137334](https://github.com/tsuji-tomonori/rag-assist/actions/runs/34791137334): 実行中。確定前なので未完了。

## 受け入れ判断

AC-1〜5はimplementation headで満たした。PR／Issue証跡とfinal headのCI確定を要するAC-6は未完了である。taskは`do`、PRはDraftを維持する。

## 未完了

- MemoRAG CIの完了確認。
- representative screen reader、Firefox／WebKit native AX tree、実browser 200%／400% zoom、text-only zoom、OS scaling、touch／実機、manual keyboard／contrast。
- 実API／AWS認可、#461統合後の最終DOM再検証。
- FR-050／FR-051、TC-003、OQ-UI-002、owner判断、既存API build／C1 85%。

merge、deploy、release、force-pushは実施していない。
