# Issue #345 / Draft PR #462: benchmark 状態証跡の required gate 追加

## 結果

Draft PR #462 の既存 integration branch を current `main@0771521c` のまま更新し、
`benchmark` の共通状態契約を required `E2E-UI-STATE-001` へ追加した。
新規 PR は作らず、既存の UI evidence 収束単位を維持する。

## 開始時点

- base: `main@0771521cbe505d3ffeddcbe34deff89f67de8702`
- Draft PR #462 head: `26853045bb2f975973d4b9ec1e9c15a1ca2d9e2a`
- main と Draft head は前回実行後に更新なし。
- PR #462 は open / draft / mergeable、base への behind 0。
- Issue #345、open PR、`tasks/todo/` / `tasks/do/`、`SQ-016`、`DES_UI_UX_001`、machine-readable / generated matrix を再確認した。

## 選定理由

- `benchmark` は `runs` / `suites` を `useResourceStateController` へ結線済みで、production contract の追加設計を要しない。
- 既存 E2E は成功時の表示、start/cancel feedback、visual/keyboard evidence を持つが、HTTP 500 / 403 / retry / false-zero の feature evidence がない。
- `chat` は表示対象データ state と retry/resubmit contract の設計判断を要し、小さな安全修正の範囲を超える。
- 他の open PR が扱う認証、RAG、管理機能とは異なり、本差分は benchmark adapter の結線証跡に限定される。

## 原因と判断

- 直接原因: `benchmark` 固有の部分失敗、権限拒否、回復シナリオが required selector に登録されていなかった。
- 流出原因: matrix validator は各 AppView × AC の status 構造を検証するが、画面固有状態シナリオの実走までは自動生成しない。
- 対策: 実画面境界を通る required E2E 2件を追加し、その証跡だけで `benchmark / AC-SQ016-007` automated を更新する。
- 非対象: production API/UI behavior、RAG根拠性、認可契約、benchmark dataset behavior は変更しない。

## 変更

- `E2E-UI-STATE-001` に2シナリオを追加。
  - runs initial loading → HTTP 500、suites success → partial → retry → recovered / confirmed empty。
  - runs / suites の実 HTTP 403 → permission denied。
- loading / partial / permission 中の false zero と未確認の実行履歴 table を否定。
- partial で取得済みのテスト定義を保持し、失敗した実行履歴だけを未更新として区別する。
- raw error の private identifier 非表示を固定。
- `benchmark / AC-SQ016-007` automated のみを `pass` へ更新。
- manual / overall と、証拠のない `chat` / `assignee` / `documents` / `profile` は `blocked` を維持。
- `REQ_SERVICE_QUALITY_016`、`DES_UI_UX_001`、machine-readable matrix、生成マトリクスを同期。

## ローカル検証

| 検証 | 結果 |
| --- | --- |
| E2E test listing | pass（追加2件を検出） |
| targeted Chromium E2E | blocked（Chromium executableなし） |
| targeted ESLint | pass |
| Web typecheck | pass |
| Web unit | pass（61 files / 443 tests、`TZ=Asia/Tokyo`） |
| Web build | pass |
| UI traceability | pass（13 tests） |
| semantic UI contract | pass（5 tests） |
| generated inventory check | pass |
| canonical docs validation | pass |
| hidden Unicode check | pass |
| `git diff --check` | pass |

## ローカル E2E blocker

既定 Playwright server は `tsx` CLI の sandbox IPC 制約で起動できなかった。
一時的に同じ entrypoint を `node --import tsx` で起動して API / Web server の準備までは確認したが、
Playwright Chromium executable が環境に存在せず、2件とも browser launch 前に停止した。
一時的な config 差分は残していない。targeted E2E は未実施であり、
final-head GitHub Actions の required Web UI Quality を完了判定に使う。

## 未完了

- final-head Web UI Quality / MemoRAG CI / semver。
- `chat` / `assignee` / `documents` / `profile` の画面単位状態証跡。
- 代表 screen reader、実 browser 400% zoom、touch / real device。
- `OQ-UI-002` owner / cadence / approved matrix。

## 指示への適合

| 要件 | 状況 | 根拠 |
| --- | --- | --- |
| current main / 前回差分 / open PR・Issue / tasks / 正本・生成物を確認 | 対応 | main・PR #462・Issue #345・品質matrixとUI正本を再確認 |
| 重複しない最優先の小改善を1件選定 | 対応 | benchmark feature state evidenceのみに限定 |
| task・実装・正本・生成物を同期 | 対応 | task、E2E、2正本、JSON matrix、generated matrix |
| lint・typecheck・unit・E2E・docs check | 一部未検証 | static/unit/docsはpass、local E2E実走はChromium不在でblocked |
| Draft PR更新・受け入れ条件・セルフレビュー・Issue進捗 | 進行中 | branch更新後、final-head CIを待ってGitHubコメントを追加 |
| 未検証を完了扱いしない | 対応 | taskは`do`、manual / overallと他4画面は`blocked` |
| merge / deploy / release /破壊的変更をしない | 対応 | いずれも未実施 |

総合fit: 4.3 / 5.0（約86%）。実装・文書・ローカル静的/単体検証は指示に適合する一方、
local Chromium実走、final-head CI、GitHub上の最終記録が未完了のため満点としない。

## 次の具体作業

1. commit / publish 後に Draft PR #462 の final-head checks を確認する。
2. Web UI Quality が成功した場合のみ、E2E関連受け入れ条件を完了へ更新する。
3. PRへ日本語の受け入れ条件コメントとセルフレビューを残す。
4. Issue #345 に実装、検証、blocker、未完了、次候補を記録する。
