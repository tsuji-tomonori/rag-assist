# Issue #345 お気に入りの cross-browser state を必須 gate にする

状態: do

タスク種別: 機能追加

## 背景

PR #462 の Firefox／WebKit 必須 gate はお気に入りの keyboard・semantic・layout stress を検証する一方、`loading / error / retry / confirmed empty / permission` の状態境界は Chromium の `E2E-UI-STATE-001` に限られる。未確認データを 0 件として扱わない契約を、承認済みの横断ブラウザ範囲へ追加する。

## 目的

お気に入りについて、`favorites → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-004` を一意に追跡し、Firefox／WebKit の PR 必須 gate で状態遷移と非開示境界を検証する。

## 対象範囲

- `apps/web/e2e/cross-browser-state.spec.ts` の deterministic route fixture と assertion
- `SQ-016`、`DES_UI_UX_001`、UI quality matrix、trace metadata
- 生成 Web inventory と必須 gate の件数表記
- PR #462、Issue #345、作業レポートの証跡

## 対象外

- production component、API、認可、お気に入り mutation の変更
- favorite resume／delete journey
- 代表 screen reader、native accessibility tree、実ブラウザ 200%／400% zoom、touch／実機
- #461 の統合、merge、deploy、release

## 実行計画

1. 既存 Chromium state scenario とお気に入りの resource boundary を、横断ブラウザ用の独立 scenario に移植する。
2. loading 中の busy、HTTP 500 の安全な error、retry 中の busy、確認済み empty、HTTP 403 の permission と非開示を検証する。
3. 正本・trace metadata・quality matrix を同じ evidence ID に同期し、生成物を repository command で更新する。
4. 最小十分な lint、typecheck、unit、E2E discovery／実走、docs checks を実行し、失敗は修正または未完了として記録する。
5. commit／push 後に Draft PR #462、受け入れ確認、セルフレビュー、Issue #345 を更新する。

## ドキュメントメンテナンス計画

- 要件本文は `SQ-016` の検証欄だけを追加し、要件自体を再定義しない。
- `DES_UI_UX_001` は common state の横断ブラウザ証跡境界を更新する。
- `tools/web-inventory/ui-traceability.json` と `ui-quality-matrix.json` を正本側の join metadata とし、`docs/generated/` は `npm run docs:web-inventory` だけで更新する。

## 受け入れ条件

- [ ] `E2E-UI-CROSS-BROWSER-STATE-004` が Firefox／WebKit 必須 scope に含まれ、お気に入りの loading → HTTP 500 error → retrying → recovered → confirmed empty を区別する。
- [ ] loading／error／retrying 中に未確認の 0 件表示・empty を公開せず、private error detail を表示しない。
- [ ] お気に入り一覧の HTTP 403 を empty ではなく対象付き permission alert とし、0 件表示・private detail を公開しない。
- [ ] `favorites → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-004` が正本・quality matrix・trace metadata・生成 Web inventory で一意に追跡できる。
- [ ] 選定した lint、typecheck、unit、E2E、docs checks の結果と、未検証の manual evidence／#461 統合後再検証／owner 判断を task・PR・Issue に記録する。

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

- test-only fixture が production behavior、認可、お気に入りデータへ混入していないこと。
- error／permission detail を漏らさず、未確認値を false zero に変換しないこと。
- evidence ID と screen／REQ／AC／E2E の join が重複または孤立していないこと。
- #461 と production source の責務競合を増やしていないこと。

## リスク・未完了境界

- Playwright route fixture は production incident、実 API 認可、favorite mutation の証跡ではない。
- Firefox／WebKit の Playwright 実走は代表 screen reader、native AX tree、実 browser zoom、touch／実機を代替しない。
- #461 統合後の再検証、FR-051／OQ-UI-002 の owner 判断、API C1 85% は本 slice の対象外で未完了を維持する。
- 累積 task 全体に manual evidence が残るため、本 task は受け入れ条件確認後も `do` を維持する。
