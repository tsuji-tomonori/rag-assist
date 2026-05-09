# 日本語公開PDF QA corpus seed自動化 作業完了レポート

## 指示

- `jp-public-pdf-qa-v1` を評価データとしてUIから実行できる形にする流れの続きとして、実PDF/OCR corpus seedを自動化する。
- 既存PRの作業範囲に合わせ、実装、検証、PR更新、受け入れ条件確認まで進める。

## 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | 日本語公開PDF QA datasetをrunner用出力へ生成できる | 対応 |
| R2 | 厚労省PDFと統計百五十年史PDFをcorpus dirへ取得できる | 対応 |
| R3 | d-infra JPEGをOCR投入用PDFへ組み立てられる | 対応 |
| R4 | CodeBuild runnerが `jp-public-pdf-qa-v1` でcorpus seedを使う | 対応 |
| R5 | 失敗時に対象URLが分かる | 対応 |
| R6 | 変更範囲に見合う検証を実行する | 対応 |

## 検討・判断

- 既存のAllganize/MMRAG prepare scriptと同じく、benchmark workspace内にprepare scriptを置き、CodeBuild pre_buildでsuite別に呼び出す構成にした。
- OCR側は元資料が単一PDFではないため、QA根拠に必要なd-infra JPEGページを複数ページPDFへ組み立て、既存のPDF ingest経路に渡せるようにした。
- テストは外部ネットワークに依存しないmock fetchを基本にし、最後に `/tmp` 出力で実URL取得も確認した。
- d-infraの全738表・全772ページの完全PDF化はスコープ外とし、今回のQAで参照するページ集合をseed対象にした。

## 実施作業

- `memorag-bedrock-mvp/benchmark/jp-public-pdf-qa.ts` を追加した。
- `memorag-bedrock-mvp/benchmark/package.json` に `prepare:jp-public-pdf-qa` を追加した。
- `memorag-bedrock-mvp/benchmark/jp-public-pdf-qa.test.ts` にprepare script、OCR PDF builder、失敗時エラーのテストを追加した。
- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` のCodeBuild runner分岐を更新し、`BENCHMARK_CORPUS_DIR` と `BENCHMARK_CORPUS_SUITE_ID` を設定するようにした。
- infra testのBuildSpec期待値とCDK snapshotを更新した。

## 成果物

| 成果物 | 内容 |
|---|---|
| `memorag-bedrock-mvp/benchmark/jp-public-pdf-qa.ts` | dataset/corpus seed prepare script |
| `memorag-bedrock-mvp/benchmark/jp-public-pdf-qa.test.ts` | seed生成と失敗時エラーの回帰テスト |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | CodeBuild runnerの `jp-public-pdf-qa-v1` corpus seed接続 |
| `tasks/do/20260509-1041-jp-public-pdf-qa-corpus-seed.md` | 受け入れ条件と検証結果 |

## 検証

- `git diff --check`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `JP_PUBLIC_PDF_QA_DATASET_OUTPUT=/tmp/jp-public-pdf-qa-seed/dataset.jsonl JP_PUBLIC_PDF_QA_CORPUS_DIR=/tmp/jp-public-pdf-qa-seed/corpus JP_PUBLIC_PDF_QA_FORCE_DOWNLOAD=1 npm --prefix memorag-bedrock-mvp run prepare:jp-public-pdf-qa -w @memorag-mvp/benchmark`: pass

## Fit評価

総合fit: 4.8 / 5.0（約96%）

理由: UI起動時のCodeBuild runnerから実PDF/OCR corpus seedを自動準備する要件を満たし、mock fetchと実URL取得の両方で検証した。d-infra全ページの完全PDF化はスコープ外として残しているため満点ではない。

## 未対応・制約・リスク

- d-infra全738表・全772ページの完全PDF化は未対応。今回のQA根拠に使う26 JPEGページをOCR PDF化した。
- 実AWS CodeBuild上でのフルbenchmark runは未実施。ローカルではprepare scriptとinfra BuildSpec生成を検証済み。
