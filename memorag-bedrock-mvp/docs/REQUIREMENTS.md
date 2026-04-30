# Requirements

## 目的

社内文書を根拠に回答するQAチャットボットを、ローカル検証可能なMVPとして構築する。利用者は資料をアップロードし、同じ画面でモデルIDを指定して質問し、回答に使われた引用チャンクを確認できる。

## 対象ユーザー

- 社内利用者: 規程、手順書、FAQなどを自然文で検索したい。
- 管理者: 文書投入、削除、回答根拠の確認、モデル切り替えを行いたい。
- 評価担当者: UIではなくAPI経由でRAGベンチマークを実行したい。

## 機能要件

- テキストまたはbase64ファイルをアップロードできる。
- アップロード時に文書を抽出、チャンク化し、memory cardを生成して検索対象に登録する。
- 質問時にmemory card検索、clue生成、chunk検索、grounded answer生成を行う。
- 回答はアップロード済み資料の根拠に限定し、根拠不足時は回答不可を返す。
- `modelId`、`embeddingModelId`、`topK`、`minScore` をAPIパラメータから指定できる。
- UIは資料アップロード、モデルID指定、チャット、引用表示を1画面に集約する。
- ベンチマークは `/benchmark/query` APIとCLIから実行できる。
- API仕様は `/openapi.json` で取得できる。

## 非機能要件

- ローカルではAWSに接続せず、Bedrockモックとファイルベースvector storeで完結する。
- AWSではAPI Gateway、Lambda、Bedrock、S3、S3 Vectors、CloudFrontを基本構成とする。
- MVPではサーバ管理を避け、固定費を抑えやすいサーバレス構成を優先する。
- 文書本文、manifest、vector metadataはdocumentId単位で追跡できる。
- 型チェックとビルドがCI相当の最低限の品質ゲートになる。

## 受け入れ条件

- `npm install` が成功する。
- `npm run typecheck --workspaces --if-present` が成功する。
- `npm run build --workspaces --if-present` が成功する。
- ローカルAPIで `GET /health`、`POST /documents`、`POST /chat`、`GET /openapi.json` が成功する。
- サンプルdatasetでbenchmark CLIが結果JSONLを出力する。

## MVP外

- 認証認可、SSO、監査ログの本格実装。
- Bedrock Guardrailsや別モデルjudgeによる厳密なgroundedness評価。
- Textractなどを使った高精度OCR/文書変換パイプライン。
- マルチテナント分離、文書ACL、部署別権限制御。
