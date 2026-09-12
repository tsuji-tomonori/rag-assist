# Issue #345 担当者対応の cross-browser state を必須 gate にする

状態: do

タスク種別: 機能追加

## 背景

PR #462 の Firefox／WebKit 必須 gate は担当者対応の keyboard・semantic・reflow を検証する一方、`loading / error / retry / confirmed empty / permission` の状態境界は Chromium の `E2E-UI-STATE-001` に限られる。未確認データを 0 件または空のカンバンとして扱わない契約を、承認済みの横断ブラウザ範囲へ追加する。

## 目的

担当者対応について、`assignee → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-003` を一意に追跡し、Firefox／WebKit の PR 必須 gate で状態遷移と非開示境界を検証する。

## 対象範囲

- `apps/web/e2e/cross-browser-state.spec.ts` の deterministic route fixture と assertion
- `SQ-016`、`DES_UI_UX_001`、UI quality matrix、trace metadata
- 生成 Web inventory と必須 gate の件数表記
- PR #462、Issue #345、作業レポートの証跡

## 対象外

- production component、API、認可、問い合わせ mutation の変更
- 代表 screen reader、native accessibility tree、実ブラウザ 200%／400% zoom、touch／実機
- #461 の統合、merge、deploy、release

## 実行計画

1. 既存 Chromium state scenario と担当者対応の resource boundary を、横断ブラウザ用の独立 scenario に移植する。
2. loading 中の busy、HTTP 500 の安全な error、retry 中の busy、確認済み empty、HTTP 403 の permission と非開示を検証する。
3. 正本・trace metadata・quality matrix を同じ evidence ID に同期し、生成物を repository command で更新する。
4. 最小十分な lint、typecheck、unit、E2E discovery／実走、docs checks を実行し、失敗は修正または未完了として記録する。
5. commit／push 後に Draft PR #462、受け入れ確認、セルフレビュー、Issue #345 を更新する。

## ドキュメントメンテナンス計画

- 要件本文は `SQ-016` の検証欄だけを追加し、要件自体を再定義しない。
- `DES_UI_UX_001` は common state の横断ブラウザ証跡境界を更新する。
- `tools/web-inventory/ui-traceability.json` と `ui-quality-matrix.json` を正本側の join metadata とし、`docs/generated/` は `npm run docs:web-inventory` だけで更新する。

## 受け入れ条件

- [x] `E2E-UI-CROSS-BROWSER-STATE-003` が Firefox／WebKit 必須 scope に含まれ、担当者対応の loading → HTTP 500 error → retrying → recovered → confirmed empty を区別する。
- [x] loading／error／retrying 中に未確認の 0 件表示・カンバンを公開せず、private error detail を表示しない。
- [x] 問い合わせ一覧の HTTP 403 を empty ではなく対象付き permission alert とし、0 件表示・カンバン・private detail を公開しない。
- [x] `assignee → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-003` が正本・quality matrix・trace metadata・生成 Web inventory で一意に追跡できる。
- [x] 選定した lint、typecheck、unit、E2E、docs checks の結果と、未検証の manual evidence／#461 統合後再検証／owner 判断を task・PR・Issue に記録する。

## 実施結果

- 実装 head `5643dc92` で [Web UI Quality](https://github.com/tsuji-tomonori/rag-assist/actions/runs/33697157755) が成功し、Firefox／WebKit required 40/40 を確認した。
- [MemoRAG CI](https://github.com/tsuji-tomonori/rag-assist/actions/runs/33697157927) と [semver 検査](https://github.com/tsuji-tomonori/rag-assist/actions/runs/33697157776) も成功した。
- [PR 受け入れ確認](https://github.com/tsuji-tomonori/rag-assist/pull/462#issuecomment-5518220508)、[セルフレビュー](https://github.com/tsuji-tomonori/rag-assist/pull/462#pullrequestreview-5096448461)、[Issue #345 進捗](https://github.com/tsuji-tomonori/rag-assist/issues/345#issuecomment-5518220696)へ、検証済み範囲と未完了事項を記録した。
- 代表 screen reader、native AX tree、実ブラウザ 200%／400% zoom、touch／実機、#461 統合後の再検証、owner 判断、E2E tsconfig baseline、API C1 85% は未完了である。累積作業が残るため状態は `do` を維持する。

## 検証計画

- `git diff --check`
- `npm run lint -- apps/web/e2e/cross-browser-state.spec.ts`
- `npm run typecheck -w @memorag-mvp/web`
- `TZ=UTC npm test -w @memorag-mvp/web`
- `npm run build -w @memorag-mvp/web`
- Playwright の対象 test discovery と Firefox／WebKit 必須 scope 実走
- Web trace、quality matrix、inventory freshness、canonical docs、hidden Unicode checks
- 既知の E2E tsconfig baseline は再確認し、今回差分起因かを分離する。

## PR レビュー観点

- test-only fixture が production behavior、認可、問い合わせデータへ混入していないこと。
- error／permission detail を漏らさず、未確認値を false zero に変換しないこと。
- evidence ID と screen／REQ／AC／E2E の join が重複または孤立していないこと。
- #461 と production source の責務競合を増やしていないこと。

## リスク・未完了境界

- Playwright route fixture は production incident、実API認可、代表 screen reader、native AX tree、実 browser zoom、touch／実機の証跡ではない。
- PR #461 統合後の再検証、FR-051／OQ-UI-002 の owner 判断、API C1 85% は本 slice の対象外で未完了を維持する。
- 累積 task 全体に manual evidence が残るため、本 task は受け入れ条件確認後も `do` を維持する。
