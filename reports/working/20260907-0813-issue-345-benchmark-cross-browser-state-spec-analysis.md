# Issue #345 性能テスト cross-browser state 証跡分析

## 結論

- 今回の最小改善は、性能テスト画面の `loading / partial / retry / recovered / confirmed empty / permission` をFirefox／WebKitのPR必須E2Eへ追加することとする。
- 追跡は `benchmark → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-007` とする。
- production sourceは変更せず、Playwright route fixtureと正本・生成文書の同期だけを対象にする。

## 確認した事実

- `main@8e542b31` はDraft PR #470 head `4663f24f` の祖先で、PR #470はUI証跡stackの最新統合先である。
- PR #341〜#344はmerge済みで、current open PRには同じbenchmark state gateを扱う変更がない。
- Chromium required `E2E-UI-STATE-001` はbenchmarkのloading、run取得500によるpartial、retry、confirmed empty、全resource 403を検証する。
- Firefox／WebKit required gateはbenchmarkのARIA semanticsを検証するが、resource state証跡は管理画面の`STATE-006`までである。
- authored traceのbenchmark行は`AC-SQ016-007`とcross-browser state evidenceを参照せず、screen→requirement→AC→E2Eのjoinが未完了である。
- Draft PR #461は`BenchmarkWorkspace.tsx`を変更するため、test/docs-only sliceならproduction ownershipの競合を増やさない。

## 受け入れ境界

- 初回のrun取得をgateし、性能テストresourceの対象付きloadingと`aria-busy=true`を観測する。
- run取得HTTP 500では取得済みテスト定義と未更新実行履歴を区別し、suite dataを保持しつつprivate detailを隠す。
- partial／retrying中は未確認の実行履歴件数、empty state、history regionを表示しない。
- retry成功後だけrecovered status、明示的empty state、0件の実行履歴を表示し、run／suite read countを2回に固定する。
- 両resourceのHTTP 403ではpermission alertを表示し、test definition、history region、empty／zero、private detailを公開しない。
- artifactはbrowser project、状態系列、read count、test-only fixture境界を保持する。

## 正本レビュー判定

- 要件追加ではなく、既存`AC-SQ016-007`の検証具体化である。
- screen→requirement→acceptance criterion→E2Eのjoin欠落を補うため、canonical requirement／design、machine-readable trace、quality matrixを同時に更新する必要がある。
- 生成文書は手編集せずgeneratorから更新する。
- manual screen reader／実browser zoom／touch／実機が未実施のため、manual／overallはblockedのままであり、Issue #345の完了条件を満たしたとは扱わない。

## 証跡の限界

- route fixtureはproduction incident、実API／AWS、実認可、実dataset behaviorの証跡ではない。
- Firefox／WebKitのPlaywright実走はrepresentative screen reader、native accessibility tree、実ブラウザ200%／400% zoom、touch／実機を代替しない。
- FR-050／FR-051、TC-003 WebSocket transport判断、OQ-UI-002、API C1 85%は未完了のまま扱う。
