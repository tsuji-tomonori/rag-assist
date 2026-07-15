# チャット UI responsive・状態表示の完成

- 状態: do
- タスク種別: Web 品質実装
- 作成日: 2026-07-13
- 関連要件: `FR-042`, `FR-043`, `SQ-004`
- 関連 issue/task: `#345`, `tasks/done/20260714-issue-345-chat-assignee-journey.md`, `tasks/todo/20260714-issue-345-cross-screen-a11y-responsive.md`

## 背景

チャット UI の部品は存在するが、対象 viewport での no-overlap、keyboard 操作、loading/empty/error/permission state を満たす一貫した検証が不足する。

## 目的と範囲

主要 viewport と入力手段で、根拠、回答不能、error/permission state を隠さず操作できる chat UI と自動検証を完成させる。

本 task は chat 単体の `SQ-004` responsive 条件を owner とする。chat→human response の cross-feature state journey は `20260714-issue-345-chat-assignee-journey.md`、全画面共通 matrix は `20260714-issue-345-cross-screen-a11y-responsive.md` を正とし、重複実装を避ける。

## 実行計画

1. chat の viewport/input/state fixture と baseline を確定する。
2. composer、answer、citation、history action の overlap/focus/state を修復する。
3. component/E2E/visual/manual verification を実行して再修復する。

## 作業前チェックリスト

- [x] chat attachment、回答、citation、new conversation の現行 state contract を確認する。
- [x] 既存 full E2E を実行し、stale locator、visual snapshot、実装 defect を分離する。
- [x] 一時添付を永続文書と誤認しない fixture 境界を確認する。
- [x] Issue #345 の manual screen reader / real-device evidence を自動検証と分離する。

## Done 条件

- [x] full Chromium E2E の chat / mobile / axe / visual / risky-operation を修復する。
- [x] Web lint / typecheck、full E2E、docs freshness を検証する。
- [x] 未実施の manual evidence を別 task の blocker として維持する。
- [ ] 日本語 commit、既存 stacked draft PR 更新、受け入れ条件コメント、セルフレビュー、作業レポート、task lifecycle push を完了する。

## ドキュメントメンテナンス計画

`FR-042`, `FR-043`, `SQ-004`, `SQ-016` と chat/UI design、generated inventory を同期する。

## 受け入れ条件

- [x] 承認済み自動化 viewport で入力、回答、引用、履歴操作が重ならず利用できる。
- [x] keyboard/focus、loading、empty、error、permission state が識別可能である。
- [x] API にない件数・容量・user/group を架空表示しない。
- [x] component test と responsive E2E/visual check を追加する。

## 検証・文書

- Web lint/typecheck/unit/build と対象 viewport の E2E/visual check を実行する。
- `FR-042`, `FR-043`, `SQ-004` と UI design を同期する。

## リスク

承認 viewport と browser matrix は requirement owner の決定が必要である。

代表 screen reader、実 browser 200% / 400% zoom、real-device touch / virtual keyboard は `tasks/todo/20260714-issue-345-manual-a11y-evidence.md` の owner であり、本 task の自動検証成功へ読み替えない。

## PR レビュー観点

回答根拠・回答不能・permission state を visual change で隠していないか、送信操作、focus、mobile keyboard、No Mock Product UI を確認する。
