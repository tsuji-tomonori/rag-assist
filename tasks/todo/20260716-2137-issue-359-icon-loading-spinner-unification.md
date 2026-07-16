# Issue #359 Phase 3a 残差: Icon / LoadingSpinner primitive 一本化

- 状態: todo
- タスク種別: 修正
- 親タスク: `tasks/do/20260716-2136-issue-359-confirm-dialog-unification.md`
- 対象 issue: #359 Phase 3a 残差

## 背景

ConfirmDialog 一本化の参照調査で、Icon / LoadingSpinner にも shared layer 間の重複候補がある。ただし利用範囲と生成 inventory への影響が ConfirmDialog から独立し、同一 PR に含めると変更範囲・競合面・UI検証量が増えるため分離する。

## 目的

Icon / LoadingSpinner の全実装・export・consumer・CSS・test を調査し、正本 layer と互換 API を決めて duplicate を安全に収束する。

## 受け入れ条件

- [ ] Icon / LoadingSpinner の実装、barrel export、consumer、CSS、test、generated inventory の全参照 graph がある。
- [ ] preserve / migrate / merge / delete の分類と互換 API が task 着手前に定義される。
- [ ] production consumer が唯一の正本 primitive を利用し、duplicate implementation が残らない。
- [ ] loading の accessible name / status、decorative icon の `aria-hidden`、button accessible name を回帰 test で固定する。
- [ ] mock / demo fallback を production path に追加しない。
- [ ] Web targeted / full coverage / typecheck / build、semantic / inventory / trace、関連 E2E、root CI が成功する。

## Done 条件

- 専用 worktree / branch / PR で実施し、ConfirmDialog PR と独立して review / merge できる。
- generated Web inventory を同期し、日本語 PR / 受け入れ確認 / セルフレビュー / report / final CI まで完了する。
