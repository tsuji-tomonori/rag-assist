# Issue #345 文書30件の末尾viewport到達を320px必須gateにする

- 状態: do
- タスク種別: 機能追加
- 対象Issue: #345
- 対象PR: #470
- 作成日時: 2026-09-11 08:36 JST

## 背景

Draft PR #470 head `f7c6d009` はcurrent `main@8e542b31`を祖先に含み、behind 0である。既存`E2E-UI-LAYOUT-STRESS-001`は320×720 CSS pxでドキュメント画面の長いファイル名1件と水平overflow 0を検証するが、多数件、ページサイズ変更後の全件表示、末尾項目のviewport到達を測定していない。

前2回のsliceでお気に入り24件と履歴35件の末尾viewport到達を追加済みであるため、今回は同じ測定契約をドキュメント一覧へ適用する。並行PR #461は`DocumentWorkspace.tsx`と関連UIを変更するため、production componentには触れず、既存E2E、SQ-016、UI設計、quality matrix、生成文書だけを更新する。

## 目的

320×720 CSS pxのドキュメント30件表示で、表示件数を変更して全件を同一ページに表示し、長い末尾ファイル名へ縦スクロールで到達でき、対象要素の上下端がviewport内に収まることをChromium／Firefox／WebKitのrequired E2Eで継続検証する。

## 対象範囲

- `apps/web/e2e/layout-stress.spec.ts`の文書fixture、全件表示、末尾到達assertion、JSON evidence
- 既存`REQ_SERVICE_QUALITY_016.md`、`DES_UI_UX_001.md`
- authored UI quality matrixと正規generatorによる生成文書
- task、working report、PR／Issue証跡

## 対象外

- `DocumentWorkspace.tsx`、`DocumentFilePanel.tsx`、feature CSS、API、認可、永続化、文書mutation
- browser UIを操作する実200%／400% zoom、text-only zoom、OS scaling
- representative screen reader、native AX tree、touch／実機
- #461統合後の最終DOM再検証、FR-050／FR-051、TC-003、OQ-UI-002、API C1 85%
- merge、deploy、release、force-push

## 実施計画

1. test-only routeで30件、複数file type、長い先頭／末尾ファイル名を返す。
2. 320pxで表示件数を50件へ変更し、30件すべてが同一ページに表示されることを確認する。
3. 末尾ファイル名を`scrollIntoViewIfNeeded()`でviewportへ移動し、`getBoundingClientRect()`の`top >= 0`かつ`bottom <= 720`を検証する。
4. browser project、fixture量、表示件数、先頭／末尾ファイル名長、末尾矩形、root／region dimensionsをJSON evidenceへ残す。
5. SQ-016、UI設計、quality matrix、生成物を既存E2E IDへ同期する。
6. 最小十分なlint、Web／E2E typecheck、unit、build、3-browser E2E、docs checksを実行する。
7. Draft PR #470へ受け入れ確認／セルフレビュー、Issue #345へ結果・未完了境界を記録する。

## ドキュメントメンテナンス計画

- reflow品質要求は既存`SQ-016`を唯一の正本とし、新しい要件文書を作らない。
- 画面固有の検証境界は既存`DES_UI_UX_001.md`へ追記する。
- authored quality matrixを更新し、`docs/generated/`は正規generatorで同期する。
- CSS viewportの自動証跡を実browser zoom／実支援技術／実機のpassへ読み替えない。

## 受け入れ条件

### AC-1: 文書30件を同一ページで表示できる

- Given: 320×720 CSS pxで文書30件が取得済みで、複数file typeと長い先頭／末尾ファイル名がある。
- When: 表示件数を50件へ変更する。
- Then: 30件すべてが同一ページの文書rowとして表示され、件数summaryが30件を示す。

### AC-2: 文書末尾へviewport内で到達できる

- Given: 文書30件が同一ページに表示されている。
- When: 利用者相当のスクロールで末尾ファイル名へ移動する。
- Then: 末尾ファイル名が表示され、矩形の`top >= 0`かつ`bottom <= 720`である。

### AC-3: reflowと証跡を維持する

- Given: 文書30件の末尾へ到達した状態である。
- When: document rootとドキュメント管理regionを測定する。
- Then: `scrollWidth <= clientWidth`で、browser project、viewport、fixture量、表示件数、先頭／末尾ファイル名長、末尾矩形、dimensionsがJSON evidenceに残る。

### AC-4: 双方向traceを維持する

- Given: 既存の`SQ-016`、`AC-SQ016-001 / 006 / 007`、`E2E-UI-LAYOUT-STRESS-001`が正本である。
- When: 文書多数件の末尾到達境界を追加する。
- Then: 正本、UI設計、quality matrix、生成文書が`documents → SQ-016 → AC-SQ016-001 / 006 / 007 → E2E-UI-LAYOUT-STRESS-001`で一致する。

### AC-5: 競合境界と品質gateを守る

- Given: #461が文書workspaceのproduction componentを変更している。
- When: 本sliceを実装・検証する。
- Then: production component／CSS／API／認可を変更せず、選定したlint、Web／E2E typecheck、unit、build、3-browser E2E、docs checksの結果を記録する。

### AC-6: PR／Issueへ未完了を含めて記録する

- Given: 自動証跡とmanual evidenceの境界が異なる。
- When: PR #470とIssue #345へ進捗を記録する。
- Then: final head、CI、受け入れ確認、セルフレビュー、manual／owner／既存API blockerを完了扱いせず明記する。

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

- 30件すべてのDOM存在と件数summaryを確認してから末尾矩形を測定しているか。
- `toBeVisible()`をviewport内到達の証明として扱わず、矩形を定量測定しているか。
- test-only fixtureとproduction境界が維持されているか。
- #461のcomponent／CSS pathを変更していないか。
- 既存E2E IDと正本を再利用し、重複した要求・生成文書を作っていないか。
- CSS viewport proxyを実browser zoomへ読み替えていないか。

## リスク・未完了境界

- 320 CSS pxはbrowser chromeを含む実400% zoomを証明しない。
- route fixtureは実API／認可／永続化の証跡ではない。
- representative screen reader、native AX tree、実browser zoom、touch／実機、#461統合後再検証、owner判断、既存API build／C1 85%は未完了を維持する。

## 実装head検証結果

- 実装head: `a05916e2`
- [x] AC-1: 320×720 CSS pxで初期25件を確認後、表示件数50件へ変更し、文書row 30件と`1-30 / 30 件を表示`を検証するE2Eを追加した。
- [x] AC-2: defaultの更新日新しい順で末尾になる最古文書の長いファイル名をviewport内へscrollし、`top >= 0`／`bottom <= 720`を検証するE2Eを追加した。
- [x] AC-3: root／documents regionの水平overflow 0を維持し、6 file type、表示件数、先頭／末尾ファイル名長、末尾矩形、dimensionsをbrowser別JSON evidenceへ追加した。
- [x] AC-4: `documents → SQ-016 → AC-SQ016-001 / 006 / 007 → E2E-UI-LAYOUT-STRESS-001`を正本、UI設計、authored／generated quality matrixで同期した。
- [x] AC-5: production component／CSS／API／認可を変更していない。依存不要のdocs／trace検査は成功し、依存を要するlint／typecheck／unit／build／3-browser E2Eはfinal-head CI待ちである。
- [ ] AC-6: PR／Issue証跡はfinal-head CI確認後に追加する。

### ローカル検証

- `python3 scripts/validate_docs.py`: pass
- `node --test tools/web-inventory/ui-traceability.test.mjs tools/web-inventory/ui-quality-matrix.test.mjs`: pass、13件
- `node --test tools/web-inventory/semantic-ui-contract.test.mjs`: pass、5件
- `node tools/web-inventory/manual-a11y-evidence.test.mjs`: pass、7件
- `node tools/web-inventory/manual-a11y-evidence.mjs reports/working/issue-345-manual-a11y-evidence-baseline.json`: pass、`ready: false`（blocked 3／not_run 1を維持）
- `node tools/web-inventory/generate-ui-quality-matrix.mjs --check`: pass
- `node tools/infra-inventory/generate-infra-inventory.mjs --check`: pass
- `node scripts/check-hidden-unicode.mjs docs reports tasks`: pass
- `node scripts/check-taskfile-legacy-aliases.mjs`: pass
- `git diff --check`: pass
- `npm run ...`／`node tools/web-inventory/generate-web-inventory.mjs --check`: blocked。cloneに`node_modules`がなく、依存解決のnetwork approvalが非対話実行で中断され、`typescript`を解決できないため。エスカレーションは行わずfinal-head CIへ委譲する。
