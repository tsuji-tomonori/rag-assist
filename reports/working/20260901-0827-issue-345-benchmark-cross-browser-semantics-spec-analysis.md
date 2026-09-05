# Issue #345 benchmark cross-browser semantics仕様分析

## Input inventory

| source | type | reliability |
|---|---|---|
| Issue #345、Draft PR #462 | issue / PR | confirmed |
| `BenchmarkWorkspace.tsx` | production source | confirmed |
| `screen-reader-semantics.spec.ts`、`cross-browser-semantics.spec.ts` | executable evidence | confirmed |
| `REQ_SERVICE_QUALITY_016.md`、`DES_UI_UX_001.md` | canonical requirements / design | confirmed |
| authored trace / quality matrix、generated Web docs | machine-readable join / derived output | confirmed |
| Draft PR #461 changed files | concurrent ownership | confirmed |

## Report facts

- `confirmed`: benchmarkはChromium AX、required state、responsive auditの自動証跡を持つ。
- `confirmed`: Firefox／WebKit semantic suiteはbenchmarkを含まず、8 AppView中の唯一の未接続画面である。
- `confirmed`: productionは性能テストregion／heading、job panel、suite／dataset／model／concurrency control、run history scroll region／table、実行／更新／戻るbuttonを公開する。job panel自体にform roleはないため、存在しないlandmarkを要求しない。
- `confirmed`: #461は`BenchmarkWorkspace.tsx`のshared Icon／LoadingSpinner importを変更するが、今回対象のE2E sourceは変更しない。
- `open_question`: representative screen reader／OS／browser／device matrixとowner。

## Candidate tasks

1. **selected**: benchmarkの現行semantic contractをFirefox／WebKit required gateへ追加する。
2. deferred: history／favorites／benchmark／adminの画面固有contrast evidence拡張。
3. blocked manual: representative screen reader、実browser zoom、touch／実機。
4. deferred integration: #461統合後のproduction DOM再検証。

## Acceptance criteria

- Firefox／WebKitで性能テストregion、heading、job panelを認識できる。
- suite／dataset／model／concurrency controlがname・role・valueを持つ。
- 実行履歴が名前付きfocusable scroll regionとtableとして公開される。
- 実行／更新／戻るbuttonがnameとroleを持つ。
- fixtureはPlaywright routeに限定される。
- browser projectとautomation境界をartifactへ残す。
- `benchmark → SQ-016 → AC-SQ016-003 → E2E-UI-CROSS-BROWSER-SEMANTICS-008`が正本から生成物まで一致する。
- 実AWS benchmark、manual screen reader／zoom／実機は未完了を維持する。

## E2E and non-UI scenarios

1. 認証後、性能テストへ移動する。
2. region／heading／job panel、suite／dataset／model／concurrency controlのARIA snapshotを取得する。
3. 各controlの現在valueを同じbrowser実走内で検証する。
4. 実行履歴scroll region／table、実行／更新／戻るbuttonを検証する。
5. Firefox／WebKit project名、E2E ID、snapshot／DOM state境界をartifactへ記録する。
6. authored trace／matrixからgenerated Web docsを生成し、freshnessを検査する。

## Operation and expectation groups

| operation | expectation |
|---|---|
| benchmarkへ移動 | named regionとlevel 2 headingが公開される |
| job設定を読む | suite／dataset／model／concurrencyが固有name・role・current valueを持つ |
| historyを読む | 左右scroll可能な名前付きregionとtableが公開される |
| actionを読む | 実行／更新／戻るcontrolがbutton roleと固有nameを持つ |
| evidenceを生成 | project名、E2E ID、automation境界がbrowser別に一意 |

## Traceability / gap analysis

| view | requirement | acceptance | verification | status |
|---|---|---|---|---|
| benchmark | SQ-016 | AC-SQ016-003 | E2E-UI-CROSS-BROWSER-SEMANTICS-008 | implementation in progress |

残るgapはrepresentative screen reader、native Firefox／WebKit AX tree、実browser zoom、touch／実機、実AWS benchmark、#461統合後の再検証である。本sliceのautomated passをmanual／overall passへ昇格しない。
