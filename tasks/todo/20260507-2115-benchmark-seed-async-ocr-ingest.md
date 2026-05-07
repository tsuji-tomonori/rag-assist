# benchmark seed OCR 非同期 ingest 化

状態: todo

## 背景

PR #159 では、MMRAG DocQA benchmark seed 中に Textract OCR fallback が同期 ingestion の待機時間内に完了しない場合、runner 全体を fatal にせず `skipped_unextractable` / `ocr_timeout` として扱う暫定的な運用修正を行った。

PR #160 では、通常の文書取り込み導線を `POST /document-ingest-runs`、Step Functions、worker Lambda、DynamoDB run/event store による非同期 run として分離している。ただし PR #160 本文では、benchmark seed runner は既存同期 ingest API のままであり、必要なら別タスクで `purpose=benchmarkSeed` の非同期 run 化を行う、と整理されている。

## 目的

Textract OCR fallback の完了待ちを同期 API timeout から切り離し、MMRAG DocQA や PDF-heavy benchmark corpus seed が OCR 処理時間だけで runner fatal または過剰 skip にならないようにする。

## 方針

PR #160 の `document-ingest-runs` contract を benchmark seed に拡張する。通常利用者向け upload と同じ async run 基盤を再利用し、benchmark runner は `/documents/uploads/{uploadId}/ingest` の同期呼び出しではなく、`POST /document-ingest-runs` で run を開始して完了まで polling または event 取得する。

## 受け入れ条件

- `purpose=benchmarkSeed` の upload session から `document-ingest-runs` を開始できる。
- `BENCHMARK_RUNNER` は benchmark seed metadata の隔離条件を維持したまま async ingest run を開始できる。
- benchmark runner は async ingest run の完了 manifest を待ち、`active` chunk が作成されたことを確認してから評価 query / search に進む。
- async ingest run が OCR timeout、抽出不能、worker failure になった場合、原因別に `skipped_unextractable` または runner fatal を判断できる。
- run polling / event 取得は owner または benchmark runner 権限境界を越えない。
- API route と access-control policy test が更新されている。
- benchmark corpus seed test に async ingest success、OCR timeout skip、non-extractability以外の fatal error のケースが追加されている。
- README、LOCAL_VERIFICATION、OPERATIONS に benchmark seed の async ingest 手順と残る fallback 条件が記載されている。

## 実装計画

1. PR #160 の `StartDocumentIngestRunRequestSchema`、`MemoRagService.startDocumentIngestRun`、worker Lambda contract を確認する。
2. `authorizeUploadedDocumentIngest` / `authorizeDocumentUploadSession` が `benchmarkSeed` purpose と `BENCHMARK_RUNNER` に対して async run 開始を許可しているか確認し、不足があれば route-level permission を追加する。
3. benchmark runner の `uploadDocumentFromUploadSession` を async ingest run 開始 + status polling へ切り替える。同期 endpoint は後方互換 fallback として残すか、env flag で選択可能にする。
4. async run failure の error message を `unextractableCorpusSkipReason` に接続し、`ocr_timeout` とそれ以外の infrastructure failure を区別する。
5. API / benchmark / infra の targeted tests を更新する。
6. CodeBuild runner の timeout、poll interval、最大待機時間を設定化し、レポートに run id と error reason を残す。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`
- infra/CDK 変更がある場合は `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`
- 可能なら AWS 環境で `mmrag-docqa-v1` の CodeBuild run を再実行する。

## リスク

- PR #160 の async ingest 基盤が main に入る前に着手すると、大きな merge conflict が起きる。
- benchmark seed は service user 権限で動くため、通常利用者向け owner 境界と同じ扱いにすると run 取得・events 取得が失敗する可能性がある。
- OCR の長時間化を全て待つと CodeBuild 全体 timeout やコスト増につながるため、suite 別 timeout と skip policy を明確にする必要がある。
