# Issue #345 お気に入り実データの320px layout stressを必須gateにする

- 状態: do
- タスク種別: 機能追加
- 対象Issue: #345
- 対象PR: #470
- 作成日時: 2026-09-09 08:08 JST

## 背景

Draft PR #470 head `da9507cf` は current `main@8e542b31` を祖先に含み、behind 0である。`E2E-UI-LAYOUT-STRESS-001` はChromium／Firefox／WebKitの必須gateで320×720 CSS pxを検証するが、お気に入り画面は確認済み0件だけを対象にしている。長いlabel／target ID、多数件、アクセス不可cueを含む実データ表示時のregion overflowと末尾到達は未検証である。

並行Draft PR #461は`FavoritesWorkspace.tsx`を変更するため、今回sliceはproduction sourceを避け、既存E2Eのtest-only fixtureと一意な正本／quality metadataだけを更新する。

## 目的

お気に入りの実データ極端値を320pxで表示し、長い文字列、多数件、アクセス不可cue、先頭／末尾への到達、document root／regionの水平containmentを3 browserの既存required gateで検証する。確認済み0件の既存証跡も維持する。

## 対象範囲

- `apps/web/e2e/layout-stress.spec.ts`のtest-only favorites fixtureとassertion
- `SQ-016`、`DES_UI_UX_001`、UI quality matrix
- repository generatorが更新する`docs/generated/`
- task、spec analysis、working report、PR／Issue証跡

## 対象外

- production component／CSS／API／authorization／RAG contract
- favorite resume／delete機能
- browser UIを操作する実200%／400% zoom、text-only zoom、OS scaling
- representative screen reader、native AX tree、touch／実機
- #461統合後の最終DOM再検証、FR-050／FR-051、TC-003、OQ-UI-002、API C1 85%
- merge、deploy、release、force-push

## 実施計画

1. test-only routeで長いlabel／target ID、全target type、多数件、アクセス不可itemを返す。
2. 320pxで先頭／末尾の表示、件数、アクセス不可cue、root／region overflow 0を検証する。
3. 同一journey内のreloadで再取得した確認済み0件も検証し、既存empty証跡を退行させない。
4. SQ-016、UI設計、quality matrix、生成物を既存`E2E-UI-LAYOUT-STRESS-001`へ同期する。
5. 最小十分なlint、typecheck、unit、build、E2E discovery／実走、docs checksを行う。
6. Draft PR #470の受け入れ確認／セルフレビューとIssue #345へ結果・未完了境界を記録する。

## ドキュメントメンテナンス計画

- reflow要件は既存`SQ-016`を正本とし、新しい要件文書を作らない。
- 画面固有の検証境界は既存`DES_UI_UX_001.md`へ追記する。
- authored quality matrixを更新し、`docs/generated/`は正規generatorで同期する。
- 320 CSS px fixtureを実browser zoom／実支援技術／実機のpassへ読み替えない。

## 受け入れ条件

- [ ] `E2E-UI-LAYOUT-STRESS-001`がChromium／Firefox／WebKit required scopeのまま、320×720 CSS pxで24件・8 target typeのお気に入りを表示する。
- [ ] 長いlabel／target IDを持つ先頭itemと、長いlabelを持つ末尾itemが到達可能で、アクセス不可cueが可視である。
- [ ] populated stateのdocument root／favorites regionに水平overflowがなく、browser project／fixture量／dimensionsがJSON evidenceに残る。
- [ ] 同一journeyのreloadで再取得した確認済み0件を表示し、既存empty stateとoverflow 0の証跡を維持する。
- [ ] `favorites → SQ-016 → AC-SQ016-001 / 006 / 007 → E2E-UI-LAYOUT-STRESS-001`が正本、UI設計、quality matrix、生成文書で一致する。
- [ ] production sourceを変更せず、選定したlint、Web／E2E typecheck、unit、build、E2E、docs checksが成功する。
- [ ] Draft PR #470、受け入れ確認、セルフレビュー、Issue #345へfinal head、CI、未完了事項を記録する。

## 検証計画

- `git diff --check`
- E2E対象lint／E2E TypeScript
- Web typecheck／unit／build
- `E2E-UI-LAYOUT-STRESS-001` discovery／3 browser実走
- Web trace／semantic UI／generated inventory freshness
- canonical docs／manual evidence／OpenAPI／API code docs／infra inventory／hidden Unicode／Taskfile alias
- final-head Web UI Quality／MemoRAG CI／semver

## PRレビュー観点

- fixtureがPlaywright routeに閉じ、production fallbackへ混入していないか。
- 0件だけでなく、長い文字列、多数件、permission cueのある実データ境界を検証しているか。
- viewport proxyを実browser zoomへ読み替えていないか。
- #461が所有するproduction pathを変更していないか。
- E2E IDを重複作成せず、既存の正本・trace joinを維持しているか。

## リスク・未完了境界

- 320 CSS pxはbrowser chromeを含む実400% zoomを証明しない。
- route fixtureは実API／認可／favorite mutationの証跡ではない。
- representative screen reader、native AX tree、実browser zoom、touch／実機、#461統合後再検証、owner判断、API既存失敗／C1 85%は未完了を維持する。
