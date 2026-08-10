# Issue #345 チャットsemantic required gate 作業レポート

- 保存先: `reports/working/20260811-0805-issue-345-chat-semantic-required-gate.md`
- 対象: Issue #345 / Draft PR #462
- current main: `8e542b31`
- 作業開始head: `b7202b65`

## 1. 受けた指示

- current main、前回後の変更、open PR / Issue、task、正本・生成物を確認する。
- 既存作業と重複しない最優先の小改善を原則1件選ぶ。
- 受け入れ条件付きtask、実装、正本・生成物同期、最小十分な検証、Draft PR、Issue #345コメントまで行う。
- keyboard、screen reader、loading / error / permission / retry、画面→要件→受け入れ条件→E2E追跡を優先する。
- 未検証事項を完了扱いせず、merge / deploy / release / 破壊的変更を行わない。

## 2. 調査・判断

- current mainは`8e542b31`、Draft PR #462はhead`b7202b65`でbehind 0 / ahead 48だった。
- open PR #461はchatの`MessageList.tsx`、`ProcessingAnswer.tsx`等を変更中であるため、これらへの重複実装を避けた。
- 品質マトリクス上、chatの`AC-SQ016-003`は静的AX baselineがある一方でautomated=`blocked`だった。chat regionにbusy stateがなく、required E2Eも動的busy / liveを検査していないことを根本gapとした。
- `ChatView.tsx`は#461の変更pathではないため、region contractを1行追加し、E2E / 正本へ結ぶ小さなsliceを選択した。

## 3. 実施作業

- `ChatView`の「チャット」regionへ`aria-busy={isProcessing}`を追加した。
- unit testでidle時`false`、処理中`true`を確認した。
- required `E2E-UI-SR-SEMANTICS-001`へtest-only startRun / SSE fixtureを追加した。
- Chromium AX treeからchat regionのbusy false→true→falseと処理中articleのlive=`polite`を検査するようにした。
- `SQ-016`、UI正本、machine-readable trace / quality matrix、E2E READMEを同期した。
- 正規generatorでWeb UI生成文書を更新し、522,819 bytesのJSONを`jq empty`とfreshness checkで確認した。

## 4. 追跡

| 画面 | 要件 | 受け入れ条件 | required E2E | 状態 |
| --- | --- | --- | --- | --- |
| chat | `SQ-016` | `AC-SQ016-003` | `E2E-UI-SR-SEMANTICS-001` | automated pass候補。manual / overallはblocked |

## 5. ローカル検証

| 検証 | 結果 |
| --- | --- |
| `npm run lint` | pass |
| `npm run typecheck -w @memorag-mvp/web` | pass |
| `TZ=Asia/Tokyo npm test -w @memorag-mvp/web` | pass（62 files / 447 tests） |
| `npm run build -w @memorag-mvp/web` | pass（既存chunk-size advisoryのみ） |
| 対象Playwright `--list` | pass（Chromium 1件） |
| 対象Playwright実走 | blocked（`tsx` IPC `listen EPERM`、browser downloadは0-byte応答） |
| UI trace | pass（13 tests） |
| semantic UI | pass（5 tests） |
| manual evidence contract | pass（構造のみ。pass=0 / blocked=3 / not_run=1 / ready=false） |
| canonical / Web generated / OpenAPI / API code / infra / hidden Unicode / diff checks | pass |

## 6. 未完了・リスク

- final-head GitHub Actionsは未確認であり、E2E実走成功までは本sliceを完了扱いしない。
- representative screen readerの読み上げ順・重複通知は未検証。
- 実browser 200% / 400% zoom、touch / real-device、Firefox / WebKitは未検証。
- FR-051永続化・profile state contract、OQ-UI-002 owner / cadence / matrixはowner判断待ち。
- API C1 80.48%は目標85%未達で、既存taskで追跡中。

## 7. 初回final-head CIで検出・修正した事項

- Web UI Quality run `31442177263`は36 / 37で失敗した。
- 失敗はidle chatのbusy=false assertionで、Chromium AX treeがfalse propertyを省略する仕様とreaderの空文字defaultが不一致だった。
- busy=true propertyは変更せず、property omissionだけをfalseへ正規化した。DOM contractやproduction behaviorは変更していない。
- artifact `9083285138`、digest `sha256:e34db4a1845ea41e4a86f8377c4ba41992ccea59b2cca7c5e921b142e16b8312`を失敗証跡として保持する。

## 8. 指示適合度

総合fit: 4.2 / 5.0（約84%）

小改善の選定、実装、正本・生成物同期、ローカル検証は実施した。Draft PR / Issue更新とfinal-head CIが未完了であり、manual accessibility scopeも意図どおり未完了のため満点ではない。
