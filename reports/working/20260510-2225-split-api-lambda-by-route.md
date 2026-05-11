# API route 別 Lambda 分離 作業レポート

## 受けた指示

重い API と軽い API で Lambda を分けたい。ただし API の source はそのまま維持したい。同じ Lambda を高 memory 化すると軽い API のコスト効率が悪いため、インフラ側で分離する。

## 要件整理

- `memorag-bedrock-mvp/apps/api/src` は変更しない。
- 同じ `lambda-dist/api` / `index.handler` を複数 Lambda に載せる。
- API Gateway integration で heavy route だけ高 memory Lambda に振り分ける。
- catch-all と軽い API は既存相当の 1024MB Lambda に残す。
- `chat-runs/{runId}/events` の response streaming 専用 Lambda は維持する。

## 検討・判断

API handler を分割せず、CDK で `ApiFunction` と `HeavyApiFunction` を同じ code asset / handler から作成する方針にした。API Gateway の明示 route は catch-all より優先されるため、重い同期 route を `HeavyApiFunction` に向け、明示 resource の副作用で軽い route が shadow される箇所は light integration を追加した。

IAM と environment は API source 共通運用を維持するため両 Lambda に同等に付与した。route 単位の最小権限化は handler/source 分離なしではリスクが高いため後続改善扱いとした。

## 実施作業

- `HeavyApiFunction` と専用 log group を追加した。
- `ApiFunction` は 1024MB の軽量 Lambda として維持した。
- `POST /chat`、`POST /search`、benchmark query/search、同期 ingest/reindex 系 route を heavy integration に接続した。
- catch-all、`POST /chat-runs`、light documents route、streaming events route が意図した Lambda に向く assertion test を追加した。
- CloudFormation snapshot を更新した。
- `docs/OPERATIONS.md` に route 分離、コスト影響、cold start の注意を追記した。

## 成果物

- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts`
- `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts`
- `memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json`
- `memorag-bedrock-mvp/docs/OPERATIONS.md`
- `tasks/do/20260510-2213-split-api-lambda-by-route.md`

## 検証

- pass: `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/infra`
- pass: `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`
- pass: `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`
- pass: `npm --prefix memorag-bedrock-mvp run lint`
- pass: `git diff --check`

## fit 評価

API source を変更せず、同じ artifact を軽量/重量 Lambda に展開して route integration だけで処理コストを分離したため、ユーザー要望に適合している。重い route の初期分類は同期 RAG、search、benchmark query/search、同期 ingest/reindex に限定した。

## 未対応・制約・リスク

- production deploy / smoke は未実施。対象環境への deploy 後に API Gateway method integration と実呼び出しを確認する必要がある。
- 同じ source を 2 Lambda に載せるため cold start は Lambda ごとに発生する。
- IAM は API source 共通運用に合わせて両 Lambda 同等。route 単位の最小権限化は後続課題。
