# self-signup 方針と実装の整合

- 状態: do
- タスク種別: 機能追加
- 作成日: 2026-07-13
- 関連要件・gap: `FR-025`, `GAP-RD-020`, `OQ-RD-008`

## 背景

CDK の self-signup disabled、Web の signup 導線、`FR-025` が衝突し、post-confirmation handler も接続されていない。

## 目的と範囲

Issue #358 P0-B の独立フェーズとして、`FR-025` が正本とする self-signup を Cognito/CDK、Web、API、初期 role 付与で一貫させる。invite、SSO、tenant-configurable mode は今回の範囲外とし、self-signup 以外の trigger source へ role を付与しない。

## 既存実装・重複監査

- 2026-07-17 時点の open PR に `FR-025` / self-signup を扱うものはなく、独立 phase として実施できる。
- Web の `SignUp` / `ConfirmSignUp` と画面は存在する。
- CDK は `selfSignUpEnabled: false` で、bundle 対象の post-confirmation handler は User Pool に接続されていない。
- handler は環境変数で任意の canonical application role を選択できるため、接続前に `CHAT_USER` 固定へ狭める必要がある。

## 実装計画

1. User Pool の self-signup を有効にし、post-confirmation Lambda と trigger を配線する。
2. handler を `PostConfirmation_ConfirmSignUp` + `CHAT_USER` 固定とし、入力不備・最終 retry 失敗を例外で fail closed にする。
3. duplicate invocation、invalid confirmation code、Lambda 一時/継続失敗をテストする。
4. sign-up → confirmation → sign-in → 認証付き API 呼び出しを Web integration test で固定する。
5. FR/DES/運用文書、CDK snapshot、generated infra inventory を同期する。

## ドキュメント保守計画

- `FR-025` の受け入れ条件へ retry/fail-closed と一連の integration verification を追加する。
- `DES_DLD_004` と運用文書へ trigger retry と失敗時の未付与境界を反映する。
- `docs/generated/infra-*` は synth された CDK template から再生成する。

## 受け入れ条件

- [ ] Cognito User Pool の self-signup が有効で、post-confirmation trigger が配線される。
- [ ] self-signup 確認時の自動付与は `CHAT_USER` のみに固定され、設定・入力から上位 role を選べない。
- [ ] self-signup 以外の trigger source、入力不備、継続する Lambda 失敗は role 未付与のまま fail closed になる。
- [ ] duplicate invocation と一時失敗 retry が同じ `CHAT_USER` 付与へ収束する。
- [ ] duplicate sign-up と invalid confirmation code は session を作らない。
- [ ] sign-up → confirmation → sign-in → 認証付き API の integration test が pass する。
- [ ] CDK assertion、infra/Web test、typecheck/build/lint、docs/generated inventory check が pass する。
- [ ] 実 AWS sign-up E2E の未実施を PR・レポートで未検証として明示する。

## 検証計画

- post-confirmation handler の targeted test。
- `npm test -w @memorag-mvp/web`。
- `npm run typecheck -w @memorag-mvp/web` / `npm run build -w @memorag-mvp/web`。
- `npm test -w @memorag-mvp/infra`（snapshot 差分時は意図を確認して更新後に再実行）。
- `npm run typecheck -w @memorag-mvp/infra` / `npm run build -w @memorag-mvp/infra`。
- `npm run lint`、docs validation、infra inventory check、`git diff --check`。

## PR セルフレビュー観点

- self-signup が上位 role 付与経路にならないこと。
- IAM が `AdminAddUserToGroup` 以外を許可せず、同一 account/region の User Pool に限定されること。
- Lambda 失敗時に group 未付与を成功扱いしないこと。
- docs と実装、snapshot、generated inventory が同期すること。
- RAG 根拠性、benchmark 固有値、dataset 固有分岐を変更していないこと。

## リスク

- 実 AWS では確認メール配信、Cognito throttling、Lambda retry のサービス挙動を未検証のため、local integration test は実環境 E2E の代替ではない。
- User Pool と trigger Lambda policy の循環依存を避けるため、IAM resource は同一 account/region の `userpool/*` に限定する。handler 自体は `CHAT_USER` 固定とする。
