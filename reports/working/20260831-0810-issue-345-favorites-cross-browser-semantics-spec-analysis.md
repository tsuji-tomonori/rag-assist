# Issue #345 お気に入り cross-browser semantics仕様分析

## Input inventory

| source | type | reliability |
|---|---|---|
| Issue #345、Draft PR #462 | issue / PR | confirmed |
| `FavoritesWorkspace.tsx` | production source | confirmed |
| `screen-reader-semantics.spec.ts`、`cross-browser-semantics.spec.ts` | executable evidence | confirmed |
| `REQ_SERVICE_QUALITY_016.md`、`DES_UI_UX_001.md` | canonical requirements / design | confirmed |
| authored trace / quality matrix、generated Web docs | machine-readable join / derived output | confirmed |
| Draft PR #461 changed files | concurrent ownership | confirmed |

## Report facts

- `confirmed`: お気に入りはChromium AX、Chromium／Firefox／WebKit keyboard、state、320px content stressのrequired証跡を持つ。
- `confirmed`: Firefox／WebKit semantic suiteはお気に入りを含まない。
- `confirmed`: productionはregion、level 2／3 headings、会話／文書group、item label、target IDまたは「アクセス不可」、back buttonを表示する。
- `confirmed`: productionにはfavorite resume／delete controlが存在しない。semantic testで架空actionを要求しない。
- `confirmed`: #461は`FavoritesWorkspace.tsx`のIcon importを変更するが、今回対象のE2E sourceは変更しない。
- `open_question`: representative screen reader／OS／browser／device matrixとowner。

## Candidate tasks

1. **selected**: お気に入りの現行semantic contractをFirefox／WebKit required gateへ追加する。
2. deferred: benchmarkのcross-browser semantic gate。
3. deferred: favorite resume／deleteの要件・production実装。別の機能taskとowner判断が必要。
4. blocked manual: representative screen reader、実browser zoom、touch／実機。

## Acceptance criteria

- Firefox／WebKitでお気に入りregion、heading、項目一覧、会話／文書groupを認識できる。
- 会話／文書itemのlabelと、利用可能itemのtarget ID／利用不可itemの明示cueを確認できる。
- back buttonがbutton roleとaccessible nameを持つ。
- fixtureはPlaywright routeに限定される。
- browser projectとautomation境界をartifactへ残す。
- `favorites → SQ-016 → AC-SQ016-003 → E2E-UI-CROSS-BROWSER-SEMANTICS-007`が正本から生成物まで一致する。
- favorite resume／delete、manual screen reader／zoom／実機は未完了を維持する。

## E2E and non-UI scenarios

1. 認証後、お気に入りへ移動する。
2. region／heading／項目一覧／会話／文書groupのARIA snapshotを取得する。
3. 利用可能な会話itemのlabel／target IDを確認する。
4. 利用不可な文書itemのlabel／「アクセス不可」cueを確認する。
5. back buttonのname／roleを確認する。
6. Firefox／WebKit project名、E2E ID、snapshot／DOM state境界をartifactへ記録する。
7. authored trace／matrixからgenerated Web docsを生成し、freshnessを検査する。

## Operation and expectation groups

| operation | expectation |
|---|---|
| favoritesへ移動 | named regionとlevel 2 headingが公開される |
| groupを読む | 項目一覧、会話、文書のlevel 3 headingが順序付きで公開される |
| itemを読む | labelとtarget IDまたはアクセス不可cueが可視・支援技術向けsnapshotへ含まれる |
| chatへ戻るcontrolを読む | button roleと「チャットへ戻る」のnameを持つ |
| evidenceを生成 | project名、E2E ID、automation境界がbrowser別に一意 |

## Traceability / gap analysis

| view | requirement | acceptance | verification | status |
|---|---|---|---|---|
| favorites | SQ-016 | AC-SQ016-003 | E2E-UI-CROSS-BROWSER-SEMANTICS-007 | implementation in progress |

残るgapはfavorite resume／delete journey、representative screen reader、native Firefox／WebKit AX tree、実browser zoom、touch／実機、#461統合後の再検証である。本sliceのautomated passをmanual／overall passへ昇格しない。
