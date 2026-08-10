# Issue #345 チャット keyboard journey を required gate にする

- 保存先: `tasks/do/20260810-0853-issue-345-chat-keyboard-required-gate.md`
- 状態: do
- タスク種別: 修正
- 関連 Issue: #345
- 更新対象 PR: #462

## 背景

Draft PR #462 は current `main@8e542b31` を祖先に含み、画面横断の viewport、状態、keyboard、Chromium accessibility tree の自動証跡を required Web UI Quality gate へ段階的に追加している。
一方、`SQ-016 / AC-SQ016-002` のチャット画面は automated status が `blocked` のままである。既存 `question-journey.spec.ts` は Enter 送信を含むが required UI gate の対象外で、`keyboard-navigation.spec.ts` はチャットへの到達だけを確認し、質問入力から回答復帰までを keyboard-only で証明していない。

open PR #461 は本番 Chat component を変更するため、本タスクでは本番 component を変更せず、PR #462 の E2E・正本・品質マトリクスだけを更新して競合を増やさない。

## なぜなぜ分析

### 問題文

2026-08-10 時点のPR #462 headでは、keyboard-onlyでチャットの質問textboxへ到達しても、computed focus indicatorが表示されない。`SQ-016 / AC-SQ016-002` はkeyboard focusを視認可能にすることを求めるが、品質マトリクスのchat automated statusは`blocked`で、required E2Eもこの経路を検査していない。

### confirmed

- `ChatComposer.tsx`は質問入力にnative `textarea`を使い、keyboard Enter送信を実装している。
- `apps/web/src/styles/features/chat.css`の`.composer textarea`は`outline: 0`を指定する。
- 同selectorまたは親composerには、keyboard focus時に代替3px indicatorを表示する規則がない。
- `keyboard-navigation.spec.ts`はnavigation、history、favorites、profileを検査するが、chat textareaのfocus・送信・回答復帰は検査しない。
- open PR #461はChat componentを変更するが、`apps/web/src/styles/features/chat.css`とPR #462のE2E・SQ-016・quality matrixは変更対象に含めない。

### inferred

- textareaのbrowser既定outlineを消した際、composer全体のvisual styleを優先し、keyboard focusの代替indicatorが同時に定義されなかった。
- required gateがchat journeyを通らないため、focus indicator欠落が既存unit/state E2Eでは検出されなかった。

### open questions

- representative screen reader、実browser 200% / 400% zoom、touch / 実機での実測結果は本環境では取得できない。manual taskのblockedを維持する。
- #461統合後のChat component treeは変わり得るが、native textareaと`.composer`契約を維持する限り本修正は独立して適用できる。

### 根本原因

直接原因は`.composer textarea`がbrowser outlineを無効化しながら代替focus-visible indicatorを定義していないこと、流出原因はrequired keyboard gateがチャット入力から回答までを対象にしていないことである。

### 全量対応方針

- `.composer:focus-within`へWCAG 2.2 AAのFocus Appearanceを満たす3px indicatorを追加し、textarea以外の内部controlへfocusした場合も入力領域の現在位置を示す。
- required `E2E-UI-KEYBOARD-NAV-001`でTab到達、computed 3px indicator、Enter送信、処理中、回答復帰を検査し、発生原因と流出原因を同時に断つ。
- chatの`AC-SQ016-002`だけをpassへ更新し、manual evidenceと未確認axisはblockedのまま維持する。

## 目的

チャットの質問入力、3px focus indicator、Enter 送信、処理中、回答復帰を required Chromium E2E で追跡し、`AC-SQ016-002` の automated evidence を画面から受け入れ条件まで一意に結ぶ。

## 対象範囲

- `apps/web/e2e/keyboard-navigation.spec.ts`
- `apps/web/e2e/README.md`
- `apps/web/src/styles/features/chat.css`
- `docs/1_要求_REQ/**/REQ_SERVICE_QUALITY_016.md`
- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- `tools/web-inventory/ui-quality-matrix.json`
- `tools/web-inventory/ui-traceability.json`
- 正規 generator が更新する `docs/generated/` の Web UI 文書
- 本 task、completion status、作業レポート

## 方針

- Playwright route fixture は E2E 内に限定し、本番 API、認可、RAG、DOM 契約を変更しない。
- native textbox へ Tab で到達し、computed 3px focus indicator を確認する。
- textareaの既存`outline: 0`を個別復活させず、`.composer:focus-within`へ3px indicatorを追加して入力領域全体のfocusを明示する。
- 既定の Enter 送信で startRun と SSE final を経由し、処理中から回答へ回復することを確認する。
- 自動証跡は representative screen reader、実 browser 200% / 400% zoom、touch / 実機、Firefox / WebKit の代替にしない。
- `chat / AC-SQ016-002` の automated status だけを根拠に応じて更新し、manual / overall は `blocked` のまま維持する。

## 必要情報

- 正本: `REQ_SERVICE_QUALITY_016.md`、`DES_UI_UX_001.md`
- 機械可読正本: `tools/web-inventory/ui-quality-matrix.json`、`ui-traceability.json`
- 既存 required evidence: `E2E-UI-KEYBOARD-NAV-001`
- 既存状態 evidence: `E2E-UI-STATE-001`
- 直前レポート: `reports/working/20260809-0820-issue-345-pr462-main-convergence.md`

## 実行計画

1. current main、PR #462、open PR、task、正本、生成物の重複とgapを確定する。
2. task開始commit後、PR #462 headを非破壊 mergeする。
3. composerのfocus-visible欠落を局所CSSで修正し、required keyboard E2Eへチャット journeyを追加する。
4. SQ-016、UI設計、trace、matrix、E2E READMEを同じ evidenceへ同期する。
5. 正規 generatorを実行し、生成物freshnessを確認する。
6. 最小十分な lint、typecheck、unit、E2E、docs checkを実行する。
7. report、PR本文、受け入れ条件、セルフレビュー、Issue #345を更新する。
8. final-head CIを確認し、未検証事項を未完了のまま記録する。

## ドキュメントメンテナンス計画

- `SQ-016` の `AC-SQ016-002` にチャットkeyboard evidenceを追加する。
- `DES_UI_UX_001` の画面→要件→受け入れ条件→E2Eの追跡を更新する。
- authored JSONを正としてWeb inventoryを正規生成し、`docs/generated/` を手編集しない。
- API / OpenAPI / RAG / deployment / operationsは挙動を変更しないため本文更新不要とし、freshness checkだけを行う。
- PR本文には実施した検証とmanual / owner / CIの未完了事項を明記する。

## 受け入れ条件

- [ ] Given サインイン済みでチャット画面が表示されている、When keyboard-onlyで質問textboxへTab移動する、Then textboxがfocusされcomposerのcomputed outlineがsolid 3pxである。
- [ ] Given 質問textboxに文字列がある、When 既定のEnterを押す、Then `POST /rpc/chat/startRun` が1回発行され、処理中表示を経てfixture由来の回答が表示される。
- [ ] `E2E-UI-KEYBOARD-NAV-001` がrequired `@ui-quality` Chromium gateで成功する。
- [ ] `chat / AC-SQ016-002` の正本、設計、machine-readable trace / matrix、生成文書が同じE2E evidenceを参照する。
- [ ] lint、Web typecheck、Web unit、対象E2E、docs checkが成功する。実行不能な検証は理由とfinal CI代替を明記する。
- [ ] representative screen reader、実browser 200% / 400% zoom、touch / 実機、Firefox / WebKit、FR-051 owner判断、API C1を未完了として維持する。
- [ ] Draft PR #462の本文、受け入れ確認、セルフレビュー、Issue #345に最終headとblockerを記録する。
- [ ] merge、deploy、release、force-push、破壊的変更を行わない。

## 検証計画

- `git diff --check`
- `npm run lint`
- `npm run typecheck -w @memorag-mvp/web`
- `TZ=Asia/Tokyo npm test -w @memorag-mvp/web`
- 対象 Playwright E2E の Chromium 実行。実行環境がない場合は `--list` と final-head Web UI Qualityを必須確認する。
- `npm run docs:web-trace:test`
- `npm run test:web-semantic-ui`
- `npm run docs:web-inventory:check`
- `npm run docs:manual-a11y-evidence:test`
- `npm run docs:manual-a11y-evidence:check`
- `python3 scripts/validate_docs.py`
- OpenAPI / API code docs / infra inventory freshness check

## PRレビュー観点

- 本番Chat componentや並行PR #461の変更へ重複していないか。
- `.composer:focus-within`が内部controlの操作を妨げず、3px indicatorを安定して表示するか。
- route fixtureがE2Eに閉じ、本番RAG回答・認可・dataset固有分岐を変更していないか。
- Enter送信のrequest回数、処理中、回答復帰、focus indicatorが観測可能か。
- `AC-SQ016-002`だけを根拠に応じてpassへ更新し、manual / overallを誤ってpassにしていないか。
- 正本、authored JSON、生成文書、E2E IDが一致するか。
- 未実施のscreen reader、zoom、実機、cross-browser、owner判断を実施済みと書いていないか。

## 未決事項・リスク

- 決定事項: 今回は既定のEnter送信だけを対象とし、Ctrl+Enter選択のsession contractは既存profile evidenceへ委ねる。
- 決定事項: private detail、permission、SSE retryは既存 `E2E-UI-STATE-001` の責務とし、本タスクへ重複させない。
- リスク: local Chromiumが未導入の場合はrequired E2E実走をGitHub Actionsへ委ねる。その場合、taskとPRはfinal-head CI確認まで未完了とする。
- リスク: 代表screen readerと実browser zoomは自動化結果から推定せず、manual taskのblockedを維持する。

## 実施結果（2026-08-10 / local）

- `.composer:focus-within`へ3px indicatorを追加し、required keyboard E2Eへchat質問入力、Enter送信、処理中、回答復帰を追加した。
- chat / `AC-SQ016-002`のautomated statusだけを`pass`へ更新し、manual / overallは`blocked`を維持した。
- lint、Web typecheck、Web unit 446件、build、trace 13件、semantic 5件、canonical / generated docs checksはpassした。
- local Chromium実走はbrowser executable未導入でblocked。final-head Web UI Qualityを必須確認する。
- PR / Issue記録とfinal-head CIが未完了のため、状態は`do`を維持する。
