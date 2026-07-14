# Issue #345 chat・history・assignee の状態 journey を完成する

状態: todo

タスク種別: 機能追加

## 背景

質問、RAG 処理、回答/回答不能、引用、確認質問、人手 escalation、担当者回答、履歴通知が複数 feature に分散し、利用者が現在状態と次操作を一貫して追える E2E evidence が不足する。

## 目的・対象範囲

chat、history/favorites、questions/assignee を対象に question-to-human-response の state model と対象付き feedback を整え、権限別の主要 journey を検証する。

## 必要情報

- 要件: `FR-003`〜`FR-005`, `FR-021`, `FR-029`, `FR-031`〜`FR-036`, `FR-042`〜`FR-044`, `FR-095`, `SQ-016`
- gap: `GAP-UI-006`
- 既存 task: `20260713-2304-responsive-chat-ui-verification.md`

## 実行計画

1. state/event/actor/next-action を既存 API と要件から確定する。
2. status、citation、clarification、escalation、assignee result を target context に揃える。
3. permission/error/retry/duplicate/late response を扱う。
4. standard user と assignee の end-to-end scenario を追加する。

## ドキュメントメンテナンス計画

関連 FR、`DES_UI_UX_001`、chat/questions design と generated inventory を同期する。回答根拠、回答不能、認可境界は弱めない。

## 受け入れ条件

- [ ] 処理中、回答、回答不能、citation、clarification、escalated、assigned、answered、resolved が区別される。
- [ ] status と next action が質問/回答/履歴 item に関連付き、generic message だけに依存しない。
- [ ] standard user は自分の ticket/result だけ、assignee は許可範囲だけを操作する。
- [ ] retry/duplicate/late/partial/error が根拠なく成功状態へ変換されない。
- [ ] responsive、keyboard、screen reader、long answer/many history/zero/error を検証する。

## 検証計画

- state/component/API contract test
- standard user ↔ assignee E2E
- chat responsive task の viewport/visual checks
- Web/API lint/typecheck/test/build、docs/inventory check

## PR レビュー観点

RAG 根拠性、owner/assignee authorization、履歴の機微情報、dataset 固有分岐、mock data を確認する。

## 未決事項・リスク

通知 channel や SLA は本 task で架空決定せず、既存 API/要件にない場合は open question とする。
