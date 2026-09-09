# Issue #345 履歴35件の末尾viewport到達を320px必須gateにする

- 状態: do
- タスク種別: 機能追加
- 対象Issue: #345
- 対象PR: #470
- 作成日時: 2026-09-10 08:11 JST

## 背景

Draft PR #470 head `30bcb90d` はcurrent `main@8e542b31`を祖先に含み、behind 0である。既存`E2E-UI-LAYOUT-STRESS-001`は320×720 CSS pxで履歴35件と長い先頭／末尾titleをDOM上に表示し、regionの水平overflow 0を検証する。一方、末尾titleはPlaywrightの`toBeVisible()`だけで、実際にviewport内へスクロールして上下端に収まることを測定していない。

前回sliceでお気に入り24件の末尾viewport到達を追加済みであるため、今回は同じ測定契約を履歴35件へ適用する。並行PR #461は`HistoryWorkspace.tsx`を変更するため、production componentには触れず、既存E2E、SQ-016、UI設計、quality matrix、生成文書だけを更新する。

## 目的

320×720 CSS pxの履歴35件表示で、長い末尾titleへ縦スクロールで到達でき、対象要素の上下端がviewport内に収まることをChromium／Firefox／WebKitのrequired E2Eで継続検証する。

## 対象範囲

- `apps/web/e2e/layout-stress.spec.ts`の履歴末尾到達assertionとJSON evidence
- 既存`REQ_SERVICE_QUALITY_016.md`、`DES_UI_UX_001.md`
- authored UI quality matrixと正規generatorによる生成文書
- task、spec analysis、working report、PR／Issue証跡

## 対象外

- `HistoryWorkspace.tsx`、API、認可、永続化、削除／お気に入りmutation
- browser UIを操作する実200%／400% zoom、text-only zoom、OS scaling
- representative screen reader、native AX tree、touch／実機
- #461統合後の最終DOM再検証、FR-050／FR-051、TC-003、OQ-UI-002、API C1 85%
- merge、deploy、release、force-push

## 実施計画

1. 履歴35件の末尾titleを`scrollIntoViewIfNeeded()`でviewportへ移動する。
2. 末尾titleの`getBoundingClientRect()`を取得し、`top >= 0`かつ`bottom <= 720`を検証する。
3. browser project、fixture量、末尾title長、末尾矩形、root／region dimensionsをJSON evidenceへ残す。
4. SQ-016、UI設計、quality matrix、生成物を既存E2E IDへ同期する。
5. 最小十分なlint、Web／E2E typecheck、unit、build、E2E、docs checksを実行する。
6. Draft PR #470へ受け入れ確認／セルフレビュー、Issue #345へ結果・未完了境界を記録する。

## ドキュメントメンテナンス計画

- reflow品質要求は既存`SQ-016`を唯一の正本とし、新しい要件文書を作らない。
- 画面固有の検証境界は既存`DES_UI_UX_001.md`へ追記する。
- authored quality matrixを更新し、`docs/generated/`は正規generatorで同期する。
- CSS viewportの自動証跡を実browser zoom／実支援技術／実機のpassへ読み替えない。

## 受け入れ条件

### AC-1: 履歴末尾へviewport内で到達できる

- Given: 320×720 CSS pxで履歴35件が取得済みで、1件目と35件目に長いtitleがある。
- When: 利用者相当のスクロールで35件目のtitleへ移動する。
- Then: 35件目のtitleが表示され、矩形の`top >= 0`かつ`bottom <= 720`である。

### AC-2: reflowと証跡を維持する

- Given: 履歴35件の末尾へ到達した状態である。
- When: document rootと履歴regionを測定する。
- Then: `scrollWidth <= clientWidth`で、browser project、viewport、fixture量、末尾title長、末尾矩形、dimensionsがJSON evidenceに残る。

### AC-3: 双方向traceを維持する

- Given: 既存の`SQ-016`、`AC-SQ016-001 / 006 / 007`、`E2E-UI-LAYOUT-STRESS-001`が正本である。
- When: 履歴末尾到達の検証境界を追加する。
- Then: 正本、UI設計、quality matrix、生成文書が`history → SQ-016 → AC-SQ016-001 / 006 / 007 → E2E-UI-LAYOUT-STRESS-001`で一致する。

### AC-4: 競合境界と品質gateを守る

- Given: #461が`HistoryWorkspace.tsx`を変更している。
- When: 本sliceを実装・検証する。
- Then: production component／API／認可を変更せず、選定したlint、Web／E2E typecheck、unit、build、3-browser E2E、docs checksの結果を記録する。

### AC-5: PR／Issueへ未完了を含めて記録する

- Given: 自動証跡とmanual evidenceの境界が異なる。
- When: PR #470とIssue #345へ進捗を記録する。
- Then: final head、CI、受け入れ確認、セルフレビュー、manual／owner／既存API blockerを完了扱いせず明記する。

## 検証計画

- `git diff --check`
- E2E対象lint、`npm run typecheck:e2e -w @memorag-mvp/web`
- Web typecheck／unit／build
- `E2E-UI-LAYOUT-STRESS-001` discovery／Chromium・Firefox・WebKit実走
- Web trace／semantic UI／quality matrix freshness
- canonical docs／manual evidence schema／hidden Unicode／Taskfile alias
- final-head Web UI Quality／MemoRAG CI／semver

## PRレビュー観点

- `toBeVisible()`をviewport内到達の証明として扱わず、矩形を定量測定しているか。
- test-only fixtureとproduction境界が維持されているか。
- #461のcomponent pathを変更していないか。
- 既存E2E IDと正本を再利用し、重複した要求・生成文書を作っていないか。
- CSS viewport proxyを実browser zoomへ読み替えていないか。

## リスク・未完了境界

- 320 CSS pxはbrowser chromeを含む実400% zoomを証明しない。
- route fixtureは実API／認可／永続化の証跡ではない。
- representative screen reader、native AX tree、実browser zoom、touch／実機、#461統合後再検証、owner判断、既存API build／C1 85%は未完了を維持する。

## 実装head検証結果

- 実装head: `344535d7`
- [x] AC-1: 320×720 CSS pxで履歴35件の末尾titleをviewport内へscrollし、`top >= 0`／`bottom <= 720`をChromium／Firefox／WebKit required E2Eで確認した。
- [x] AC-2: root／history regionの水平overflow 0を維持し、browser project、fixture量、先頭／末尾title長、末尾矩形、dimensionsをJSON evidenceへ追加した。
- [x] AC-3: `history → SQ-016 → AC-SQ016-001 / 006 / 007 → E2E-UI-LAYOUT-STRESS-001`を正本、UI設計、authored／generated quality matrixで同期した。
- [x] AC-4: production component／API／認可を変更していない。Web UI QualityはChromium 41件、Firefox／WebKit 60件、E2E TypeScriptを含め成功した。MemoRAG CI内のWeb lint／typecheck／unit 473件／coverage／build、正本／trace／生成物検査も成功した。
- [x] AC-5: PRの[受け入れ確認](https://github.com/tsuji-tomonori/rag-assist/pull/470#issuecomment-5610390593)／[セルフレビュー](https://github.com/tsuji-tomonori/rag-assist/pull/470#pullrequestreview-5161080227)、Issue #345の[進捗・未完了記録](https://github.com/tsuji-tomonori/rag-assist/issues/345#issuecomment-5610398347)を追加した。証跡専用final headのCI結果はPR／Issue上で追記する。

### CI

- Web UI Quality: https://github.com/tsuji-tomonori/rag-assist/actions/runs/34416784264 （success）
- Validate Semver Label: https://github.com/tsuji-tomonori/rag-assist/actions/runs/34416784257 （success）
- MemoRAG CI: https://github.com/tsuji-tomonori/rag-assist/actions/runs/34416784260 （failure）
  - 本slice対象のWebと文書検査はsuccess。Web C0 90.02%／C1 85.12%。
  - 既存API test fixture型不整合によるAPI typecheck／buildと、API C1 80.75%（目標85%）はfailure。API test自体は1051件pass。
