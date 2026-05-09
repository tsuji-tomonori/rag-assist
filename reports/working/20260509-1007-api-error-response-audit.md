# API error response audit work report

## 指示

- 今回の範囲以外の API でも、エラー時に内容をそのまま返していないか確認して修正する task を入れる。
- テストに AWS account ID を直書きしているため、`111111111111` のように意味のない値へ変更する。

## 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | 追加 task md を作成する | 対応 |
| R2 | API / Lambda entrypoint の raw error response を検索する | 対応 |
| R3 | 発見した raw error response を固定文言化する | 対応 |
| R4 | AWS account ID fixture を `111111111111` にする | 対応 |
| R5 | 関連テストを実行する | 対応 |

## 検討・判断

- 通常の Hono route は `app.onError` の安全化により unhandled error 詳細が response へ出ない。
- `chat-run-events-stream.ts` は Hono を経由しない Lambda streaming entrypoint であり、catch で `err.message` を plain body / SSE event に直接返していたため修正対象にした。
- `document-groups/{groupId}/share` の `Forbidden:` 詳細は権限・所有者境界の情報を含み得るため、HTTP response は `Forbidden` に固定した。
- `admin-routes.ts` の managed user duplicate は exact match の domain error だが、今後の監査で誤検知しないよう literal response に変更した。
- `adapters/user-directory.ts` の `err.message` は Cognito group lookup failure の server-side summary log であり、HTTP response ではないため残した。

## 実施作業

- `tasks/do/20260509-1007-api-error-response-audit.md` を追加した。
- `chat-run-events-stream.ts` の unhandled error response を `Internal server error` に固定し、詳細は `console.error` に出すよう修正した。
- `chat-run-events-stream.test.ts` に plain response / SSE error event の情報漏えい防止テストを追加した。
- `error-response.test.ts` と streaming test の AWS account ID を `111111111111` に統一した。
- `document-routes.ts` と `admin-routes.ts` の catch response を固定 literal にした。

## 成果物

| 成果物 | 内容 |
|---|---|
| `tasks/do/20260509-1007-api-error-response-audit.md` | 追加監査 task と受け入れ条件 |
| `memorag-bedrock-mvp/apps/api/src/chat-run-events-stream.ts` | Streaming Lambda の raw error response 抑止 |
| `memorag-bedrock-mvp/apps/api/src/contract/chat-run-events-stream.test.ts` | raw error 非露出の回帰テスト |
| `memorag-bedrock-mvp/apps/api/src/error-response.test.ts` | AWS account ID fixture のダミー化 |

## 検証

- `rg` で API response へ `err.message` / `String(err)` を返す箇所を確認。残件は validation response と server-side user directory summary log のみ。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `git diff --check`: pass

## Fit 評価

総合fit: 4.9 / 5.0

指定された追加 task、横断確認、修正、AWS account ID fixture のダミー化、テストを実施した。実 AWS 上の streaming Lambda 動作確認は行っていないため満点ではない。

## 未対応・制約・リスク

- 本番/検証 AWS 環境での streaming Lambda 実呼び出しは未実施。
- Validation error の `details` は利用者入力に対する schema error であり、内部例外ではないため今回の修正対象外とした。
