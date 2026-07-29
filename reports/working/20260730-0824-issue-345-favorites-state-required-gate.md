# Issue #345 / Draft PR #462: favorites 状態証跡の required gate 追加

## 結果

Draft PR #462 の既存 integration branch を最新のまま更新し、`favorites` の共通状態契約を
required `E2E-UI-STATE-001` へ追加した。新規 PR は作らず、既存の UI evidence 収束単位を維持する。

## 開始時点

- base: `main@0771521cbe505d3ffeddcbe34deff89f67de8702`
- Draft PR #462 head: `f2b5d5993ee42f8fbdee924e04782d552855fa20`
- main は前回実行後に更新なし。
- PR #462 は open / draft / mergeable、base への behind 0。
- open PR #467 は通常 PR、#458 / #460〜#465 は別の既存 draft。今回の `favorites` 状態証跡とは重複しない。

## 選定理由

- `favorites` は `useResourceStateController` と `FavoritesWorkspace` の状態境界へ既に結線済みで、production contract の追加設計を要しない。
- existing E2E は confirmed zero と mobile reachability を持つが、HTTP 500 / 403 / retry / false-zero の feature evidence がない。
- `chat` は retry/resubmit contract の設計判断を要し、小さな安全修正の範囲を超える。
- PR #461 の shared primitive 修正とは異なり、本差分は画面 adapter の結線証跡に限定される。

## 変更

- `E2E-UI-STATE-001` に2シナリオを追加。
  - loading → HTTP 500 → retry → recovered / confirmed empty。
  - HTTP 403 → permission denied。
- loading / error / permission 中の false zero / false empty を否定。
- raw error の private identifier 非表示を固定。
- `favorites / AC-SQ016-007` automated のみを `pass` へ更新。
- manual / overall と、証拠のない他5 AppViews は `blocked` を維持。
- `REQ_SERVICE_QUALITY_016`、`DES_UI_UX_001`、machine-readable matrix、生成マトリクスを同期。

## ローカル検証

| 検証 | 結果 |
| --- | --- |
| E2E test listing | pass（追加2件を検出） |
| targeted Chromium E2E | blocked（Chromiumなし） |
| targeted ESLint | pass |
| Web typecheck | pass |
| Web unit | pass（61 files / 443 tests、`TZ=Asia/Tokyo`） |
| Web build | pass |
| UI traceability | pass（13 tests） |
| semantic UI contract | pass（5 tests） |
| generated inventory check | pass |
| canonical docs validation | pass |
| hidden Unicode check | pass |

## ローカル E2E blocker

Playwright server は `tsx` CLI の sandbox IPC 制約を `node --import tsx` で回避できたが、
実行環境に Chromium executable がなかった。`PLAYWRIGHT_BROWSERS_PATH=/tmp/... npx playwright install chromium`
は `cdn.playwright.dev` の証明書と2026-07-30の実行時刻が一致せず取得失敗した。
したがって targeted E2E は未実施であり、final-head GitHub Actions の required Web UI Quality を完了判定に使う。

## 既知の非関連事項

- timezone 未指定の Web unit は既存 date-format assertion 2件が環境 timezone により失敗した。
  JST明示の再実行は443/443成功し、本差分の回帰ではない。
- MemoRAG CI の API C1 85% gate は過去runで80.43%の既存 blocker。final-head の結果を別軸で記録する。

## 未完了

- final-head Web UI Quality / MemoRAG CI / semver。
- 代表 screen reader、実 browser 400% zoom、touch / real device。
- favorite resume journey。
- 他5 AppViews の画面単位状態証跡。

## 次の具体作業

1. commit / push 後に Draft PR #462 の final-head checks を確認する。
2. Web UI Quality が成功した場合のみ、E2E関連受け入れ条件を完了へ更新する。
3. PRへ日本語の受け入れ条件コメントとセルフレビューを残す。
4. Issue #345 に実装、検証、blocker、未完了、次候補を記録する。
