# Issue #345 文書画面 cross-browser state 証跡分析

## 結論

- 今回の最小改善は、文書画面の `loading / partial error / retry / confirmed empty / permission` を Firefox／WebKit の PR required E2E に追加することとする。
- 追跡は `documents → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-002` とする。
- production component、API、認可、文書 mutation は変更せず、Playwright route fixture と正本・生成文書の同期だけを対象にする。

## 確認した事実

- `main@8e542b31` は前回確認時から変更がなく、PR #462 の統合 branch は開始時点で main に対して behind 0 だった。
- 既存の Firefox／WebKit required gate は 8 AppView の semantic contract を持つ一方、resource state contract は履歴画面の `E2E-UI-CROSS-BROWSER-STATE-001` だけだった。
- 文書画面は Chromium required `E2E-UI-STATE-001` で catalog／reindex の loading、partial、retry、empty、403 を持つが、Firefox／WebKit で同じ状態境界を検証していなかった。
- 並行 Draft PR #461 は Documents の production component を変更しているため、今回 production source を変更すると競合と責務重複が増える。

## 受け入れ境界

- loading 中は `aria-busy=true` と対象付き loading を公開し、未確認 data を 0 件または empty state と表示しない。
- 文書取得 HTTP 500 は取得済み部分と未更新部分を区別し、private detail を隠した partial alert と retry を表示する。
- retry 中は未確認 catalog を隠し、回復確認後だけ confirmed empty／0 件を表示する。
- catalog／folder／reindex の全 resource HTTP 403 は permission alert と安全な戻る操作を表示し、文書内容・empty／zero・private detail を隠す。
- artifact は browser project、状態系列、resource read count、test-only fixture 境界を保持する。

## 証跡の限界

- route fixture は production incident、実 AWS resource、認可設定、文書 mutation の証跡ではない。
- Playwright の Firefox／WebKit 実走は representative screen reader、native accessibility tree、実ブラウザ 200%／400% zoom、touch／実機を代替しない。
- 上記 manual evidence、FR-051／OQ-UI-002 の owner 判断、API C1 85%、#461 統合後の再検証は未完了のまま扱う。
