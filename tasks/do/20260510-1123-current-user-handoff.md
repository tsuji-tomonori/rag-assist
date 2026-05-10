# current user による担当者問い合わせユーザー情報

## 背景

UI 改善ロードマップの P0 として、担当者問い合わせ・回答で固定の架空ユーザー名を送っている問題を解消する。
現在はチャットからの問い合わせ作成で `山田 太郎` / `利用部門`、担当者回答で `佐藤 花子` を本番 UI 経路から送信している。

## 目的

問い合わせ作成者・回答者の表示名を認証済みユーザー情報に由来させ、部署が取得できない場合は架空部署で埋めず、未設定として扱う。

## スコープ

- Web UI の問い合わせ作成・回答送信 payload。
- API service/store の既定 requester/responder 値。
- current user 由来の値を確認する unit / integration test。
- 必要最小限の OpenAPI 例またはテスト期待値の調整。

## 非スコープ

- 下書き保存 API の永続化。
- ユーザープロフィールへの department 追加。
- 問い合わせ画面全体の URL ルーティング。

## 実施計画

1. current user 型と `/me` レスポンスの利用可能フィールドを確認する。
2. UI から固定氏名/部署を送らないようにし、email/userId と未設定部署を使う。
3. API 側でも認証ユーザーを既定 requester/responder として渡す。
4. 本番 store の固定氏名 fallback を取り除く。
5. web/api の対象テストを追加・更新して検証する。

## ドキュメント保守計画

API request field 自体の形は変えないため、耐久ドキュメントの大規模更新は不要とする。
OpenAPI schema の example に架空氏名が残る場合は、固定人物名ではない例へ調整する。

## 受け入れ条件

- [ ] チャットから担当者へ質問を送る payload が固定の `山田 太郎` / `利用部門` を使わない。
- [ ] 担当者回答 payload が固定の `佐藤 花子` を使わない。
- [ ] API の create/answer 経路で、UI が名前を省略しても認証済みユーザーの email または userId が requester/responder に入る。
- [ ] 部署情報がない場合に架空の `利用部門` を入れず、`未設定` など正直な値として扱う。
- [ ] `/questions` 系 route の既存 permission は弱めない。
- [ ] 変更範囲に見合う web/api テストが pass する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `git diff --check`

## PR レビュー観点

- 本番 UI/API に固定の架空ユーザー名・部署が残っていないこと。
- requester/responder の保存値が監査・問い合わせ表示として misleading にならないこと。
- `answer:publish` / `chat:create` の認可境界を変更していないこと。

## リスク

- 現行 current user は department を持たないため、部署は `未設定` として保存される。
- displayName も current user に含まれないため、表示名は email を優先し、なければ userId になる。

状態: do
