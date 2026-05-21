# PR326 upload session benchmark seed 境界修正 作業レポート

## 受けた指示

- PR #326 の再レビュー結果に基づき、upload session 経由の `purpose=document` ingest で benchmark seed metadata を混ぜられる経路を塞ぐ。
- 同期 `/documents/uploads/{uploadId}/ingest` と非同期 `/document-ingest-runs` の単体または contract test を追加する。
- benchmarkSeed upload session の許可ケースも固定する。
- 未実施の検証を実施済みとして書かない。

## 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | document upload session で benchmark seed 形 metadata を 403 にする | 対応 |
| R2 | document ingest run で benchmark seed 形 metadata を 403 にする | 対応 |
| R3 | benchmarkSeed upload session の許可ケースを維持する | 対応 |
| R4 | route/unit test で境界を固定する | 対応 |
| R5 | 変更範囲に見合う検証を実行する | 対応 |

## 検討・判断

- 根本原因は、legacy `POST /documents` では seed body 判定が入った一方で、uploaded object ingest の `purpose=document` 経路では body metadata の seed 判定がなく、`rag:doc:write:group` のみで許可されていた点と判断した。
- 完全な seed shape だけでなく、`benchmarkSeed`、`benchmarkSuiteId`、`benchmarkSourceHash`、`benchmarkIngestSignature`、`benchmarkCorpusSkipMemory`、`benchmarkEmbeddingModelId` を document purpose では予約 key として拒否した。
- `aclGroups`、`docType`、`lifecycleStatus`、`source` は一般 metadata と衝突しやすいため、今回の拒否対象は benchmark seed 専用 key に絞った。
- API shape や利用手順は変わらないため、恒久 docs の更新は不要と判断した。

## 実施作業

- `authorizeUploadedDocumentIngest` に document purpose での benchmark seed 予約 metadata 拒否を追加した。
- `api-contract.test.ts` の既存回帰テストに、document upload session の同期 ingest 403 と非同期 ingest run 403 を追加した。
- 403 後に `/documents` が空であること、非同期 run のローカル永続化ファイルが作られないことを確認する assertion を追加した。
- authorization unit test に benchmarkSeed 許可ケースと document purpose 拒否ケースを追加した。
- 作業 task md を `tasks/do/` に作成し、受け入れ条件と RCA を記録した。

## 成果物

| 成果物 | 内容 |
|---|---|
| `apps/api/src/routes/benchmark-seed.ts` | document purpose で seed 予約 metadata を 403 にする権限境界 |
| `apps/api/src/contract/api-contract.test.ts` | 同期/非同期 upload session の seed metadata 混入回帰テスト |
| `tasks/do/20260521-0848-pr326-upload-session-benchmark-seed-boundary.md` | 作業 task と受け入れ条件 |
| `reports/working/20260521-0851-pr326-upload-session-benchmark-seed-boundary.md` | 本作業レポート |

## 実行した検証

- `../../node_modules/.bin/tsx --test src/contract/api-contract.test.ts`: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass

## 未対応・制約・リスク

- GitHub Actions の再実行結果は、このレポート作成時点では未確認。push 後に PR checks を確認する。
- document purpose で benchmark seed 専用 key を使っていた既存クライアントがある場合は 403 になる。ただし該当 key は benchmark seed 隔離用として扱うべきため、意図した境界変更と判断した。

## Fit 評価

総合fit: 4.8 / 5.0（約96%）

理由: 指摘された同期/非同期 upload session 境界を実装修正し、route contract と unit assertion で固定した。CI のリモート再実行確認のみ push 後作業として残るため満点ではない。
