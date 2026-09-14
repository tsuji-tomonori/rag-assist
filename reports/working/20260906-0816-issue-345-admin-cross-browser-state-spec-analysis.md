# Issue #345 管理画面 cross-browser state 証跡分析

## 結論

- 今回の最小改善は、管理画面の `loading / partial / retry / recovered / stale / permission` を Firefox／WebKit の PR 必須 E2E に追加することとする。
- 追跡は `admin → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-006` とする。
- production source は変更せず、Playwright route fixture と正本・生成文書の同期だけを対象にする。

## 確認した事実

- `main@8e542b31` は Draft PR #470 head `5790c3d3` の祖先で、PR #470 は PR #462 のUI証跡stackを取り込んだ最新の統合先である。
- 既存の Firefox／WebKit 必須 gate は管理画面の keyboard、ARIA semantics、640／320 CSS px reflowを検証する。
- 管理画面のpartial recoveryとsource/as-of付きstale保持は Chromium required `E2E-UI-STATE-001` に限られる。
- 権限不足deep linkのprotected request抑止もChromium route testに限られる。
- `DES_UI_UX_001` と `ui-traceability.json` のadmin行は `AC-SQ016-007` とcross-browser state evidenceを参照しておらず、quality matrixのadmin行だけが状態品質を記録している。
- PR #470 はadminを含むproduction UIを統合済みであるため、このheadを基準にtest/docs-only sliceとすれば旧PRとの責務重複を増やさない。

## 受け入れ境界

- 初回の監査取得をgateし、管理画面の対象付きloadingと `aria-busy=true` を観測する。
- 監査取得HTTP 500では取得済み・未更新partをpolite statusで区別し、成功したユーザーdataを保持しつつprivate detailを隠す。
- retry中の状態を観測し、成功後だけrecovered statusと監査dataを表示する。
- ユーザー更新失敗時は最後に確認できたユーザー、`authoritative_identity`、固定as-ofをstaleとして保持し、再試行後にrecoveredへ戻る。
- 管理権限不足のdeep linkはpermission alertを表示して `/` へ正規化し、`/admin/*` requestを発行しない。
- artifact はbrowser project、状態系列、request count、test-only fixture境界を保持する。

## 正本レビュー判定

- 要件変更ではなく、既存 `AC-SQ016-007` の検証具体化である。
- screen→requirement→acceptance criterion→E2Eのjoin欠落を補うため、canonical design、machine-readable trace、quality matrixを同時に更新する必要がある。
- 生成文書は手編集せずgeneratorから更新する。
- manual screen reader／実browser zoom／touch／実機が未実施のため、overallはblockedのままであり、Issue #345の完了条件を満たしたとは扱わない。

## 証跡の限界

- route fixture は production incident、実 API／AWS、実認可、実運用dataの証跡ではない。
- Firefox／WebKit の Playwright 実走は代表 screen reader、native accessibility tree、実ブラウザ 200%／400% zoom、touch／実機を代替しない。
- FR-050／FR-051、TC-003 WebSocket transport判断、OQ-UI-002、API C1 85% は未完了のまま扱う。
