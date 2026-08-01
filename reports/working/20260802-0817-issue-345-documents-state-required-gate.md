# Issue #345 / Draft PR #462: documents 状態証跡の required gate 追加

## 結果

Draft PR #462の既存integration branchをcurrent `main@0771521c`のまま更新する準備として、
`documents` の複数part共通状態契約をrequired `E2E-UI-STATE-001`へ追加した。
新規PRは作らず、既存のUI evidence収束単位を維持する。

## 開始時点

- base: `main@0771521cbe505d3ffeddcbe34deff89f67de8702`
- Draft PR #462 head: `9d8bbf8532a6a75175a642bd76530bf3d87721cc`
- mainとDraft headは前回実行後に更新なし。
- PR #462はopen / draft / mergeable、baseへのbehind 0、unresolved review thread 0。
- Issue #345、open PR / Issue、`tasks/todo/` / `tasks/do/`、`SQ-016`、`DES_UI_UX_001`、machine-readable / generated matrixを再確認した。

## 選定理由

- `documents` はcatalog（documents / groups）とreindex履歴を `useResourceStateController`へ結線済みで、production contractの追加設計を要しない。
- 既存E2Eは文書管理の成功時journeyを持つが、複数partのloading / 部分500 / 全403 / retry / false-zeroのfeature evidenceがない。
- open PR #458はdocuments API / hook / detail、#461はproduction documents componentsを変更するため、本差分はproduction fileを変更せず、E2E・正本・品質matrixだけに限定した。
- `profile` は非同期resource stateの適用可否、`chat` はstate / retryのowner判断を先に要するため、今回より安全に閉じられない。

## 原因と判断

- 直接原因: documents固有の複数part loading、取得失敗、権限拒否、回復シナリオがrequired selectorに登録されていなかった。
- 流出原因: matrix validatorは各AppView × ACのstatus構造を検証するが、画面固有HTTPシナリオの実走までは自動生成しない。
- 対策: 実画面境界を通るrequired E2E 2件を追加し、その証跡だけで`documents / AC-SQ016-007` automatedを更新する。
- 非対象: production API/UI behavior、RAG根拠性、認可契約、dataset behavior、PR #458 / #461のproduction変更。

## 変更

- `E2E-UI-STATE-001` に2シナリオを追加。
  - catalog documents取得待ち → documents側HTTP 500 / groups・reindex成功 → partial → retry → recovered / confirmed empty。
  - documents / groups / reindex migrationsの全GET HTTP 403 → permission denied。
- loading / partial / permission中のfalse zero、未確認一覧、confirmed empty説明を否定。
- partialで取得済みreindexと未更新catalogを区別し、raw errorのprivate detail非表示を固定。
- retry後の全resource再取得回数、recovered / confirmed emptyを固定。
- `documents / AC-SQ016-007` automatedのみを`pass`へ更新。
- manual / overallと、証拠のない`chat` / `profile`は`blocked`を維持。
- `REQ_SERVICE_QUALITY_016`、`DES_UI_UX_001`、machine-readable matrix、生成マトリクスを同期。
- `.codex/completion-status.json`を現在のpartial completionへ同期。

## ローカル検証

| 検証 | 結果 |
| --- | --- |
| E2E test listing | pass（追加2件を検出） |
| targeted Chromium E2E | blocked（Chromium executableなし） |
| targeted ESLint | pass |
| Web typecheck | pass |
| Web unit | pass（61 files / 443 tests、`TZ=Asia/Tokyo`） |
| Web build | pass（既存chunk-size advisoryのみ） |
| UI traceability | pass（13 tests） |
| semantic UI contract | pass（5 tests） |
| generated inventory check | pass |
| canonical docs validation | pass |
| hidden Unicode check | pass |
| `git diff --check` | pass |

## ローカル E2E blocker

既定Playwright serverは`tsx` CLIのsandbox IPC制約で起動できなかった。
一時的に同じentrypointを`node --import tsx`で起動し、API / Web serverの準備までは確認したが、
Playwright Chromium executableが環境に存在せず、2件ともbrowser launch前に停止した。
一時的なconfig差分は残していない。targeted E2Eは未実施であり、
final-head GitHub Actionsのrequired Web UI Qualityを完了判定に使う。

## 未完了

- final-head Web UI Quality / MemoRAG CI / semver。
- `chat` / `profile` の画面単位状態証跡。
- 代表screen reader、実browser 200% / 400% zoom、touch / real device、Firefox / WebKit。
- `OQ-UI-002` owner / cadence / approved matrix。
- 既存API C1 coverage taskの解消。

## 指示への適合

| 要件 | 状況 | 根拠 |
| --- | --- | --- |
| current main / 前回差分 / open PR・Issue / tasks / 正本・生成物を確認 | 対応 | main・PR #462・Issue #345・open work・品質matrix・UI正本を確認 |
| 重複しない最優先の小改善を1件選定 | 対応 | documents feature state evidenceに限定し、PR #458 / #461のproduction filesを回避 |
| task・実装・正本・生成物を同期 | 対応 | task、E2E、2正本、JSON matrix、generated matrix、completion status |
| lint・typecheck・unit・E2E・docs check | 一部未検証 | static/unit/docsはpass、local E2E実走はChromium不在でblocked |
| Draft PR更新・受け入れ条件・セルフレビュー・Issue進捗 | 進行中 | branch更新後、final-head CIを待ってGitHubコメントを追加 |
| 未検証を完了扱いしない | 対応 | taskは`do`、manual / overallと残り2画面は`blocked` |
| merge / deploy / release /破壊的変更をしない | 対応 | いずれも未実施 |

総合fit: 4.3 / 5.0（約86%）。実装・文書・ローカル静的/単体検証は指示に適合する一方、
local Chromium実走、final-head CI、GitHub上の最終記録が未完了のため満点としない。

## 次の具体作業

1. commit / publish後にDraft PR #462のfinal-head checksを確認する。
2. Web UI Qualityが成功した場合のみ、E2E関連受け入れ条件を完了へ更新する。
3. PRへ日本語の受け入れ条件コメントとセルフレビューを残す。
4. Issue #345に実装、検証、blocker、未完了、次候補を記録する。
