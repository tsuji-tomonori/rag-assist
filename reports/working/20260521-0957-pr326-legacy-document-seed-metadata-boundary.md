# PR326 legacy POST /documents benchmark seed metadata 境界修正 作業レポート

## 受けた指示

- legacy `POST /documents` で benchmark seed 予約 metadata の部分混入や extra key 付き seed 形 metadata を document writer が通せる問題を修正する。
- `authorizeDocumentUpload` 側にも upload session 側と同じ予約 metadata key 拒否を入れる。
- 既存の `document writer cannot bypass group scope with benchmark seed metadata` に、extra key 付き seed metadata と部分的な seed 予約 metadata の 403 テストを追加する。
- 未実施の検証を実施済みとして書かない。

## 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | `POST /documents` で extra key 付き benchmark seed metadata を 403 にする | 対応 |
| R2 | `POST /documents` で部分的な benchmark seed 予約 metadata を 403 にする | 対応 |
| R3 | 403 後に文書一覧へ作成されないことを確認する | 対応 |
| R4 | upload session 側の既存境界を維持する | 対応 |
| R5 | 変更範囲に見合う検証を実行する | 対応 |

## 検討・判断

- 根本原因は、`isBenchmarkSeedUpload` が正当な seed upload の完全形判定であり、通常文書で拒否すべき seed 予約 key の検出としては使えない点と判断した。
- `hasBenchmarkSeedReservedDocumentMetadata` を `metadata?: Record<string, unknown>` を受ける汎用 helper にし、`authorizeDocumentUpload` と `authorizeUploadedDocumentIngest` の両方で利用した。
- 拒否対象は既存の seed 専用 key である `benchmarkSeed`、`benchmarkSuiteId`、`benchmarkSourceHash`、`benchmarkIngestSignature`、`benchmarkCorpusSkipMemory`、`benchmarkEmbeddingModelId` に限定した。
- API shape や利用手順は変えない fail-closed 修正のため、恒久 docs 更新は不要と判断した。

## 実施作業

- `authorizeDocumentUpload` に benchmark seed 予約 metadata key の拒否を追加した。
- 既存の upload session 用予約 metadata helper を direct upload でも使える型へ汎用化した。
- contract test に以下を追加した。
  - seed metadata に `tenantId` extra key を追加した `POST /documents` が 403
  - `metadata: { benchmarkSeed: true }` の `POST /documents` が 403
  - `metadata: { benchmarkSuiteId: "standard-agent-v1" }` の `POST /documents` が 403
- authorization unit assertion に extra key 付き seed metadata と部分 seed metadata の拒否を追加した。
- task md を作成し、RCA、受け入れ条件、検証計画を記録した。

## 成果物

| 成果物 | 内容 |
|---|---|
| `apps/api/src/routes/benchmark-seed.ts` | legacy `POST /documents` の seed 予約 metadata fail-closed guard |
| `apps/api/src/contract/api-contract.test.ts` | extra key 付き・部分 seed 予約 metadata の direct upload 拒否テスト |
| `tasks/do/20260521-0957-pr326-legacy-document-seed-metadata-boundary.md` | 作業 task と受け入れ条件 |
| `reports/working/20260521-0957-pr326-legacy-document-seed-metadata-boundary.md` | 本作業レポート |

## 実行した検証

- `../../node_modules/.bin/tsx --test src/contract/api-contract.test.ts`: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass

## 未対応・制約・リスク

- GitHub Actions の再実行結果は、このレポート作成時点では未確認。push 後に PR checks を確認する。
- 通常文書 metadata に benchmark seed 専用 key を使っていた既存クライアントがある場合は 403 になる。ただし該当 key は benchmark seed 隔離用であり、意図した fail-closed 変更と判断した。

## Fit 評価

総合fit: 4.8 / 5.0（約96%）

理由: 指摘された legacy `POST /documents` の残 blocker を実装修正し、extra key 付き seed metadata と部分 key の両方を contract test / unit assertion で固定した。CI のリモート再実行確認のみ push 後作業として残るため満点ではない。
