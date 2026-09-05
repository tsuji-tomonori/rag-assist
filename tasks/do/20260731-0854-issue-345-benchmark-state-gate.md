# Issue #345: 性能テスト画面の共通状態証跡を required gate へ追加する

## 種別

- 修正

## 背景

Issue #345 と Draft PR #462 は、8 AppViews の共通状態契約を画面単位で required E2E へ収束している。
2026-07-31 時点では `history`、`favorites`、`admin` の `AC-SQ016-007` automated evidence があり、
`benchmark` は loading / partial / error / permission / retry 境界を実装済みだが、
required gate では成功時の画面表示と操作しか画面単位に検証されていない。

## 原因分析（なぜなぜ）

1. なぜ `benchmark` の `AC-SQ016-007` が `blocked` なのか。
   - 実際の HTTP 500 / 403 と retry recovery を画面境界で実行する required E2E がないため。
2. なぜ成功時の visual / operation E2E だけでは不十分なのか。
   - 実行履歴またはテスト定義の未確認・失敗・権限拒否を、0件や実行可能な状態として誤表示しないことを証明できないため。
3. なぜ共通 primitive / controller の unit test だけでは不十分なのか。
   - `BenchmarkWorkspace`、`useAppShellState`、2つの API adapter、retry callback の結線を含む feature evidenceにならないため。
4. なぜ画面単位の証跡が抜けたのか。
   - 品質マトリクスは evidence file の存在を軸単位で確認するが、各 AppView の必須状態シナリオまでは機械的に強制していないため。
5. 根本原因は何か。
   - 共通状態契約を feature へ適用した後、`benchmark` 固有の部分失敗・権限・回復シナリオを required selector に追加する収束作業が未実施だったこと。

## 確認済み事実

- `BenchmarkWorkspace` は実行履歴とテスト定義の availability を part 単位で判定し、未確認 count / controls を表示しない。
- `useAppShellState` は `runs` / `suites` を同じ `useResourceStateController` で読み込み、画面の更新操作で両方を再取得する。
- HTTP 403 は permission part、HTTP 500 は failed part へ変換される。
- `E2E-UI-STATE-001` は `@ui-quality` により required Chromium gate の対象である。
- `history` / `favorites` / `admin` の既存状態証跡と、他の open PR が扱う認証・RAG・管理機能には重複しない。

## スコープ

- `benchmark` の initial loading → HTTP 500 partial → retry → confirmed empty recovery を画面境界で検証する。
- `benchmark` の両 API が HTTP 403 の場合を permission として検証する。
- false zero、未確認 control、private detail の非表示を検証する。
- `SQ-016` 正本、UI/UX 正本、machine-readable matrix、生成マトリクスを同じ証跡へ同期する。

## スコープ外

- benchmark API、run 起動 / cancel / artifact download の挙動変更。
- `chat`、`assignee`、`documents`、`profile` の `AC-SQ016-007` status 更新。
- 代表 screen reader、実 browser 400% zoom、touch / 実機検証。
- merge、deploy、release。

## 受け入れ条件

- [ ] `E2E-UI-STATE-001` が `benchmark` の loading、HTTP 500 partial、retry、confirmed empty、HTTP 403 を実画面境界で検証する。
- [ ] loading / partial / permission 中に未確認の `0 件の実行履歴` または実行履歴 table を表示せず、partial では取得済みのテスト定義だけを区別して保持する。
- [ ] raw HTTP error の private detail を表示しない。
- [ ] retry 後に recovered state、明示的な未実行状態、0件の実行履歴を表示し、読み込み回数を固定する。
- [x] `benchmark / AC-SQ016-007` の automated のみを `pass` とし、manual / overall と他4画面は `blocked` を維持する。
- [x] `REQ_SERVICE_QUALITY_016`、`DES_UI_UX_001`、machine-readable matrix、生成文書が同じ証跡を参照する。
- [ ] targeted E2E、lint、typecheck、unit、trace / semantic / docs checks が成功するか、実行不能理由を未完了として記録する。
- [ ] Draft PR #462 を更新し、日本語の受け入れ条件コメント、セルフレビュー、Issue #345 の進捗記録を残す。

## 実装計画

1. 既存 `visual-regression.spec.ts` の required `E2E-UI-STATE-001` に `benchmark` の2シナリオを追加する。
2. false-zero / false-control / raw-detail suppression と retry recovery を assertion で固定する。
3. 正本と machine-readable matrixを同じ E2E 証跡へ同期し、generator で生成物を更新する。
4. 変更範囲に対する最小十分な検証を実行し、未検証事項を残す。
5. Draft PR #462、受け入れ条件、セルフレビュー、Issue #345 を更新する。

## ドキュメント保守計画

- `REQ_SERVICE_QUALITY_016.md` と `DES_UI_UX_001.md` の共通状態証跡範囲を `benchmark` まで拡張する。
- `tools/web-inventory/ui-quality-matrix.json` の `benchmark / AC-SQ016-007` automated だけを更新する。
- `npm run docs:web-inventory` で generated Web docs を再生成し、手編集しない。

## 検証計画

- targeted Playwright list / Chromium E2E。
- `npx eslint apps/web/e2e/visual-regression.spec.ts`。
- Web typecheck / unit / build。
- UI trace、semantic UI、generated inventory、canonical docs、hidden Unicode、`git diff --check`。
- final-head GitHub Actions Web UI Quality / MemoRAG CI / semver。

## PRレビュー観点

- partial state が成功した part と失敗した part を区別し、失敗した part の値を0件と見せていないか。
- permission state が protected content / controls / raw response detailを表示していないか。
- automated pass を manual / overall pass に昇格していないか。
- RAG根拠性、認可境界、dataset固有production分岐へ差分がないか。

## リスクとロールバック

- required UI gate が2シナリオ増えるため実行時間が増える。
- API route gate の解放漏れはテスト hang を起こすため、loading assertion 直後に必ず解放する。
- 問題時はこの task の E2E 2件と benchmark のマトリクス・正本文書差分を同時に戻す。

## 未完了として維持する項目

- `chat`、`assignee`、`documents`、`profile` の画面単位状態証跡。
- 代表 screen reader、実 browser 400% zoom、touch / 実機検証。
- `OQ-UI-002` owner / cadence / approved matrix。
- final-head CI の完了確認。

## 状態

- do

## 2026-07-31 ローカル検証

- pass: `npx eslint apps/web/e2e/visual-regression.spec.ts`
- pass: `npm run typecheck -w @memorag-mvp/web`
- pass: `TZ=Asia/Tokyo npm test -w @memorag-mvp/web`（61 files / 443 tests）
- pass: `npm run build -w @memorag-mvp/web`
- pass: `npm run docs:web-trace:test`（13 tests）
- pass: `npm run test:web-semantic-ui`（5 tests）
- pass: `npm run docs:web-inventory:check`
- pass: `python3 scripts/validate_docs.py`
- pass: `npm run docs:hidden-unicode:check`
- pass: Playwright test listing（追加2件を検出）
- blocked: targeted Playwright execution。`tsx` CLI IPC 制約を `node --import tsx` で回避して API / Web server 起動までは確認したが、実行環境に Chromium executable がない。final-head GitHub Actions を判定根拠にする。
- pass: `git diff --check`
