# チャット UI responsive・状態表示の完成

- 状態: todo
- タスク種別: Web 品質実装
- 作成日: 2026-07-13
- 関連要件: `FR-042`, `FR-043`, `SQ-004`

## 背景

チャット UI の部品は存在するが、対象 viewport での no-overlap、keyboard 操作、loading/empty/error/permission state を満たす一貫した検証が不足する。

## 目的と範囲

主要 viewport と入力手段で、根拠、回答不能、error/permission state を隠さず操作できる chat UI と自動検証を完成させる。

## 受け入れ条件

- [ ] 承認 viewport で入力、回答、引用、履歴操作が重ならず利用できる。
- [ ] keyboard/focus、loading、empty、error、permission state が識別可能である。
- [ ] API にない件数・容量・user/group を架空表示しない。
- [ ] component test と responsive E2E/visual check を追加する。

## 検証・文書

- Web lint/typecheck/unit/build と対象 viewport の E2E/visual check を実行する。
- `FR-042`, `FR-043`, `SQ-004` と UI design を同期する。

## リスク

承認 viewport と browser matrix は requirement owner の決定が必要である。
