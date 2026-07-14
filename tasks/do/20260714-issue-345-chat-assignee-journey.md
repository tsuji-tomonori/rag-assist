# Issue #345 chat・history・assignee の状態 journey を完成する

状態: in_progress

タスク種別: 機能追加

## 背景

質問、RAG 処理、回答/回答不能、引用、確認質問、人手 escalation、担当者回答、履歴通知が複数 feature に分散し、利用者が現在状態と次操作を一貫して追える E2E evidence が不足する。

## 目的・対象範囲

chat、history/favorites、questions/assignee を対象に question-to-human-response の state model と対象付き feedback を整え、権限別の主要 journey を検証する。

## 必要情報

- 要件: `FR-003`〜`FR-005`, `FR-021`, `FR-029`, `FR-031`〜`FR-036`, `FR-042`〜`FR-044`, `FR-095`, `SQ-016`
- gap: `GAP-UI-006`
- 既存 task: `20260713-2304-responsive-chat-ui-verification.md`
- 依存 draft PR: `#348`〜`#353`（base: `20756cf68e3362e21f0581341218b4feb54b3f07`）

## 作業前チェックリスト

- [x] chat/history/favorites/questions の state、actor、next action、route、resource state を inventory 化する。
- [x] 関連 FR と既存 API contract、owner/assignee authorization、RAG evidence/refusal 契約を確認する。
- [x] standard user / assignee / admin の実データ由来 journey と test-only fixture の境界を確定する。
- [x] retry/duplicate/late/partial/error と long/many/zero、keyboard/responsive の検証方法を選定する。
- [x] README、正規 docs、generated inventory、API/security policy への影響範囲を確定する。

## Done 条件

- [x] 受け入れ条件を満たす question-to-human-response state journey と対象付き next action/feedback が実装されている。
- [x] owner/assignee authorization、RAG 根拠性・回答不能、機微情報、No Mock Product UI の境界を弱めていない。
- [x] retry/duplicate/late/partial/error、long/many/zero、permission と keyboard/responsive を false success なしで検証できる。
- [x] 関連 FR、design、traceability、generated inventory、必要な API/security docs が実装と同期している。
- [x] 選定した lint、typecheck、test、build、E2E、docs check が成功し、未実施検証は理由付きで記録されている。
- [ ] 日本語 commit、draft PR、受け入れ確認コメント、セルフレビュー、作業レポート、task の `done` 移動と lifecycle commit/push が完了している。

## 実行計画

1. state/event/actor/next-action を既存 API と要件から確定する。
2. status、citation、clarification、escalation、assignee result を target context に揃える。
3. permission/error/retry/duplicate/late response を扱う。
4. standard user と assignee の end-to-end scenario を追加する。

## ドキュメントメンテナンス計画

関連 FR、`DES_UI_UX_001`、chat/questions design と generated inventory を同期する。回答根拠、回答不能、認可境界は弱めない。

## 受け入れ条件

- [x] 処理中、回答、回答不能、citation、clarification、escalated、assigned、answered、resolved が区別される。
- [x] status と next action が質問/回答/履歴 item に関連付き、generic message だけに依存しない。
- [x] standard user は自分の ticket/result だけ、assignee は許可範囲だけを操作する。
- [x] retry/duplicate/late/partial/error が根拠なく成功状態へ変換されない。
- [x] responsive、keyboard、screen reader、long answer/many history/zero/error を検証する（screen reader は role/name/live region と axe による自動 proxy。実支援技術・実機の手動確認は本 task では未実施）。

## 検証計画

- state/component/API contract test
- standard user ↔ assignee E2E
- chat responsive task の viewport/visual checks
- Web/API lint/typecheck/test/build、docs/inventory check

## PR レビュー観点

RAG 根拠性、owner/assignee authorization、履歴の機微情報、dataset 固有分岐、mock data を確認する。

## 検証結果

- `npm test -w @memorag-mvp/web`: 51 files / 389 tests 成功。
- 関連 API test 7 files: identity、DynamoDB/local store、schema、route、service は sandbox 内で成功し、localhost を使う `questions-access.test.ts` は sandbox 外で 1/1 成功。API 全体 test は 775 tests 成功済みで、最終 schema 差分は関連 test と最新 build/typecheck で再確認した。
- `npm run test:e2e -w @memorag-mvp/web -- e2e/question-journey.spec.ts`: 2/2 成功。拒否から有人回答・履歴・解決まで、citation/clarification、long/many/zero、mobile overflow、keyboard focus/Enter、axe を確認した。
- visual regression の「回答と引用表示」「管理系画面」: baseline 更新後、更新なし再実行で 2/2 成功し、画像も目視確認した。
- `npm run test:web-semantic-ui`、`npm run lint`、`npm run typecheck`、`npm run build`、`task docs:check`、`git diff --check`: 成功。
- build の既存 chunk size 警告は残るが build 自体は成功した。

## 未実施・制約

- 実 screen reader、200% zoom、実端末での手動確認は自動化証跡と同一視せず、Issue #345 全体の manual/gate milestone に残す。
- notification channel と SLA は既存 API/要件にないため架空実装していない。
- `apps/api/src/routes/question-routes.ts` は説明文のみ変更し、route/auth/resource policy は変更していない。既存 access-control policy と requester/assignee access test で境界維持を確認した。

## 未決事項・リスク

通知 channel や SLA は本 task で架空決定せず、既存 API/要件にない場合は open question とする。
