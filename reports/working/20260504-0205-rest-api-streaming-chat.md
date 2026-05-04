# REST API streaming chat run 作業レポート

## 受けた指示

- `worktree` を作成し、`rag-assist` の API Gateway 構成を REST API streaming 前提へ移行する。
- 通常 API は REST API buffered とし、chat 進捗は `POST /chat-runs` と `GET /chat-runs/{runId}/events` の非同期 streaming 構成にする。
- 既存 `/chat` は後方互換として残す。
- 実装後に検証し、git commit と main 向け PR を作成する。PR 作成は GitHub Apps を利用する。

## 要件整理

- API Gateway は Regional REST API に統一し、proxy route 経由で既存 Hono API を維持する。
- streaming endpoint のみ `ResponseTransferMode.STREAM` を使い、通常 API は buffered のままにする。
- chat run と event log を永続化し、接続断後も `Last-Event-ID` で再接続できる SSE stream にする。
- 認証・認可は Cognito user pools authorizer とアプリ側 permission の両方で維持する。
- フロントエンドは `Authorization` header が必要なため、`EventSource` ではなく `fetch` + `ReadableStream` で SSE を読む。

## 検討・判断の要約

- AWS 公式ドキュメントで API Gateway response streaming が REST API の proxy integration 向け機能で、`responseTransferMode = STREAM` が必要なことを確認した。
- REST API の stage path を CloudFront config と output に反映しやすいよう、CDK 内では明示的に `/prod/` URL を組み立てた。
- `ChatRunEventsStreamFunction` は RAG 実行を担当せず、DynamoDB event log を SSE として配信する責務に分離した。
- stream endpoint は run owner か `chat:admin:read_all` を持つ管理者だけが購読できるようにした。

## 実施作業

- `/home/t-tsuji/project/rag-assist-rest-stream` に worktree と `codex/rest-api-streaming-chat` ブランチを作成した。
- CDK を `apigwv2.HttpApi` から Regional `apigw.RestApi` へ移行し、`ANY /`、`ANY /{proxy+}`、`POST /chat-runs`、`GET /chat-runs/{runId}/events` を定義した。
- `ChatRunsTable`、`ChatRunEventsTable`、`ChatRunWorkerFunction`、`ChatRunEventsStreamFunction`、`ChatRunStateMachine` を追加した。
- chat run/event の DynamoDB store と local store を追加した。
- `runQaAgent()` に progress sink を追加し、各 node の開始・完了を event として記録できるようにした。
- API に `POST /chat-runs` を追加し、run 作成、queued event 保存、worker 起動を行うようにした。
- streaming Lambda を追加し、SSE の `status`、`heartbeat`、`final`、`error`、`timeout` を配信するようにした。
- Web UI を `startChatRun()` と `streamChatRunEvents()` に切り替え、既存 `/chat` client は後方互換として残した。
- access-control test、infra snapshot、API/Web tests、README、API examples、API design doc を更新した。

## 成果物

- REST API buffered + REST API streaming の CDK 構成。
- 非同期 chat run 用 API、worker、event stream Lambda、永続 store。
- fetch streaming ベースの Web chat UI。
- API/infra/web/security/doc のテストとドキュメント更新。

## 検証

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp/infra run typecheck`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp/infra test`
- `npm --prefix memorag-bedrock-mvp run lint`
- `git diff --check`

すべて成功した。

## 指示への fit 評価

- REST API 統一、streaming endpoint の追加、既存 `/chat` 維持、Web UI 切り替え、認証・認可維持、ドキュメント更新、検証を実施した。
- PR 作成は GitHub Apps 経由で実施予定。ローカル `gh` は認証 token が無効だったため利用しない。

## 未対応・制約・リスク

- 実 AWS 環境への deploy と実ブラウザでの streaming 疎通確認はこの作業では未実施。
- REST API への移行により endpoint URL は `/prod/` stage path を含むため、既存外部連携が直接 API URL を参照している場合は更新が必要。
- REST API は HTTP API より API Gateway コストが上がる可能性がある。
- response streaming は AWS 側の新機能であり、CDK/CloudFormation のサポート状況に依存する。
