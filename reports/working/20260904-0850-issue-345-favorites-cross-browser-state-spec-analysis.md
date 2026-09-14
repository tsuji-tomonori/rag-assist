# Issue #345 お気に入り cross-browser state 証跡分析

## 結論

- 今回の最小改善は、お気に入りの `loading / error / retry / confirmed empty / permission` を Firefox／WebKit の PR 必須 E2E に追加することとする。
- 追跡は `favorites → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-004` とする。
- production source は変更せず、Playwright route fixture と正本・生成文書の同期だけを対象にする。

## 確認した事実

- `main@8e542b31` は PR #462 の統合 branch の祖先で、開始時点の統合 branch は main に対して behind 0／ahead 150 である。
- 前回の final head は `c7a5f828` で、開始時点にその後の integration branch commit はない。
- PR #462 の Firefox／WebKit 必須 gate は 8 AppView の semantic contract と history／documents／assignee の state contract を持つ。
- お気に入りは Chromium required `E2E-UI-STATE-001` で loading、500、retry、confirmed empty、403 を検証するが、Firefox／WebKit に同じ状態境界はない。
- Draft PR #461 は production UI components を変更するため、今回 production source を変更すると競合と責務重複が増える。
- お気に入りの読み取りは単一の `GET /favorites` であり、複数 resource の partial state を持つ admin／benchmark より小さい独立 slice である。

## 受け入れ境界

- loading 中は `aria-busy=true` と対象付き loading を公開し、未確認データを 0 件または empty と表示しない。
- HTTP 500 は private detail を隠した対象付き error alert と retry を表示する。
- retry 中は busy と対象付き retrying status を公開し、回復確認後だけ confirmed empty／0 件を表示する。
- HTTP 403 は permission alert を表示し、お気に入り内容・0 件・private detail を隠す。
- artifact は browser project、状態系列、request count、test-only fixture 境界を保持する。

## 証跡の限界

- route fixture は production incident、実認可設定、favorite mutation の証跡ではない。
- Firefox／WebKit の Playwright 実走は代表 screen reader、native accessibility tree、実ブラウザ 200%／400% zoom、touch／実機を代替しない。
- favorite resume／delete journey、#461 統合後の再検証、FR-051／OQ-UI-002 の owner 判断、API C1 85% は未完了のまま扱う。
