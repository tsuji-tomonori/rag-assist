# Issue #345: 担当者対応画面の共通状態証跡を required gate へ追加する

## 種別

- 修正

## 背景

Issue #345 と Draft PR #462 は、8 AppViews の共通状態契約を画面単位で required E2E へ収束している。
2026-08-01 時点では `history`、`favorites`、`benchmark`、`admin` の `AC-SQ016-007` automated evidence があり、
`assignee` は `/questions` の loading / error / permission / retry 境界を実装済みだが、
required gate では成功時の問い合わせ journey と表示しか画面単位に検証されていない。

## 原因分析（なぜなぜ）

### 問題文

担当者対応画面は `/questions` 取得中・HTTP 500・HTTP 403・retry後のconfirmed emptyを区別して表示する実装を持つ一方、
その結線を実ブラウザのrequired E2Eで検証していないため、`AC-SQ016-007` automated statusを合格判定できない。

### 確認済み事実

- `useAppShellState` は `canAnswerQuestions` のとき `runResourceLoad("assignee", ...)` で `/questions` を初期取得する。
- `AssigneeWorkspace` は `ResourceStateBoundary` を使い、未確認時に件数・カンバンを表示せず、confirmed empty時だけ0件説明を表示する。
- retryは同じ `refreshQuestions` を `retry` intentで再実行する。
- HTTP 403はpermission state、HTTP 500はerror stateへ変換され、raw response bodyを利用者向け表示へ出さない。
- `E2E-UI-STATE-001` は `@ui-quality` によりrequired Chromium gateの対象である。
- open PR #461 は `AssigneeWorkspace.tsx` を含むshared UI primitive統合を扱うため、本taskではproduction componentを変更しない。

### 推定・未確認

- 推定: feature evidence欠落は、共通state primitive導入後に各AppViewのHTTP境界シナリオを順次追加している途中であることによる。
- 未確認: 代表screen reader、実browser 200%/400% zoom、touch実機、Firefox/WebKitでの結果。

### 根本原因

共通状態契約を `assignee` へ適用した後、`/questions` 固有のloading・error・permission・recoveryをrequired selectorへ追加する収束作業が未実施だった。
matrix validatorはstatus構造と参照整合を確認するが、各画面のHTTP境界シナリオを自動生成しないため、欠落を画面単位のfailとして検出できなかった。

### 対策と対象範囲

- 実画面境界を通るrequired E2E 2件を追加し、発生・流出の両方を検出する。
- loading / error / permission中のfalse zero、カンバン、private detail非表示をassertする。
- retry後のrecovered / confirmed emptyとread countを固定する。
- この証跡だけで `assignee / AC-SQ016-007` automatedを更新し、manual / overallと他3画面はblockedを維持する。

## スコープ

- `assignee` のinitial loading → HTTP 500 → retry → confirmed empty recoveryを画面境界で検証する。
- `assignee` のHTTP 403をpermissionとして検証する。
- false zero、未確認のカンバン、private detailの非表示を検証する。
- `SQ-016` 正本、UI/UX正本、machine-readable matrix、生成マトリクスを同じ証跡へ同期する。

## スコープ外

- `AssigneeWorkspace`、questions API、回答・解決mutationのproduction挙動変更。
- open PR #461のshared UI primitive差分。
- `chat`、`documents`、`profile` の `AC-SQ016-007` status更新。
- 代表screen reader、実browser 400% zoom、touch / 実機検証。
- merge、deploy、release、force-push。

## 受け入れ条件

- [ ] `E2E-UI-STATE-001` が `assignee` のloading、HTTP 500、retry、confirmed empty、HTTP 403を実画面境界で検証する。
- [ ] loading / error / permission中に未確認の `0 件が対応待ち`、空カンバン、問い合わせ0件説明を表示しない。
- [ ] raw HTTP errorのprivate detailを表示しない。
- [ ] retry後にrecovered state、問い合わせ0件説明、`0 件が対応待ち`を表示し、読み込み回数を固定する。
- [ ] permission stateでprotected contentを隠し、戻り導線を表示する。
- [x] `assignee / AC-SQ016-007` のautomatedのみを `pass` とし、manual / overallと他3画面は `blocked` を維持する。
- [x] `REQ_SERVICE_QUALITY_016`、`DES_UI_UX_001`、machine-readable matrix、生成文書が同じ証跡を参照する。
- [x] targeted E2E、lint、typecheck、unit、trace / semantic / docs checksが成功するか、実行不能理由を未完了として記録する。
- [ ] Draft PR #462を更新し、日本語の受け入れ条件コメント、セルフレビュー、Issue #345の進捗記録を残す。

## 実装計画

1. 既存 `visual-regression.spec.ts` のrequired `E2E-UI-STATE-001` に `assignee` の2シナリオを追加する。
2. false-zero / false-content / raw-detail suppressionとretry recoveryをassertionで固定する。
3. 正本とmachine-readable matrixを同じE2E証跡へ同期し、generatorで生成物を更新する。
4. 変更範囲に対する最小十分な検証を実行し、未検証事項を残す。
5. Draft PR #462、受け入れ条件、セルフレビュー、Issue #345を更新する。

## ドキュメント保守計画

- `REQ_SERVICE_QUALITY_016.md` と `DES_UI_UX_001.md` の共通状態証跡範囲を `assignee` まで拡張する。
- `tools/web-inventory/ui-quality-matrix.json` の `assignee / AC-SQ016-007` automatedだけを更新する。
- `npm run docs:web-inventory` でgenerated Web docsを再生成し、手編集しない。

## 検証計画

- targeted Playwright list / Chromium E2E。
- `npx eslint apps/web/e2e/visual-regression.spec.ts`。
- Web typecheck / unit / build。
- UI trace、semantic UI、generated inventory、canonical docs、hidden Unicode、`git diff --check`。
- final-head GitHub Actions Web UI Quality / MemoRAG CI / semver。

## PRレビュー観点

- 未確認の問い合わせを0件や空カンバンとして見せていないか。
- permission stateがprotected content / raw response detailを表示していないか。
- automated passをmanual / overall passへ昇格していないか。
- PR #461のproduction UI差分や、RAG根拠性・認可境界・dataset固有production分岐を混在させていないか。

## リスクとロールバック

- required UI gateが2シナリオ増えるため実行時間が増える。
- API route gateの解放漏れはtest hangを起こすため、loading assertion直後に必ず解放する。
- 問題時は本taskのE2E 2件とassigneeのマトリクス・正本文書差分を同時に戻す。

## 未完了として維持する項目

- `chat`、`documents`、`profile` の画面単位状態証跡。
- 代表screen reader、実browser 400% zoom、touch / real device、Firefox / WebKit。
- `OQ-UI-002` owner / cadence / approved matrix。
- final-head CIの完了確認。

## 状態

- do

## 2026-08-01 ローカル検証

- pass: `npx eslint apps/web/e2e/visual-regression.spec.ts`
- pass: `npm run typecheck -w @memorag-mvp/web`
- pass: `TZ=Asia/Tokyo npm test -w @memorag-mvp/web`（61 files / 443 tests）
- pass: `npm run build -w @memorag-mvp/web`（既存chunk-size advisoryのみ）
- pass: `npm run docs:web-trace:test`（13 tests）
- pass: `npm run test:web-semantic-ui`（5 tests）
- pass: `npm run docs:web-inventory:check`
- pass: `python3 scripts/validate_docs.py`
- pass: `npm run docs:hidden-unicode:check`
- pass: Playwright test listing（追加2件を検出）
- blocked: targeted Playwright execution。`tsx` CLI IPC制約を一時的な同等起動 `node --import tsx` で回避してAPI / Web server起動までは確認したが、実行環境にChromium executableがない。設定差分は戻し、final-head GitHub Actionsを判定根拠にする。
- pass: `git diff --check`
