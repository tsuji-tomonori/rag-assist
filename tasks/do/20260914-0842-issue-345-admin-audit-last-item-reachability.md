# Issue #345 管理監査36件の末尾viewport到達を320px必須gateにする

- 状態: do
- タスク種別: 機能追加
- 対象Issue: #345
- 対象PR: #470
- 作成日時: 2026-09-14 08:42 JST

## 背景

Draft PR #470 head `1cc3b018` はcurrent `main@8e542b31`を祖先に含み、behind 0である。既存`E2E-UI-ZOOM-REFLOW-001`は320 CSS pxで管理者設定への到達とdocument rootの水平overflow 0を検証するが、監査履歴多数件、長い対象・実行者・理由・policy・監査ID、DOM末尾項目のviewport内到達は測定していない。

直近4回のsliceでお気に入り24件、履歴35件、文書30件、担当者対応32件の末尾到達を追加済みであるため、今回は同じ測定契約を管理監査へ適用する。並行PR #461は`AdminWorkspace.tsx`、`AdminOverviewGrid.tsx`、`AdminUserPanel.tsx`を変更するため、production componentには触れず、#461が変更していない`AdminAuditPanel`の既存DOM契約をE2Eから検証する。

## 目的

320×720 CSS pxの管理者設定で監査履歴36件を表示し、長い末尾項目へ縦スクロールで到達でき、対象項目の上下端がviewport内に収まることをChromium／Firefox／WebKitのrequired E2Eで継続検証する。

## 対象範囲

- `apps/web/e2e/layout-stress.spec.ts`の管理API test-only fixture、監査36件、末尾到達assertion、JSON evidence
- 既存`REQ_SERVICE_QUALITY_016.md`、`DES_UI_UX_001.md`
- authored UI quality matrixと正規generatorによる生成文書
- task、working report、PR／Issue証跡

## 対象外

- `AdminWorkspace.tsx`、`AdminAuditPanel.tsx`、feature CSS、API、認可、永続化、export mutation
- browser UIを操作する実200%／400% zoom、text-only zoom、OS scaling
- representative screen reader、native AX tree、touch／実機
- #461統合後の最終DOM再検証、FR-050／FR-051、TC-003、OQ-UI-002、API C1 85%
- merge、deploy、release、force-push

## 実施計画

1. test-only routeで管理APIの成功応答と、36件の監査履歴、長い先頭／末尾contentを返す。
2. 320pxで管理者設定の監査sectionへ移動し、36件すべてが表示されることを確認する。
3. DOM末尾の監査項目を`scrollIntoViewIfNeeded()`でviewportへ移動し、`getBoundingClientRect()`の`top >= 0`かつ`bottom <= 720`を検証する。
4. browser project、fixture量、先頭／末尾文字列長、末尾矩形、root／region dimensionsをJSON evidenceへ残す。
5. SQ-016、UI設計、quality matrix、生成物を既存E2E IDへ同期する。
6. 最小十分なlint、Web／E2E typecheck、unit、build、3-browser E2E、docs checksを実行する。
7. Draft PR #470へ受け入れ確認／セルフレビュー、Issue #345へ結果・未完了境界を記録する。

## ドキュメントメンテナンス計画

- reflow品質要求は既存`SQ-016`を唯一の正本とし、新しい要件文書を作らない。
- 画面固有の検証境界は既存`DES_UI_UX_001.md`へ追記する。
- authored quality matrixを更新し、`docs/generated/`は正規generatorで同期する。
- CSS viewportの自動証跡を実browser zoom／実支援技術／実機のpassへ読み替えない。

## 受け入れ条件

### AC-1: 管理監査36件を表示できる

- Given: 320×720 CSS pxで管理APIが取得済みで、監査履歴36件と長い先頭／末尾contentがある。
- When: 管理者設定の監査sectionを開く。
- Then: 36件すべてが監査項目として表示され、取得件数がfixtureと一致する。

### AC-2: DOM末尾の監査項目へviewport内で到達できる

- Given: 監査履歴36件が表示されている。
- When: 利用者相当のスクロールでDOM末尾の監査項目へ移動する。
- Then: 末尾項目が表示され、矩形の`top >= 0`かつ`bottom <= 720`である。

### AC-3: reflowと証跡を維持する

- Given: 末尾項目へ到達した状態である。
- When: document rootと管理者設定regionを測定する。
- Then: `scrollWidth <= clientWidth`で、browser project、viewport、fixture量、先頭／末尾content長、末尾矩形、dimensionsがJSON evidenceに残る。

### AC-4: 双方向traceを維持する

- Given: 既存の`SQ-016`、`AC-SQ016-001 / 006 / 007`、`E2E-UI-LAYOUT-STRESS-001`が正本である。
- When: 管理監査多数件の末尾到達境界を追加する。
- Then: 正本、UI設計、quality matrix、生成文書が`admin → SQ-016 → AC-SQ016-001 / 006 / 007 → E2E-UI-LAYOUT-STRESS-001`で一致する。

### AC-5: 競合境界と品質gateを守る

- Given: #461が管理画面のproduction componentを変更している。
- When: 本sliceを実装・検証する。
- Then: production component／CSS／API／認可を変更せず、選定したlint、Web／E2E typecheck、unit、build、3-browser E2E、docs checksの結果を記録する。

### AC-6: PR／Issueへ未完了を含めて記録する

- Given: 自動証跡とmanual evidenceの境界が異なる。
- When: PR #470とIssue #345へ進捗を記録する。
- Then: final head、CI、受け入れ確認、セルフレビュー、manual／owner／API C1 blockerを完了扱いせず明記する。

## Done条件

- AC-1〜5が実装headで成立し、PR／Issue証跡まで追加されている。
- final headのWeb UI Qualityとsemver検査が成功している。
- MemoRAG CIまたは手動検証に未達がある場合はtaskを`do`、PRをDraftのまま維持し、全体完了とは報告しない。

## 検証計画

- `git diff --check`
- E2E対象lint、`npm run typecheck:e2e -w @memorag-mvp/web`
- Web typecheck／unit／build
- `E2E-UI-LAYOUT-STRESS-001` discovery／Chromium・Firefox・WebKit実走
- Web trace／semantic UI／quality matrix freshness
- canonical docs／manual evidence schema／hidden Unicode／Taskfile alias
- final-head Web UI Quality／MemoRAG CI／semver

## PRレビュー観点

- 36件すべてのDOM存在を確認してから末尾矩形を測定しているか。
- `toBeVisible()`をviewport内到達の証明として扱わず、矩形を定量測定しているか。
- test-only fixtureとproduction境界が維持されているか。
- #461のcomponent pathを変更していないか。
- 既存E2E IDと正本を再利用し、重複した要求・生成文書を作っていないか。
- CSS viewport proxyを実browser zoomへ読み替えていないか。

## リスク・未完了境界

- 320 CSS pxはbrowser chromeを含む実400% zoomを証明しない。
- route fixtureは実API／認可／永続化の証跡ではない。
- representative screen reader、native AX tree、実browser zoom、touch／実機、#461統合後再検証、owner判断、API C1 85%は未完了を維持する。

## 実装head検証結果

- [x] AC-1: 管理APIのtest-only成功fixtureと監査履歴36件を追加し、件数summaryとDOM項目数の一致を検証した。
- [x] AC-2: DOM末尾の監査項目へscrollし、矩形の`top >= 0`かつ`bottom <= 720`をrequired E2Eで検証した。
- [x] AC-3: document root／管理者設定regionの水平overflowなしと、browser別JSON evidenceを検証した。
- [x] AC-4: `admin → SQ-016 → AC-SQ016-001 / 006 / 007 → E2E-UI-LAYOUT-STRESS-001`を正本、UI設計、quality matrix、生成文書へ同期した。
- [x] AC-5: production component／CSS／API／認可は変更せず、#461との競合境界を維持した。
- [x] AC-6: [PR受け入れ確認](https://github.com/tsuji-tomonori/rag-assist/pull/470#issuecomment-5657313078)、[セルフレビュー](https://github.com/tsuji-tomonori/rag-assist/pull/470#pullrequestreview-5192853048)、[Issue #345進捗](https://github.com/tsuji-tomonori/rag-assist/issues/345#issuecomment-5657313254)へCIと未完了境界を記録した。

remote implementation headは`ea5e2bfc`、外部証跡同期headは`ac0f2f0c`。[Web UI Quality](https://github.com/tsuji-tomonori/rag-assist/actions/runs/34791486035)はRequired E2E TypeScript、Chromium required 41件、Firefox／WebKit required 60件を含めsuccess。[semver検査](https://github.com/tsuji-tomonori/rag-assist/actions/runs/34791486085)もsuccess。[MemoRAG CI](https://github.com/tsuji-tomonori/rag-assist/actions/runs/34791485943)はAPI test／typecheck／buildを含む個別step、Web／docsがsuccess。API C1 80.75%（目標85%、既存改善task `tasks/todo/20260712-coverage-api-c1-recovery.md`）だけが未達で全体failureのため、taskは`do`、PRはDraftを維持する。

ローカルは対象ESLint、Web／E2E typecheck、Web build、Web unit 66 files／473 tests（`TZ=Asia/Tokyo`）、E2E discovery 6件、trace 13件、semantic UI 5件、manual evidence schema 7件、Web inventory freshness、hidden Unicode、Taskfile alias、`git diff --check`がpass。Playwright browser本体の取得はCDN timeoutで停止したため、ローカル実走をpassとは扱わずremote required gateを証跡とする。
