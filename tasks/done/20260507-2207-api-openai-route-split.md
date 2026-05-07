# API OpenAI route split

## 背景

`memorag-bedrock-mvp/apps/api/src/app.ts` に OpenAI 関連の定義や処理が集まり、変更競合が起きやすい。特に OpenAI 互換 API の定義を `app.ts` から切り出し、今後の変更が局所化される構成にしたい。

## 目的

`app.ts` を薄くし、OpenAI 関連 route の定義・schema・handler を専用 module へ委譲する。

## スコープ

- `memorag-bedrock-mvp/apps/api/src/app.ts` の OpenAI 関連 route 定義の分割
- 分割先 module の追加
- 既存 API contract を変えないためのテスト・型チェック
- 必要なドキュメント更新要否の確認

## 非スコープ

- OpenAI 互換 API の仕様変更
- 認証・認可ポリシーの緩和
- Web UI や infra の変更

## 作業計画

1. `app.ts` の OpenAI 関連定義と依存関係を確認する。
2. 既存の route/module 分割パターンを確認する。
3. OpenAI 関連定義を専用 module に移動し、`app.ts` は登録処理だけにする。
4. 変更範囲に応じた検証を実行する。
5. 作業レポート、commit、push、PR、受け入れ条件コメントまで実施する。

## ドキュメント保守方針

API の外部仕様を変えないリファクタリングとして扱う。公開 API、設定、運用手順に変更がなければ durable docs は更新せず、作業レポートに理由を残す。

## 受け入れ条件

- [ ] `app.ts` から OpenAI 互換 API の schema/handler 定義が専用 module に移され、`app.ts` は登録呼び出し中心になる。
- [ ] OpenAI 互換 API の endpoint、request/response shape、認証境界が変わらない。
- [ ] 変更範囲に対して最小十分な API test/typecheck と `git diff --check` が実行され、結果が記録される。
- [ ] 作業レポートが `reports/working/` に保存される。
- [ ] PR 作成後、受け入れ条件確認コメントとセルフレビューコメントが日本語で投稿される。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- API workspace の typecheck script があれば実行
- `git diff --check`

## PR レビュー観点

- `app.ts` の責務が薄くなっているか。
- route 登録順序や middleware 適用順が変わっていないか。
- OpenAI 互換 API の schema/handler が仕様変更なしに移動されているか。
- RAG の根拠性、認可境界、dataset 固有分岐を弱めていないか。

## リスク

- route 定義の移動で登録順序や hook 適用順が変わると、既存 API の挙動に影響する可能性がある。
- `app.ts` 内のローカル変数依存が多い場合、切り出し interface が過大になる可能性がある。

## 完了メモ

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/181
- 受け入れ条件確認コメント: 投稿済み
- セルフレビューコメント: 投稿済み

## 状態

done
