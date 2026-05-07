# 非同期 ingest run 化

状態: do

## 背景
API 呼び出しの同期 timeout を 60 秒へ延長済みだが、Bedrock、PDF OCR、embedding、文書取り込みでは今後も 60 秒超過が想定される。既存 chat run の非同期構成を参考に、まず文書取り込みの同期依存を減らす。

## 目的
Lambda を中心としたサーバレス構成を維持しながら、文書取り込みを非同期 run として開始・追跡できる API を追加する。

## スコープ
- API に非同期 document ingest run の開始、状態取得、イベント取得を追加する。
- 既存 DynamoDB chat run/event store を大きく壊さず、最小実装で timeout 回避導線を作る。
- 既存同期 API は後方互換として残す。
- README/API examples など最小限の docs を更新する。

## 計画
1. 既存 chat run/store/event の型と API route を確認する。
2. document ingest run 用の型/schema/service method/worker を追加する。
3. CDK に worker Lambda と Step Functions state machine、権限、環境変数、route を追加する。
4. API/web docs と contract/unit test を更新する。
5. targeted test と diff check を実行する。

## ドキュメント保守方針
API shape と運用導線が変わるため、`memorag-bedrock-mvp/README.md` と `memorag-bedrock-mvp/docs/API_EXAMPLES.md` を更新する。必要なら deploy/operation docs へ timeout 方針を追記する。

## 受け入れ条件
- `POST /document-ingest-runs` が認証済み利用者に対して `runId`、`status`、`eventsPath` を返す。
- `GET /document-ingest-runs/{runId}` が owner または十分な管理権限だけに状態・manifest/error を返す。
- `GET /document-ingest-runs/{runId}/events` が owner または十分な管理権限だけに SSE event を返す。
- worker 側で既存 `service.ingest` を実行し、成功時は manifest、失敗時は error を run と event に保存する。
- 既存 `POST /documents` と `/documents/uploads/{uploadId}/ingest` は後方互換として残る。
- CDK 上で API Lambda と worker Lambda の権限・環境変数が整合する。
- API route 追加に伴う認可 policy test を更新し、API test を実行する。
- README/API examples に非同期 ingest の利用方法と同期 API の位置付けを記載する。

## 検証計画
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`
- `git diff --check`

## PRレビュー観点
- 新規 route が auth middleware と permission check の両方で保護されていること。
- owner 境界を越えて ingest run や manifest を参照できないこと。
- 非同期 worker 失敗時に run が未完了のまま残らないこと。
- benchmark seed metadata の隔離条件を弱めていないこと。

## リスク
- Step Functions 版と将来の Lambda Durable Functions 版の二重化を避けるため、今回は run contract を先に安定化する。
- 大きな contentBase64 を run table に保存すると DynamoDB item size 上限に近づくため、S3 upload session の非同期 ingest を主導線にする。
