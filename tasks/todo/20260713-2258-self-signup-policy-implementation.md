# self-signup 方針と実装の整合

- 状態: todo
- タスク種別: 認証・仕様決定
- 作成日: 2026-07-13
- 関連要件・gap: `FR-025`, `GAP-RD-020`, `OQ-RD-008`

## 背景

CDK の self-signup disabled、Web の signup 導線、`FR-025` が衝突し、post-confirmation handler も接続されていない。

## 目的と範囲

self-signup、invite、SSO、tenant-configurable の正式方針を決定し、Cognito/CDK、Web、API、初期 role 付与を一貫させる。

## 受け入れ条件

- [ ] 承認された signup mode だけが UI と Cognito で利用可能になる。
- [ ] 初期主体・role・tenant assignment が fail closed で監査される。
- [ ] disabled mode に到達不能な signup UI や demo fallback が残らない。
- [ ] mode 別の CDK assertion、auth integration、Web test を追加する。

## 検証・文書

- `OQ-RD-008` の決定を `FR-025`、ADR/DES、運用へ反映する。
- Cognito/CDK、API auth、Web signup の検証を実行する。

## リスク

正式方針の承認前にいずれかの mode を本番 default として固定しない。
