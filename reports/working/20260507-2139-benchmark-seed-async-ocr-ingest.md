# 作業完了レポート

保存先: `reports/working/20260507-2139-benchmark-seed-async-ocr-ingest.md`

## 1. 受けた指示

- 主な依頼: `tasks/todo/20260507-2115-benchmark-seed-async-ocr-ingest.md` の内容を実装する。
- 成果物: benchmark seed PDF ingestion の async run 化、認可境界、テスト、ドキュメント、task/PR workflow。
- 条件: `Worktree Task PR Flow` に従い、検証してから commit / push / PR / PR コメントまで行う。

## 2. 要件整理

| 要件ID | 指示・要件 | 対応状況 |
|---|---|---|
| R1 | `purpose=benchmarkSeed` upload session から `document-ingest-runs` を開始できる | 対応 |
| R2 | `BENCHMARK_RUNNER` が隔離 metadata を維持して async ingest run を開始できる | 対応 |
| R3 | runner が完了 manifest と active chunk を確認してから評価へ進む | 対応 |
| R4 | OCR timeout / 抽出不能 / その他 failure を skip/fatal に分類する | 対応 |
| R5 | run polling / event 取得の認可境界を越えない | 対応 |
| R6 | API route と access-control policy test を更新する | 対応 |
| R7 | benchmark corpus seed test に success / OCR timeout skip / fatal error を追加する | 対応 |
| R8 | README、LOCAL_VERIFICATION、OPERATIONS に async ingest 手順を記載する | 対応 |

## 3. 検討・判断したこと

- PDF seed は upload session 転送後に `POST /document-ingest-runs` を開始し、`GET /document-ingest-runs/{runId}` polling で `succeeded` manifest を待つ方式にした。
- `BENCHMARK_RUNNER` は `chat:read:own` を持たないため、通常 owner/admin 読み取りとは別に、同一 runner が作成した `purpose=benchmarkSeed` かつ隔離 metadata を満たす run のみ読める認可分岐を追加した。
- async run の `failed` は既存の `unextractableCorpusSkipReason` に接続し、抽出不能と Textract OCR timeout は `skipped_unextractable`、その他 worker failure は runner fatal とした。
- runner 側 timeout は環境変数で調整可能にした。polling timeout 自体は OCR timeout と断定せず runner fatal とした。
- docs は挙動・API・運用手順が変わるため、README、API examples、LOCAL_VERIFICATION、OPERATIONS、API design を更新した。

## 4. 実施した作業

- `tasks/todo/...` を `tasks/do/...` に移動し、状態を `in_progress` に更新。
- `memorag-bedrock-mvp/benchmark/corpus.ts` で PDF seed を async ingest run 起動 + polling に変更。
- `BENCHMARK_INGEST_RUN_POLL_INTERVAL_MS` と `BENCHMARK_INGEST_RUN_TIMEOUT_MS` の環境変数 helper を追加。
- `memorag-bedrock-mvp/apps/api/src/app.ts` で benchmark seed run の読み取り認可を追加。
- `access-control-policy.test.ts` と API contract test を更新。
- benchmark corpus / runner tests を async run contract に合わせて更新。
- README、API examples、LOCAL_VERIFICATION、OPERATIONS、API design docs を更新。

## 5. 成果物

| 成果物 | 内容 |
|---|---|
| `memorag-bedrock-mvp/benchmark/corpus.ts` | PDF seed async ingest run polling 実装 |
| `memorag-bedrock-mvp/apps/api/src/app.ts` | benchmark seed run 読み取り認可 |
| `memorag-bedrock-mvp/benchmark/*.test.ts` | async success / OCR timeout skip / fatal failure の回帰テスト |
| `memorag-bedrock-mvp/apps/api/src/**/*test.ts` | route policy / contract の認可テスト |
| `memorag-bedrock-mvp/README.md`、`memorag-bedrock-mvp/docs/*` | async seed 手順と権限境界の説明 |

## 6. 検証

- `npm ci`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `git diff --check`: pass
- `task docs:check:changed`: 未実施。Taskfile に該当 task が存在しなかったため。

## 7. 指示への fit 評価

総合fit: 4.8 / 5.0（約96%）

主要な受け入れ条件は実装・テスト・docs まで対応した。AWS 実環境での `mmrag-docqa-v1` CodeBuild run は環境依存のため未実施であり、その分だけ満点ではない。

## 8. 未対応・制約・リスク

- AWS 環境での全量 `mmrag-docqa-v1` CodeBuild 再実行は未実施。
- `task docs:check:changed` はこの worktree の Taskfile に存在せず実行できなかった。
- polling timeout の既定値は 30 分。大規模 PDF corpus で不足する場合は `BENCHMARK_INGEST_RUN_TIMEOUT_MS` で運用調整する。
