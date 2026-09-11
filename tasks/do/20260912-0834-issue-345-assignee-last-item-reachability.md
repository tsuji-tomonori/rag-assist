# Issue #345 担当者対応32件の末尾viewport到達を320px必須gateにする

- 状態: do
- タスク種別: 機能追加
- 対象Issue: #345
- 対象PR: #470
- 作成日時: 2026-09-12 08:34 JST

## 背景

Draft PR #470 head `433eba82` はcurrent `main@8e542b31`を祖先に含み、behind 0である。既存`E2E-UI-ZOOM-REFLOW-001`は320 CSS pxで担当者対応への到達とdocument rootの水平overflow 0を検証するが、問い合わせ多数件、4レーン、長いtitle／質問／部署名、末尾カードのviewport内到達は測定していない。

直近3回のsliceでお気に入り24件、履歴35件、文書30件の末尾到達を追加済みであるため、今回は同じ測定契約を担当者対応へ適用する。並行PR #461は`AssigneeWorkspace.tsx`を変更するため、production componentには触れず、既存E2E、SQ-016、UI設計、quality matrix、生成文書だけを更新する。

## 目的

320×720 CSS pxの担当者対応で、問い合わせ32件を4レーンに配置し、長い末尾カードへ縦スクロールで到達でき、対象カードの上下端がviewport内に収まることをChromium／Firefox／WebKitのrequired E2Eで継続検証する。

## 対象範囲

- `apps/web/e2e/layout-stress.spec.ts`の問い合わせfixture、4レーン、末尾到達assertion、JSON evidence
- 既存`REQ_SERVICE_QUALITY_016.md`、`DES_UI_UX_001.md`
- authored UI quality matrixと正規generatorによる生成文書
- task、working report、PR／Issue証跡

## 対象外

- `AssigneeWorkspace.tsx`、feature CSS、API、認可、永続化、回答mutation
- browser UIを操作する実200%／400% zoom、text-only zoom、OS scaling
- representative screen reader、native AX tree、touch／実機
- #461統合後の最終DOM再検証、FR-050／FR-051、TC-003、OQ-UI-002、API C1 85%
- merge、deploy、release、force-push

## 実施計画

1. test-only routeで32件、4 status lane、長い先頭／末尾title・質問・部署名を返す。
2. 320pxで4レーンと32カードが表示され、各レーン件数がfixtureと一致することを確認する。
3. DOM末尾の問い合わせカードを`scrollIntoViewIfNeeded()`でviewportへ移動し、`getBoundingClientRect()`の`top >= 0`かつ`bottom <= 720`を検証する。
4. browser project、fixture量、status／lane数、先頭／末尾文字列長、末尾矩形、root／region dimensionsをJSON evidenceへ残す。
5. SQ-016、UI設計、quality matrix、生成物を既存E2E IDへ同期する。
6. 最小十分なlint、Web／E2E typecheck、unit、build、3-browser E2E、docs checksを実行する。
7. Draft PR #470へ受け入れ確認／セルフレビュー、Issue #345へ結果・未完了境界を記録する。

## ドキュメントメンテナンス計画

- reflow品質要求は既存`SQ-016`を唯一の正本とし、新しい要件文書を作らない。
- 画面固有の検証境界は既存`DES_UI_UX_001.md`へ追記する。
- authored quality matrixを更新し、`docs/generated/`は正規generatorで同期する。
- CSS viewportの自動証跡を実browser zoom／実支援技術／実機のpassへ読み替えない。

## 受け入れ条件

### AC-1: 問い合わせ32件を4レーンで表示できる

- Given: 320×720 CSS pxで問い合わせ32件が取得済みで、4 status laneと長い先頭／末尾contentがある。
- When: 担当者対応を開く。
- Then: 32件すべてが問い合わせカードとして表示され、4レーンと各レーン8件の件数表示がある。

### AC-2: DOM末尾の問い合わせカードへviewport内で到達できる

- Given: 問い合わせ32件が4レーンに表示されている。
- When: 利用者相当のスクロールでDOM末尾の問い合わせカードへ移動する。
- Then: 末尾カードが表示され、矩形の`top >= 0`かつ`bottom <= 720`である。

### AC-3: reflowと証跡を維持する

- Given: 末尾カードへ到達した状態である。
- When: document rootと担当者対応regionを測定する。
- Then: `scrollWidth <= clientWidth`で、browser project、viewport、fixture量、lane数、先頭／末尾content長、末尾矩形、dimensionsがJSON evidenceに残る。

### AC-4: 双方向traceを維持する

- Given: 既存の`SQ-016`、`AC-SQ016-001 / 006 / 007`、`E2E-UI-LAYOUT-STRESS-001`が正本である。
- When: 担当者対応多数件の末尾到達境界を追加する。
- Then: 正本、UI設計、quality matrix、生成文書が`assignee → SQ-016 → AC-SQ016-001 / 006 / 007 → E2E-UI-LAYOUT-STRESS-001`で一致する。

### AC-5: 競合境界と品質gateを守る

- Given: #461が担当者対応workspaceのproduction componentを変更している。
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

- 32件すべてのDOM存在と4レーン件数を確認してから末尾矩形を測定しているか。
- `toBeVisible()`をviewport内到達の証明として扱わず、矩形を定量測定しているか。
- test-only fixtureとproduction境界が維持されているか。
- #461のcomponent pathを変更していないか。
- 既存E2E IDと正本を再利用し、重複した要求・生成文書を作っていないか。
- CSS viewport proxyを実browser zoomへ読み替えていないか。

## リスク・未完了境界

- 320 CSS pxはbrowser chromeを含む実400% zoomを証明しない。
- route fixtureは実API／認可／永続化の証跡ではない。
- representative screen reader、native AX tree、実browser zoom、touch／実機、#461統合後再検証、owner判断、既存API build／C1 85%は未完了を維持する。
