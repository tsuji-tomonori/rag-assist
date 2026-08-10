# Issue #345 チャットの動的 screen reader semantics を required gate にする

- 保存先: `tasks/do/20260811-0805-issue-345-chat-semantic-required-gate.md`
- 状態: do
- タスク種別: 修正
- 関連 Issue: #345
- 更新対象 PR: #462

## 背景

Draft PR #462 は current `main@8e542b31` を祖先に含み、画面別の keyboard、Chromium accessibility tree、状態遷移を required Web UI Quality gate へ段階的に追加している。チャットの静的 landmark・質問 form・textbox・送信 button は既存 `E2E-UI-SR-SEMANTICS-001` が検査する一方、`chat / AC-SQ016-003` の automated status は `blocked` のままで、回答処理中の busy/live semanticsを画面→要件→受け入れ条件→E2Eとして証明していない。

open PR #461 は `MessageList.tsx` や `ProcessingAnswer.tsx` を変更するため、重複を避けて同PRが触れない `ChatView.tsx` のcontainer contract、既存screen-reader E2E、正本・生成物だけを更新する。

## なぜなぜ分析

### 問題文

チャット画面は回答生成中を視覚表示するが、チャットregion自体が支援技術へbusy stateを公開せず、required AX E2Eも動的状態を検査しないため、`AC-SQ016-003` のautomated evidenceをpassにできない。

### confirmed

- `ChatView.tsx` の「チャット」sectionはaccessible nameを持つが、`aria-busy`を持たない。
- `MessageList.tsx` の処理中行は`aria-live="polite"`を持つ。
- 既存`E2E-UI-SR-SEMANTICS-001`はchatの静的name/roleだけを検査し、質問送信後のbusy/live stateを検査しない。
- open PR #461は`MessageList.tsx`と`ProcessingAnswer.tsx`を変更するが、`ChatView.tsx`とPR #462の品質正本・E2Eは変更しない。

### inferred

- 処理中表示を子要素のlive通知だけに委ねたため、画面全体が更新中であることをregion stateとして公開する設計が抜けた。
- 静的AX baselineが先に実装され、動的stateをpass判定の必須証跡へ昇格する追跡が後続taskに残った。

### open questions

- representative screen readerでの実際の読み上げ順・重複通知は本環境では確認できないため、manual evidenceはblockedを維持する。
- Firefox / WebKit、実browser 200% / 400% zoom、touch / 実機は未検証のまま維持する。

### 根本原因

直接原因はchat regionに`isProcessing`と結び付くbusy stateがないこと、流出原因はrequired AX E2Eが静的treeだけを検査して動的busy/live stateを受け入れ条件へ結んでいないことである。

### 全量対応方針

- `ChatView.tsx` の「チャット」regionへ`aria-busy={isProcessing}`を追加する。
- required `E2E-UI-SR-SEMANTICS-001`で質問送信前後のregion busy stateと処理中polite live statusをChromium AX treeから検査する。
- `chat / AC-SQ016-003`のautomated statusだけをpassへ更新し、manual / overallはblockedのまま維持する。
- #461変更pathへ重複実装せず、後続統合時の競合を局所化する。

## 目的

チャットの静的name/roleと回答処理中のbusy/live semanticsをrequired Chromium gateへ結び、`AC-SQ016-003`のautomated evidenceを検証可能にする。

## 対象範囲

- `apps/web/src/features/chat/components/ChatView.tsx`
- `apps/web/src/features/chat/components/ChatView.test.tsx`
- `apps/web/e2e/screen-reader-semantics.spec.ts`
- `apps/web/e2e/README.md`
- `docs/1_要求_REQ/**/REQ_SERVICE_QUALITY_016.md`
- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- `tools/web-inventory/ui-quality-matrix.json`
- `tools/web-inventory/ui-traceability.json`
- 正規generatorが更新する`docs/generated/`、completion status、本task、作業レポート

## 方針

- native region + `aria-busy`を用い、roleの上書きや冗長な`aria-label`を追加しない。
- Playwright route fixtureはE2E内に限定し、本番API、認可、RAG回答、dataset contractを変更しない。
- Chromium AX treeのbusy/live propertyを直接検査し、DOM attributeだけのassertionで代替しない。
- 自動証跡を代表screen reader、manual keyboard、real-browser zoom、real-deviceのpassへ読み替えない。

## 必要情報

- 正本: `REQ_SERVICE_QUALITY_016.md`、`DES_UI_UX_001.md`
- 機械可読正本: `tools/web-inventory/ui-quality-matrix.json`、`ui-traceability.json`
- 既存required evidence: `E2E-UI-SR-SEMANTICS-001`
- 直前レポート: `reports/working/20260810-0853-issue-345-chat-keyboard-required-gate.md`

## 実行計画

1. current main、open PR / Issue、task、正本・生成物の重複とgapを確定する。
2. taskを`tasks/do/`へ作成し、開始commitを作る。
3. chat regionのbusy contractとunit / required AX E2Eを追加する。
4. SQ-016、UI設計、trace、matrix、E2E READMEを同じevidenceへ同期する。
5. 正規generatorを実行し、生成物freshnessを確認する。
6. lint、typecheck、unit、対象E2E、docs checkを実行する。
7. report、PR本文、受け入れ確認、セルフレビュー、Issue #345を更新し、final-head CIを確認する。

## ドキュメントメンテナンス計画

- `SQ-016 / AC-SQ016-003`にchat busy/live AX evidenceを追加する。
- `DES_UI_UX_001`の画面→要件→受け入れ条件→E2E追跡を更新する。
- authored JSONを正としてWeb inventoryを正規生成し、`docs/generated/`を手編集しない。
- API / OpenAPI / RAG / deployment / operationsは変更しないため本文更新不要とし、freshness checkのみ行う。
- PR / Issueにはautomatedとmanualの境界、未実施検証、owner判断を明記する。

## 受け入れ条件

- [ ] Given チャットがidle、When Chromium AX treeを取得する、Then「チャット」regionのbusy stateはfalseである。
- [ ] Given 質問を送信して回答生成中、When Chromium AX treeを取得する、Then「チャット」regionのbusy stateはtrueで、処理中内容がpolite live statusとして公開される。
- [ ] Given fixture回答を受信する、When 処理が完了する、Then chat regionのbusy stateはfalseへ戻り、回答が表示される。
- [ ] `E2E-UI-SR-SEMANTICS-001`がrequired `@ui-quality` Chromium gateで成功する。
- [ ] `chat / SQ-016 / AC-SQ016-003 / E2E-UI-SR-SEMANTICS-001`を正本、設計、trace / matrix、生成文書で相互追跡できる。
- [ ] lint、Web typecheck、Web unit、対象E2E、docs checkが成功する。実行不能な検証は理由とfinal CI代替を記録する。
- [ ] representative screen reader、実browser 200% / 400% zoom、touch / 実機、Firefox / WebKit、FR-051 owner判断、API C1、OQ-UI-002を未完了として維持する。
- [ ] Draft PR #462の本文、受け入れ確認、セルフレビュー、Issue #345へ最終headとblockerを記録する。
- [ ] merge、deploy、release、force-push、破壊的変更を行わない。

## 検証計画

- `git diff --check`
- `npm run lint`
- `npm run typecheck -w @memorag-mvp/web`
- `TZ=Asia/Tokyo npm test -w @memorag-mvp/web`
- 対象Playwright Chromium実行。環境不足時は`--list`とfinal-head Web UI Qualityを必須確認する。
- `npm run docs:web-trace:test`
- `npm run test:web-semantic-ui`
- `npm run docs:web-inventory:check`
- `npm run docs:manual-a11y-evidence:test`
- `npm run docs:manual-a11y-evidence:check`
- `python3 scripts/validate_docs.py`
- OpenAPI / API code docs / infra inventory freshness check

## PRレビュー観点

- `aria-busy`が`isProcessing`と一致し、idle / processing / completedで正しく遷移するか。
- AX E2EがDOM attributeではなくChromium accessibility treeのbusy/live propertyを検査するか。
- route fixtureがE2Eに閉じ、本番API・認可・RAG回答を変更していないか。
- open PR #461の変更pathへ重複実装していないか。
- `AC-SQ016-003`のautomatedだけをpassへ更新し、manual / overallを誤ってpassにしていないか。
- 正本、authored JSON、生成文書、E2E IDが一致するか。

## 未決事項・リスク

- 決定事項: chat regionのbusy stateを本taskの唯一のproduction contract変更とする。
- 決定事項: error / permission / retryは既存`E2E-UI-STATE-001`の責務とし、重複させない。
- リスク: local Chromium未導入の場合、required E2E実走はGitHub Actionsへ委ね、final-head成功までtask / PRを未完了のまま維持する。
- リスク: manual screen readerの読み上げ品質は自動AX treeから推定しない。

## 実施結果（2026-08-11 / local）

- `ChatView`の「チャット」regionへ`aria-busy={isProcessing}`を追加し、unit testでidle=false / processing=trueを確認した。
- required `E2E-UI-SR-SEMANTICS-001`へidle→処理中→完了のbusy stateと処理中articleのpolite live propertyを検査するtest-only startRun / SSE fixtureを追加した。
- `chat / AC-SQ016-003`のautomatedだけを`pass`へ更新し、manual / overallは`blocked`を維持した。
- repository lint、Web typecheck、Web unit 447件、build、UI trace 13件、semantic 5件、canonical / generated docs checksは成功した。
- 対象Playwrightは1件をdiscoveryできた。local実走は`tsx` IPC `listen EPERM`とbrowser download 0-byte応答によりblockedのため、final-head Web UI Qualityを必須確認する。
- PR / Issue記録とfinal-head CIが未完了であり、状態は`do`を維持する。
- 初回final-head Web UI Qualityは36 / 37で失敗した。Chromium AX treeは`aria-busy="false"`をproperty omissionで表すため、readerが欠落値をfalseへ正規化せずidle/completed assertionと不一致になった。busy propertyが存在するtrueはそのまま保持し、欠落だけをfalseへ正規化するよう修正した。
- 2回目のfinal-head Web UI Qualityも36 / 37で失敗した。取得済みartifactの`chat-processing` AX JSONから、Chromium CDPはbusy=trueをbooleanではなく数値`1`として返すことを特定した。falseのproperty omissionとtrueの`1`をそれぞれ`false` / `true`へ正規化し、DOM attributeへの代替assertionに弱めずAX tree検査を維持した。
