# 作業完了レポート: 日本語公開PDF QA benchmark UI実行対応

## 指示

- 「UIから実行できる?」への回答後、ユーザーの「対応して」という意図として、UIから実行できるよう追加対応する。

## 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | benchmark suite一覧に `jp-public-pdf-qa-v1` を追加する | 対応 |
| R2 | UIから選択して非同期runを起動できるようにする | 対応 |
| R3 | CodeBuild runnerがrepo内datasetを利用できるようにする | 対応 |
| R4 | 対象PDF/OCR corpus自動投入は未対応として明記する | 対応 |
| R5 | 変更範囲に見合う検証を実行する | 対応 |

## 検討・判断の要約

- UIは `/benchmark-suites` の戻り値をそのまま選択肢にするため、APIの `benchmarkSuites` へsuiteを登録する方針にした。
- 既存のCodeBuild runnerは特殊suite以外をS3 datasetとして扱うため、`jp-public-pdf-qa-v1` は repo 内 JSONL を `$DATASET` へコピーする分岐を追加した。
- PDF/OCR corpusの自動取得・OCR投入は大きな別作業になるため、今回の追加は「UIからrunを起動できる」範囲に限定した。

## 実施作業

- `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts` に `jp-public-pdf-qa-v1` suite を追加した。
- `memorag-bedrock-mvp/apps/api/src/routes/benchmark-seed.ts` の許可suiteへ `jp-public-pdf-qa-v1` を追加した。
- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` のCodeBuild pre_buildに dataset copy 分岐を追加した。
- API / Web hook / Infra test と snapshot を更新した。

## 成果物

| 成果物 | 内容 |
|---|---|
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts` | UI/APIに表示されるbenchmark suite追加 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | CodeBuild runnerのdataset解決追加 |
| `memorag-bedrock-mvp/apps/web/src/features/benchmark/hooks/useBenchmarkRuns.test.ts` | UI選択からrun起動へsuite IDが渡ることを検証 |
| `memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json` | buildspec変更に合わせたsnapshot更新 |

## 実行した検証

- `git diff --check`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- useBenchmarkRuns`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass

## 未対応・制約・リスク

- 実PDF/OCR corpus seed の自動化は未対応。UIからrunは起動できるが、品質評価として成功させるには対象PDF・スキャン画像の取得、OCR、benchmark corpus seed の追加が必要。
- Web全体テストは未実施。変更は hook のsuite選択とAPI/infra suite定義に限定されるため、`useBenchmarkRuns` の targeted test を実行した。
- API route追加ではないため `access-control-policy.test.ts` のroute定義更新は不要。benchmark seed metadataの許可suiteのみ追加した。

## Fit評価

総合fit: 4.4 / 5.0（約88%）

理由: UIからsuiteを選択し、CodeBuild runを起動する経路は追加・検証した。一方で、実PDF/OCR corpus自動投入は別作業として残るため、フル評価成功までは未完了。
