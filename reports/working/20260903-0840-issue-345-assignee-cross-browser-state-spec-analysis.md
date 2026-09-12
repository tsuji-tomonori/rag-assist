# Issue #345 担当者対応 cross-browser state 証跡分析

## 結論

- 今回の最小改善は、担当者対応の `loading / error / retry / confirmed empty / permission` を Firefox／WebKit の PR 必須 E2E に追加することとする。
- 追跡は `assignee → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-003` とする。
- production source は変更せず、Playwright route fixture と正本・生成文書の同期だけを対象にする。

## 確認した事実

- `main@8e542b31` は PR #462 の統合 branch の祖先で、開始時点の統合 branch は main に対して behind 0 である。
- PR #462 の Firefox／WebKit 必須 gate は 8 AppView の semantic contract と history／documents の state contract を持つ。
- 担当者対応は Chromium required `E2E-UI-STATE-001` で loading、500、retry、confirmed empty、403 を検証するが、Firefox／WebKit に同じ状態境界はない。
- Draft PR #461 は担当者対応を含む production UI components を変更するため、今回 production source を変更すると競合と責務重複が増える。

## 受け入れ境界

- loading 中は `aria-busy=true` と対象付き loading を公開し、未確認データを 0 件または空のカンバンと表示しない。
- HTTP 500 は private detail を隠した対象付き error alert と retry を表示する。
- retry 中は busy と対象付き retrying status を公開し、回復確認後だけ confirmed empty／0 件を表示する。
- HTTP 403 は permission alert を表示し、問い合わせ内容・0 件・カンバン・private detail を隠す。
- artifact は browser project、状態系列、request count、test-only fixture 境界を保持する。

## 証跡の限界

- route fixture は production incident、実認可設定、問い合わせ mutation の証跡ではない。
- Firefox／WebKit の Playwright 実走は代表 screen reader、native accessibility tree、実ブラウザ 200%／400% zoom、touch／実機を代替しない。
- #461 統合後の再検証、FR-051／OQ-UI-002 の owner 判断、API C1 85% は未完了のまま扱う。
