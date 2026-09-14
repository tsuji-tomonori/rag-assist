# Issue #345 お気に入り実データの320px layout stressを必須gateにする

- 状態: do
- タスク種別: 修正
- 対象Issue: #345
- 対象PR: #470
- 作成日時: 2026-09-09 08:08 JST

## 背景

Draft PR #470 head `da9507cf` は current `main@8e542b31` を祖先に含み、behind 0である。`E2E-UI-LAYOUT-STRESS-001` はChromium／Firefox／WebKitの必須gateで320×720 CSS pxを検証するが、お気に入り画面は確認済み0件だけを対象にしている。長いlabel／target ID、多数件、アクセス不可cueを含む実データ表示時のregion overflowと末尾到達は未検証である。

並行Draft PR #461は`FavoritesWorkspace.tsx`を変更するため、今回sliceは同componentを避け、既存E2Eのtest-only fixture、favorites限定CSS、一意な正本／quality metadataだけを更新する。

## なぜなぜ分析

### 問題文

2026-09-09、PR #470 head `e9963d1d` のChromium required E2Eで、320×720 CSS pxのお気に入り24件表示時にfavorites regionが`clientWidth=320`／`scrollWidth=1404`となり、期待する水平overflow 0から1084px外れた。初回とretryで同じ値を再現した。

### 確認済み事実

- document rootは320px内に収まる一方、favorites region自体が1404pxへoverflowする。
- fixture先頭のtarget IDは空白を含まない長い文字列である。
- favorites itemは`.history-item` grid直下に単一`span`を置き、同`span`に`min-width: 0`がない。
- target IDを表示する`small`に折り返し規則がなく、共通`.question-list-item strong`は`white-space: nowrap`／ellipsisである。
- history itemの主要buttonには`min-width: 0`があるため、同じ`.history-item` classでもDOM境界が異なる。
- 既存required layout stressはfavoritesの確認済み0件だけを検査し、populated長文境界を検出しなかった。

### 因果と真因

1. 長いtarget IDが折り返されない。
2. その親grid itemの自動最小幅がmax-content幅を保持する。
3. favorites itemにだけ、contentを縮小・折り返す局所規則がない。
4. 0件fixtureだけのrequired証跡では、実データ表示時のこの条件を通過しなかった。

真因は、履歴用grid styleをfavoritesの異なるDOM構造へ再利用した際に、favorites itemの`span`／`strong`／`small`へ`min-width: 0`と長文折り返し契約を定義せず、populated content extremeをrequired testへ含めていなかったことである。

### 影響範囲と全量対応

- 影響: お気に入り画面の長いlabel／target ID。水平スクロールとellipsisによる情報欠落が起こり得る。
- 非影響: history itemのbutton構造、API／認可／favorite mutation、他画面。
- 対応: favorites regionへ限定してgridを1列化し、直下`span`を縮小可能にし、`strong`／`small`を任意位置で折り返す。
- 検出: 24件／8種別／長文／アクセス不可／末尾到達／empty再取得を3 browser required E2Eで継続検証する。
- 効果指標: 3 browserでpopulated／emptyのroot・region `scrollWidth <= clientWidth`、retryなし成功。
- open question: 実browser 400% zoomと支援技術／実機は別のmanual evidenceとして未完了。

## 目的

お気に入りの実データ極端値を320pxで表示し、長い文字列、多数件、アクセス不可cue、先頭／末尾への到達、document root／regionの水平containmentを3 browserの既存required gateで検証する。確認済み0件の既存証跡も維持する。

## 対象範囲

- `apps/web/e2e/layout-stress.spec.ts`のtest-only favorites fixtureとassertion
- `apps/web/src/styles/features/history.css`のfavorites限定reflow規則
- `SQ-016`、`DES_UI_UX_001`、UI quality matrix
- repository generatorが更新する`docs/generated/`
- task、spec analysis、working report、PR／Issue証跡

## 対象外

- production component／API／authorization／RAG contract
- favorite resume／delete機能
- browser UIを操作する実200%／400% zoom、text-only zoom、OS scaling
- representative screen reader、native AX tree、touch／実機
- #461統合後の最終DOM再検証、FR-050／FR-051、TC-003、OQ-UI-002、API C1 85%
- merge、deploy、release、force-push

## 実施計画

1. test-only routeで長いlabel／target ID、全target type、多数件、アクセス不可itemを返す。
2. required CIの寸法証跡から真因と影響範囲を確定する。
3. favorites限定CSSでitemを縮小可能・長文折り返し可能にする。
4. 320pxで先頭／末尾の表示、件数、アクセス不可cue、root／region overflow 0を検証する。
5. 同一journey内のreloadで再取得した確認済み0件も検証し、既存empty証跡を退行させない。
6. SQ-016、UI設計、quality matrix、生成物を既存`E2E-UI-LAYOUT-STRESS-001`へ同期する。
7. 最小十分なlint、typecheck、unit、build、E2E discovery／実走、docs checksを行う。
8. Draft PR #470の受け入れ確認／セルフレビューとIssue #345へ結果・未完了境界を記録する。

## ドキュメントメンテナンス計画

- reflow要件は既存`SQ-016`を正本とし、新しい要件文書を作らない。
- 画面固有の検証境界は既存`DES_UI_UX_001.md`へ追記する。
- authored quality matrixを更新し、`docs/generated/`は正規generatorで同期する。
- 320 CSS px fixtureを実browser zoom／実支援技術／実機のpassへ読み替えない。

## 受け入れ条件

- [x] `E2E-UI-LAYOUT-STRESS-001`がChromium／Firefox／WebKit required scopeのまま、320×720 CSS pxで24件・8 target typeのお気に入りを表示する。
- [x] 長いlabel／target IDを持つ先頭itemと、長いlabelを持つ末尾itemが到達可能で、アクセス不可cueが可視である。
- [x] populated stateのdocument root／favorites regionに水平overflowがなく、browser project／fixture量／dimensionsがJSON evidenceに残る。
- [x] 同一journeyのreloadで再取得した確認済み0件を表示し、既存empty stateとoverflow 0の証跡を維持する。
- [x] `favorites → SQ-016 → AC-SQ016-001 / 006 / 007 → E2E-UI-LAYOUT-STRESS-001`が正本、UI設計、quality matrix、生成文書で一致する。
- [x] production差分をfavorites限定CSSに閉じ、component／API／認可を変更せず、選定したlint、Web／E2E typecheck、unit、build、E2E、docs checksが成功する。Web C0 90.02%／C1 85.12%。
- [ ] Draft PR #470、受け入れ確認、セルフレビュー、Issue #345へfinal head、CI、未完了事項を記録する（repo証跡確定後に実施）。

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
- #461が所有するcomponent pathを変更せず、CSS selectorがfavorites regionに限定されているか。
- E2E IDを重複作成せず、既存の正本・trace joinを維持しているか。

## リスク・未完了境界

- 320 CSS pxはbrowser chromeを含む実400% zoomを証明しない。
- route fixtureは実API／認可／favorite mutationの証跡ではない。
- representative screen reader、native AX tree、実browser zoom、touch／実機、#461統合後再検証、owner判断、API既存失敗／C1 85%は未完了を維持する。

## 実装head検証結果

- 実装head: `60c17342`
- Web UI Quality: https://github.com/tsuji-tomonori/rag-assist/actions/runs/34291078353 （success。Chromium 41件、Firefox／WebKit 60件）
- Validate Semver Label: https://github.com/tsuji-tomonori/rag-assist/actions/runs/34291078357 （success）
- MemoRAG CI: https://github.com/tsuji-tomonori/rag-assist/actions/runs/34291078368 （failure）
  - 本slice対象のWeb lint／typecheck／unit／coverage／build、正本・trace・semantic UI・生成物検査はsuccess。
  - Web coverageはC0 90.02%／C1 85.12%で閾値を満たす。
  - 失敗は既存API test fixtureの型不整合によるAPI buildと、API C1 80.75%（目標85%）であり、本sliceのCSS／E2E／文書差分外。
