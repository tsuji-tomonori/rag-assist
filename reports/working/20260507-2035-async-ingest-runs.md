# 作業完了レポート

保存先: `reports/working/20260507-2035-async-ingest-runs.md`

## 1. 受けた指示

- API 呼び出し timeout が今後も発生する見込みのため、非同期化と AWS Lambda Durable Functions の組み合わせを検討し、必要に応じて実装する。
- `/plan` の後に `go` 指示があったため、計画に基づいて実装まで進める。
- リポジトリルールに従い、worktree task PR flow、検証、作業レポートを実施する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | timeout 回避のため同期 API 延命以外の非同期導線を作る | 高 | 対応 |
| R2 | Lambda 中心の serverless 構成を維持する | 高 | 対応 |
| R3 | Durable Functions の扱いを検討する | 中 | 対応 |
| R4 | 認可境界と owner 境界を弱めない | 高 | 対応 |
| R5 | テストと docs を更新する | 高 | 対応 |

## 3. 検討・判断したこと

- 既存 chat run と benchmark run はすでに非同期化されているため、timeout リスクが残る文書 ingest を優先した。
- 大きな PDF や OCR fallback を考慮し、`contentBase64` を run table に保存せず、S3 upload session 後の object key を worker に渡す方式を採用した。
- Lambda Durable Functions は steps / waits の候補として整理したが、現行 CDK 構成と既存 Step Functions 運用資産を活かすため、今回は Step Functions + worker Lambda + DynamoDB run/event store で実装した。
- run/event に full manifest を保存すると DynamoDB item size リスクがあるため、run には UI が必要な manifest summary だけを保存する方針にした。

## 4. 実施した作業

- `POST /document-ingest-runs`、`GET /document-ingest-runs/{runId}`、`GET /document-ingest-runs/{runId}/events` を追加した。
- document ingest run store / event store の local / DynamoDB 実装を追加した。
- document ingest worker と mark-failed worker を追加し、Step Functions の catch で timeout などの worker 失敗を failed run に反映するようにした。
- Web のファイルアップロードを同期 `/documents/uploads/{uploadId}/ingest` から非同期 `document-ingest-runs` 開始 + 状態取得へ切り替えた。
- README、API examples、Operations に非同期 ingest と Durable Functions の位置付けを追記した。
- API / Web / Infra のテストと snapshot を更新した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/app.ts` ほか | TypeScript | 非同期 ingest run API と認可境界 | timeout 回避導線 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | CDK | worker Lambda、DynamoDB、Step Functions | serverless 構成維持 |
| `memorag-bedrock-mvp/apps/web/src/features/documents/api/documentsApi.ts` | TypeScript | UI upload の非同期 ingest 化 | 通常導線の timeout 回避 |
| `memorag-bedrock-mvp/docs/API_EXAMPLES.md` ほか | Markdown | API 例と運用方針 | docs 更新 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4.5/5 | 非同期化は実装済み。Durable Functions は採用判断を明記し、今回は既存 Step Functions を優先した。 |
| 制約遵守 | 4.5/5 | worktree/task/docs/test/report を実施。task ファイル作成時に一度 shell 書き込みを使った点は手順上の軽微な逸脱。 |
| 成果物品質 | 4.5/5 | owner 境界、run failed handling、manifest summary 化を含めた。 |
| 説明責任 | 5/5 | 採用しなかった Durable Functions の理由と残リスクを記載した。 |
| 検収容易性 | 5/5 | API、UI、infra、docs、tests の変更範囲を分けた。 |

総合fit: 4.6 / 5.0（約92%）

## 7. 検証

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `git diff --check`: pass

## 8. 未対応・制約・リスク

- Lambda Durable Functions への実移行は未実施。現時点では Step Functions を維持し、Durable Functions は worker Lambda 置換候補として扱う。
- `npm ci` 時に 1 件の moderate vulnerability が報告されたが、今回の変更範囲外のため未対応。
- benchmark seed runner は既存同期 ingest API のまま。必要なら別タスクで `purpose=benchmarkSeed` の非同期 ingest run へ移行する。

## 9. CI 追補対応

- CI で `npm exec -w @memorag-mvp/web -- vitest run --coverage` が branch coverage 84.79% で失敗した。
- 原因は今回追加した `documentsApi.ts` の非同期 ingest run polling / failed / cancelled 分岐が未カバーだったこと。
- `apps/web/src/api.test.ts` に polling 成功、failed run、cancelled run の API client test を追加した。
- 追補検証:
  - `npm exec -w @memorag-mvp/web -- vitest run src/api.test.ts`: pass
  - `npm exec -w @memorag-mvp/web -- vitest run --coverage`: pass（C0 statements 91.92%、C1 branches 85.16%）
