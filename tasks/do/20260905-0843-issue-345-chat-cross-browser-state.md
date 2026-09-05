# Issue #345 チャットの cross-browser state を必須 gate にする

状態: do

タスク種別: 機能追加

## 背景

PR #462 の Firefox／WebKit 必須 gate はチャットの keyboard・semantic・reflow・content extreme を検証する一方、`initial / processing / SSE timeout / retry / recovery / error / permission` の状態境界は Chromium の `E2E-UI-STATE-001` に限られる。主要質問 journey の非同期状態と送信抑止を、承認済みの横断ブラウザ範囲へ追加する。

## 目的

チャットについて、`chat → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-005` を一意に追跡し、Firefox／WebKit の PR 必須 gate で再接続・安全な error・権限不足の状態契約を検証する。

## 対象範囲

- `apps/web/e2e/cross-browser-state.spec.ts` の deterministic route fixture と assertion
- `SQ-016`、`NFR-018`、`DES_UI_UX_001`、UI quality matrix、trace metadata
- 生成 Web inventory と必須 gate の件数表記
- PR #462、Issue #345、作業レポートの証跡

## 対象外

- production component、API、認可、RAG 回答契約の変更
- production incident、実 API／SSE、AWS 上の操作
- 代表 screen reader、native accessibility tree、実ブラウザ 200%／400% zoom、touch／実機
- #461 の統合、merge、deploy、release

## 実行計画

1. 既存 Chromium chat state scenario を、横断ブラウザ用の独立 scenario として移植する。
2. initial、processing、SSE timeout、`Last-Event-ID` retry、recovered answer、HTTP 500 の安全な error、`chat:create` 不足時の送信抑止を検証する。
3. 正本・trace metadata・quality matrix を同じ evidence ID に同期し、生成物を repository command で更新する。
4. 最小十分な lint、typecheck、unit、E2E discovery／実走、docs checks を実行し、失敗は修正または未完了として記録する。
5. commit／push 後に Draft PR #462、受け入れ確認、セルフレビュー、Issue #345 を更新する。

## ドキュメントメンテナンス計画

- 要件本文は `SQ-016`／`NFR-018` の検証欄だけを追加し、要件自体を再定義しない。
- `DES_UI_UX_001` は chat state の横断ブラウザ証跡境界を追加する。
- `tools/web-inventory/ui-traceability.json` と `ui-quality-matrix.json` を正本側の join metadata とし、`docs/generated/` は `npm run docs:web-inventory` だけで更新する。

## 受け入れ条件

- [ ] `E2E-UI-CROSS-BROWSER-STATE-005` が Firefox／WebKit 必須 scope に含まれ、initial → processing → SSE timeout → reconnecting → recovered answer を区別し、再接続 request が `Last-Event-ID` を引き継ぐ。
- [ ] processing／reconnecting 中は chat を busy、送信を disabled とし、回復後だけ busy を解除して入力を再有効化する。
- [ ] chat start の HTTP 500 は対象付き error alert を表示し、private error detail を公開しない。
- [ ] `chat:create` 不足は対象付き permission alert と disabled 送信 control を表示し、Enter 操作を含め start request を発行しない。
- [ ] `chat → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-005` が正本・quality matrix・trace metadata・生成 Web inventory で一意に追跡でき、required cross-browser scope が 50 件として一致する。
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

- test-only fixture が production behavior、認可、RAG 回答契約へ混入していないこと。
- retry が `Last-Event-ID` を保持し、error／permission detail と未許可 request を漏らさないこと。
- evidence ID と screen／REQ／AC／E2E の join が重複または孤立していないこと。
- #461 と production source の責務競合を増やしていないこと。

## リスク・未完了境界

- Playwright route fixture は production incident、実 API／SSE、実認可設定の証跡ではない。
- Firefox／WebKit の Playwright 実走は代表 screen reader、native AX tree、実 browser zoom、touch／実機を代替しない。
- #461 統合後の再検証、FR-051／OQ-UI-002 の owner 判断、API C1 85% は本 slice の対象外で未完了を維持する。
- 累積 task 全体に manual evidence が残るため、本 task は受け入れ条件確認後も `do` を維持する。
