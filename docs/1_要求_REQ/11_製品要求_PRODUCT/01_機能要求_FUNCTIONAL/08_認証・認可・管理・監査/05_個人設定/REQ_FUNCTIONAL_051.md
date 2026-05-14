# FR-051 個人設定

- 種別: `REQ_FUNCTIONAL`
- 状態: planning
- 仕様参照: `docs/spec/2026-chapter-spec.md` 6A 章
- FR-051: 利用者がチャット送信方法、既定モデル、既定回答範囲、非同期エージェントの既定 provider / model、通知、表示に関する個人設定を保存できること。

## 要求

利用者がチャット送信方法、既定モデル、既定回答範囲、非同期エージェントの既定 provider / model、通知、表示に関する個人設定を保存できること。

## 受け入れ条件

- [ ] 個人設定は利用者本人にのみ適用される。
- [ ] 個人設定は feature permission や resource permission を拡張しない。
- [ ] 権限を失った対象を既定範囲に保持していても、実行時に再確認される。

## 備考

Phase J / G の UI・API 設計で詳細化する。
