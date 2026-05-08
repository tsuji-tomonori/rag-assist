# 作業完了レポート

保存先: `reports/working/20260508-2342-benchmark-upload-content-length-fix.md`

## 1. 受けた指示

- 主な依頼: CodeBuild benchmark の `UND_ERR_REQ_CONTENT_LENGTH_MISMATCH` 失敗について、計画に沿って修正を実施する。
- 成果物: 修正コード、回帰テスト、検証結果、PR。
- 形式・条件: repository local workflow に従い、専用 worktree、task md、検証、commit、push、PR、PR コメントまで進める。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | S3 upload session の `Content-Length` mismatch を解消する | 高 | 対応 |
| R2 | benchmark PDF upload が実サイズと異なる header を送らないようにする | 高 | 対応 |
| R3 | size limit の検証を維持する | 高 | 対応 |
| R4 | 変更範囲に見合うテストを実行する | 高 | 対応 |
| R5 | 実施していない外部 CodeBuild 再実行を実施済み扱いしない | 高 | 対応 |

## 3. 検討・判断したこと

- 失敗箇所は benchmark runner が PDF corpus を upload session へ転送する段階で、Node.js 22 の undici が送信前に `Content-Length` mismatch を検出したものと判断した。
- `S3ObjectStore.createUploadUrl` は `maxBytes` を `ContentLength` として presigned PUT に署名し、返却 headers に `Content-Length` を含めていた。これは最大許容量であり、実アップロードサイズではない。
- `/documents/uploads/{uploadId}/ingest` 側で `getObjectSize()` による `documentUploadMaxBytes` 超過検証が既にあるため、presigned PUT の固定 `Content-Length` は削除し、上限値は upload session response の `maxUploadBytes` と ingest 時検証で扱う方針にした。
- README / docs には `Content-Length` 固定送信を前提にした利用者手順がなかったため、ドキュメント更新は不要と判断した。

## 4. 実施した作業

- `memorag-bedrock-mvp/apps/api/src/adapters/s3-object-store.ts` から、presigned PUT の `ContentLength` 指定と返却 `headers.Content-Length` を削除した。
- `memorag-bedrock-mvp/apps/api/src/adapters/s3-object-store.test.ts` を追加し、`maxBytes` 指定時も返却 headers と署名対象に `Content-Length` が含まれないことを確認した。
- 専用 task md を `tasks/do/` に作成し、受け入れ条件と検証計画を記録した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/adapters/s3-object-store.ts` | TypeScript | S3 upload URL が固定 `Content-Length` を要求しないよう修正 | R1, R2 |
| `memorag-bedrock-mvp/apps/api/src/adapters/s3-object-store.test.ts` | TypeScript test | 回帰テスト追加 | R1, R4 |
| `tasks/do/20260508-2339-fix-benchmark-upload-content-length.md` | Markdown | task md と受け入れ条件 | workflow |

## 6. 実行した検証

- `npm ci`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `git diff --check`: pass

## 7. 指示へのfit評価

総合fit: 4.7 / 5.0（約94%）

理由: CodeBuild 失敗原因に対応する最小修正と回帰テスト、対象検証を実施した。実 AWS CodeBuild の再実行はこの作業内では未実施のため満点ではない。

## 8. 未対応・制約・リスク

- 未対応: CodeBuild benchmark run の再試行は未実施。
- 制約: 実 AWS 環境での presigned PUT と benchmark 全量実行は CI / AWS 権限に依存する。
- リスク: S3 upload 時点での固定サイズ署名は使わず、既存の ingest 時 object size 検証に依存する。ただし `maxUploadBytes` は API response に残る。
