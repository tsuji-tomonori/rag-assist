# Issue #345: 文書画面の複数part状態証跡を required gate へ追加する

## 種別

- 修正

## 背景

Issue #345 と Draft PR #462 は、8 AppViews の共通状態契約を画面単位で required E2E へ収束している。
2026-08-02 時点では `history`、`favorites`、`assignee`、`benchmark`、`admin` の
`AC-SQ016-007` automated evidence があり、`documents` は catalog / reindex の
loading / partial / permission / retry 境界を実装済みだが、required gate では
成功時の文書journeyと表示しか画面単位に検証されていない。

## 原因分析（なぜなぜ）

### 問題文

文書画面は `/documents`、`/document-groups`、`/documents/reindex-migrations` の
取得中・部分HTTP 500・全HTTP 403・retry後のconfirmed emptyを区別する実装を持つ一方、
その結線を実ブラウザのrequired E2Eで検証していないため、
`documents / AC-SQ016-007` automated statusを合格判定できない。

### 確認済み事実

- `useAppShellState` は `canReadDocuments` のとき、catalogとしてdocuments / groupsを、権限があればreindex履歴も同時取得する。
- `useResourceStateController` は一部成功をpartial、全permission failureをpermissionとして表現し、retryで同じloader群を再実行する。
- `DocumentWorkspace` はcatalog未確認中に一覧・件数・confirmed emptyを表示せず、catalog取得成功後だけ0件表示を出す。
- raw HTTP response bodyは共通stateの利用者向けmessageへ露出しない。
- `E2E-UI-STATE-001` は `@ui-quality` によりrequired Chromium gateの対象である。
- open PR #458はdocuments API / hook / detail、#461はdocuments production componentsを変更している。
- current `main@0771521c` とopen PR構成は前回実行後に変化していない。

### 推定・未確認

- 推定: feature evidence欠落は、共通state primitive導入後に各AppViewのHTTP境界シナリオを順次追加している途中であることによる。
- 未確認: PR #458 / #461取り込み後も文言とDOM境界が同一か。
- 未確認: 代表screen reader、実browser 200%/400% zoom、touch実機、Firefox/WebKitでの結果。

### 根本原因

共通状態契約を `documents` のcatalog / reindex loaderへ適用した後、複数part固有の
loading・partial・permission・recoveryをrequired selectorへ追加する収束作業が未実施だった。
matrix validatorはstatus構造と参照整合を確認するが、各画面のHTTP境界シナリオを自動生成しないため、
欠落を画面単位のfailとして検出できなかった。

### 対策と対象範囲

- 実画面境界を通るrequired E2E 2件を追加し、複数partのpartial recoveryと全permission failureを検出する。
- loading / partial / permission中のfalse zero、未確認一覧、private detail非表示をassertする。
- retry後のrecovered / confirmed emptyと各API read countを固定する。
- この証跡だけで `documents / AC-SQ016-007` automatedを更新し、manual / overallと他2画面はblockedを維持する。

## スコープ

- `documents` のinitial loading → catalog側HTTP 500 / reindex成功 → partial → retry → confirmed empty recoveryを画面境界で検証する。
- `documents` の全resource HTTP 403をpermissionとして検証する。
- false zero、未確認の一覧・空表示、private detailの非表示を検証する。
- `SQ-016` 正本、UI/UX正本、machine-readable matrix、生成マトリクスを同じ証跡へ同期する。

## スコープ外

- `DocumentWorkspace`、documents API / hooks、共有・移動・削除・reindex mutationのproduction挙動変更。
- open PR #458 / #461のproduction差分。
- `chat`、`profile` の `AC-SQ016-007` status更新。
- 代表screen reader、実browser 400% zoom、touch / 実機検証。
- merge、deploy、release、force-push。

## 受け入れ条件

- [x] `E2E-UI-STATE-001` が `documents` のloading、部分HTTP 500、retry、confirmed empty、全HTTP 403を実画面境界で検証する。
- [x] loading / partial / permission中に未確認の件数、文書一覧、confirmed empty説明を表示しない。
- [x] partial stateが取得済みreindexと未更新catalogを区別し、raw HTTP errorのprivate detailを表示しない。
- [x] retry後にrecovered state、confirmed empty、0件表示を表示し、各resourceの読み込み回数を固定する。
- [x] permission stateでprotected contentを隠し、戻り導線を表示する。
- [x] `documents / AC-SQ016-007` のautomatedのみを `pass` とし、manual / overallと他2画面は `blocked` を維持する。
- [x] `REQ_SERVICE_QUALITY_016`、`DES_UI_UX_001`、machine-readable matrix、生成文書が同じ証跡を参照する。
- [x] targeted E2E、lint、typecheck、unit、trace / semantic / docs checksが成功するか、実行不能理由を未完了として記録する。
- [x] Draft PR #462を更新し、日本語の受け入れ条件コメント、セルフレビュー、Issue #345の進捗記録を残す。

## 実装計画

1. 既存 `visual-regression.spec.ts` のrequired `E2E-UI-STATE-001` に `documents` の2シナリオを追加する。
2. false-zero / false-content / raw-detail suppressionとretry recoveryをassertionで固定する。
3. 正本とmachine-readable matrixを同じE2E証跡へ同期し、generatorで生成物を更新する。
4. 変更範囲に対する最小十分な検証を実行し、未検証事項を残す。
5. Draft PR #462、受け入れ条件、セルフレビュー、Issue #345を更新する。

## ドキュメント保守計画

- `REQ_SERVICE_QUALITY_016.md` と `DES_UI_UX_001.md` の共通状態証跡範囲を `documents` まで拡張する。
- `tools/web-inventory/ui-quality-matrix.json` の `documents / AC-SQ016-007` automatedだけを更新する。
- `npm run docs:web-inventory` でgenerated Web docsを再生成し、手編集しない。

## 検証計画

- targeted Playwright list / Chromium E2E。
- `npx eslint apps/web/e2e/visual-regression.spec.ts`。
- Web typecheck / unit / build。
- UI trace、semantic UI、generated inventory、canonical docs、hidden Unicode、`git diff --check`。
- final-head GitHub Actions Web UI Quality / MemoRAG CI / semver。

## PRレビュー観点

- 未確認のcatalogを0件や空文書一覧として見せていないか。
- partial stateが成功partと失敗partを正しく区別しているか。
- permission stateがprotected content / raw response detailを表示していないか。
- automated passをmanual / overall passへ昇格していないか。
- PR #458 / #461のproduction差分や、RAG根拠性・認可境界・dataset固有production分岐を混在させていないか。

## リスクとロールバック

- required UI gateが2シナリオ増えるため実行時間が増える。
- 複数API route gateの解放漏れはtest hangを起こすため、loading assertion直後に必ず解放する。
- PR #458 / #461取り込み後にUI文言・構造が変わる場合は、正本契約を維持したままselectorを再評価する。
- 問題時は本taskのE2E 2件とdocumentsのマトリクス・正本文書差分を同時に戻す。

## 未完了として維持する項目

- `chat`、`profile` の画面単位状態証跡。
- 代表screen reader、実browser 400% zoom、touch / real device、Firefox / WebKit。
- `OQ-UI-002` owner / cadence / approved matrix。
- final-head CIの完了確認。

## 状態

- do

## 2026-08-02 ローカル検証

- pass: `npx eslint apps/web/e2e/visual-regression.spec.ts`
- pass: `npm run typecheck -w @memorag-mvp/web`
- pass: `TZ=Asia/Tokyo npm test -w @memorag-mvp/web`（61 files / 443 tests）
- pass: `npm run build -w @memorag-mvp/web`（既存chunk-size advisoryのみ）
- pass: `npm run docs:web-trace:test`（13 tests）
- pass: `npm run test:web-semantic-ui`（5 tests）
- pass: `npm run docs:web-inventory:check`
- pass: `python3 scripts/validate_docs.py`
- pass: `npm run docs:hidden-unicode:check`
- pass: Playwright test listing（追加2件をChromium対象として検出）
- blocked: targeted Playwright execution。既定serverは`tsx` CLI IPC制約で起動不能。同じentrypointを一時的に`node --import tsx`で起動してAPI / Web server準備までは確認したが、Chromium executableがなくbrowser launch前に停止した。設定差分は戻し、final-head GitHub Actionsを判定根拠にする。
- pass: `git diff --check`
- initial CI finding: [Web UI Quality run 30723527549](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30723527549) は状態見出しの期待値が正規表示名「文書ワークスペース」と不一致で追加2件のみ失敗。実装契約を変更せず期待値を補正した。
- pass: [Web UI Quality run 30723653119](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30723653119)（31 / 31、artifact `8825643713`）
- pass: [MemoRAG CI run 30723653103](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30723653103)。API C1 80.48%は目標85%未達だが既存改善taskへ分離された既知gapとしてworkflow判定は成功。
- pass: [semver run 30723653120](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30723653120)
