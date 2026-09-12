# Issue #345 お気に入り実データ layout stress分析

## 結論

既存`E2E-UI-LAYOUT-STRESS-001`は320×720 CSS pxを3 browserのPR必須gateで実走するが、お気に入りは確認済み0件だけである。test-only fixtureを実データ極端値へ拡張した結果、favorites regionの決定的な水平overflowを検出した。favorites限定CSSと同じrequired E2Eで修正・再発防止し、同一journeyで0件への再取得も維持するのが、既存作業と重複しない最小の高優先sliceである。

## 入力inventory

- current main: `8e542b31`
- Draft PR #470 head: `da9507cf`、behind 0
- 正本: `REQ_SERVICE_QUALITY_016.md`、`DES_UI_UX_001.md`
- 機能要件: `FR-028`。履歴一覧での追加／解除とお気に入り抽出を要求し、専用画面のresume／delete actionは受け入れ条件に含めない。
- 実装: `FavoritesWorkspace.tsx`は取得データのlabel／target ID／アクセス可否を表示し、戻るactionだけを持つ。
- 自動証跡: layout stress、keyboard、semantic、stateの各required E2E。
- 並行差分: #461が`FavoritesWorkspace.tsx`を変更するためproduction sourceは競合対象。

## 根拠分類

- `confirmed`: 既存layout stressはfavoritesを0件で返し、`0 件のショートカット`とempty説明、region overflow 0だけを検証する。
- `confirmed`: `SQ-016`とquality matrixもfavoritesについて「確認済み0件」の証跡だけを記載する。
- `confirmed`: 長いlabel／target ID、多数件、アクセス不可cueを含むpopulated stateの320px到達性はrequired E2Eにない。
- `confirmed`: implementation head `e9963d1d`のChromium required E2Eは、初回／retryともfavorites region `clientWidth=320`／`scrollWidth=1404`で失敗した。
- `confirmed`: favorites itemのgrid直下`span`は`min-width: 0`を持たず、`small`は折り返し規則を持たない。共通`strong`はnowrap／ellipsisである。
- `confirmed`: `E2E-UI-LAYOUT-STRESS-001`はChromium／Firefox／WebKit required scopeに既に含まれるため、新しいE2E IDやworkflow件数変更は不要である。
- `confirmed`: #341〜#344はopen PRに存在せず、#461はproduction UIを変更する。今回のE2E／正本metadataは#461のchanged filenamesと重複しない。
- `open_question`: 実browser zoom、代表screen reader、native AX tree、touch／実機のowner／環境／実施cadenceはOQ-UI-002を含め未決である。

## 選択肢

1. 採用: 既存layout stressへ24件・8 target type・長い文字列・アクセス不可cueを追加し、favorites限定CSSで真因を修正して、その後の確認済み0件も同一journeyで検証する。
2. 非採用: `FavoritesWorkspace`へresume／delete actionを実装する。FR-028の専用画面受け入れ条件を拡張し、#461のproduction ownershipと競合する。
3. 非採用: 新しいlayout E2E IDを作る。既存IDが同じ画面・viewport・ACを所有しており、正本の一意性を損なう。
4. 非採用: profileのnetwork stateを追加する。FR-051の永続化／状態分類がowner判断待ちで、安全に期待値を確定できない。

## 受け入れ条件

### AC-20260909-001: populated favoritesを320pxで末尾まで到達できる

- Type: boundary / non_functional
- Confidence: confirmed
- Given 24件・8 target type、長いlabel／target ID、アクセス不可itemをtest-only API fixtureが返す
- When 320×720 CSS pxでお気に入り画面を開く
- Then先頭／末尾item、24件count、アクセス不可cueが表示される
- Thendocument rootとfavorites regionの水平overflowがない

### AC-20260909-002: confirmed empty証跡を維持する

- Type: empty_state / non_functional
- Confidence: confirmed
- Given populated stateを確認後、favorites API再取得が空配列を返す
- Whenお気に入りURLをreloadする
- Then確認済み0件countとempty説明が表示される
- Thendocument rootとfavorites regionの水平overflowがない

### AC-20260909-003: 証跡境界と追跡を維持する

- Type: traceability
- Confidence: confirmed
- Given required E2Eが成功する
- When正本／設計／quality metadata／生成文書を確認する
- Then `favorites → SQ-016 → AC-SQ016-001 / 006 / 007 → E2E-UI-LAYOUT-STRESS-001`が一意に追跡できる
- ThenJSON evidenceがbrowser project、viewport、fixture量、dimensions、manual非代替境界を含む

## E2Eと非UIシナリオ

### E2E-UI-LAYOUT-STRESS-001: 320pxのお気に入りpopulated／emptyをreflowする

- Acceptance Criteria: `AC-20260909-001`, `AC-20260909-002`, `AC-20260909-003`
- Target screen: お気に入り
- Actor: ローカル認証ユーザー
- Priority: high
- Confidence: confirmed

#### 前提条件

- test-only route fixtureを使用する。
- viewportを320×720 CSS px、reduced motionへ設定する。

#### 画面操作

1. サインインし、モバイルメニューからお気に入りを開く。
2. 24件・8 target type、長い先頭／末尾文字列、アクセス不可cueを確認する。
3. 末尾itemまでスクロールして到達する。
4. お気に入りURLをreloadし、APIから再取得する。

#### 期待値

- populated stateの先頭／末尾item、count、アクセス不可cueが可視である。
- populated stateとconfirmed empty stateのdocument root／regionに水平overflowがない。
- 再取得後は0件countとempty説明が表示される。
- browser別JSON artifactにfixture量と両stateのdimensionsが残る。

#### 非UI検証

- E2E TypeScript、lint、trace／quality metadata、生成物freshnessを検証する。
- production component／API／認可に差分がないことをgit diffで確認する。
- CSS viewport fixtureを実browser zoom／支援技術／実機のpassと扱わない。

## 双方向トレース

| Screen | Requirement | AC | E2E | 実装証跡 | 状態 |
| --- | --- | --- | --- | --- | --- |
| favorites | SQ-016 | AC-SQ016-001 / 006 / 007 | E2E-UI-LAYOUT-STRESS-001 | `layout-stress.spec.ts` | 今回拡張 |
| favorites | FR-028 | AC-FR028-004 | keyboard／semantic既存E2E | 履歴のfavorites-only／お気に入り表示 | 既存、変更なし |
| manual | SQ-016 | AC-SQ016-008 | manual task | 実browser／screen reader／実機 | blocked維持 |

## gapと完了不可の範囲

- `missing_boundary_case`（今回対応）: favorites populated stateの320px長文／多数件境界。
- `open_question`（未完了）: 実browser zoom、代表screen reader、native AX tree、touch／実機のowner／環境／cadence。
- `conflict`回避: #461が変更する`FavoritesWorkspace.tsx`を編集せず、既存changed filenamesにない`history.css`へfavorites限定規則を置く。
- favorite resume／deleteは現行FR-028の専用画面ACではなく、要件owner承認なしに完了扱いしない。
- API fixture／build不整合、C1 85%、FR-050／FR-051、TC-003、#461統合後再検証は本sliceで解消しない。
