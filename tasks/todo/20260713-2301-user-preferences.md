# 個人設定の永続化と適用

- 状態: todo
- タスク種別: 機能追加
- 作成日: 2026-07-13
- 関連要件: `FR-051`

## 背景

`FR-051` は planning 状態であり、本人境界を持つ設定 API/store、Web 設定画面、runtime 適用が完成していない。

## 目的と範囲

許可された個人設定だけを schema で管理し、本人の永続状態として API/Web/runtime に適用する。存在しない値を架空 default として表示しない。

## 受け入れ条件

- [ ] get/update が authenticated user の所有者境界を強制する。
- [ ] unknown/invalid value を拒否し、未設定は明示的な default policy または未設定状態にする。
- [ ] 設定変更が対象 runtime にだけ反映され、他 user に漏れない。
- [ ] API/store/Web/runtime の contract test を追加する。

## 検証・文書

- API authorization、store、Web state、runtime application test を実行する。
- `FR-051` と API/data/UI design を実装に同期する。

## リスク

assistant profile の共有設定は既存 `20260507-2000-assistant-profile-config.md` と分離する。
