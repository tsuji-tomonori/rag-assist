# 日本語公開PDF QA benchmark corpus seed自動化

## 背景

`jp-public-pdf-qa-v1` はUIからrun起動できるが、対象PDF/OCR corpusの準備は未対応であり、品質評価としては実行前に手作業のcorpus seedが必要な状態である。

## 目的

`jp-public-pdf-qa-v1` のCodeBuild runnerが、datasetと合わせて実PDF/OCR corpusを自動準備し、既存 `seedBenchmarkCorpus` に渡せるようにする。

## スコープ

- `prepare:jp-public-pdf-qa` scriptを追加する。
- 厚労省PDF、統計百五十年史PDFを公開URLからcorpus dirへダウンロードする。
- d-infraの対象JPEGをダウンロードし、複数ページPDFとしてOCR投入用corpusに組み立てる。
- CodeBuild runnerの `jp-public-pdf-qa-v1` 分岐でprepare scriptを呼び、`BENCHMARK_CORPUS_DIR` を設定する。
- 変換・ダウンロード・runner分岐のテストを追加する。

## スコープ外

- d-infra全738表・全772ページの完全PDF化。
- 実AWS環境でのフルbenchmark run。
- OCR精度改善や表抽出アルゴリズム変更。

## 受け入れ条件

- [x] `npm run prepare:jp-public-pdf-qa -w @memorag-mvp/benchmark` がdatasetとcorpus dirを生成できる。
- [x] corpus dirに `001655176.pdf`, `01zyokan_202603.pdf`, `1927-statistical-yearbook-scan.pdf` が生成される。
- [x] OCR用PDFはd-infraの対象JPEGを埋め込んだ複数ページPDFとして生成される。
- [x] CodeBuild runnerの `jp-public-pdf-qa-v1` 分岐がprepare scriptを呼び、`BENCHMARK_CORPUS_DIR` と `BENCHMARK_CORPUS_SUITE_ID` を設定する。
- [x] ネットワーク失敗時に対象URLを含むエラーを返す。
- [x] 変更範囲に見合う検証がpassしている。

## 検証計画

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`

## 状態

done

## 実施結果

- `memorag-bedrock-mvp/benchmark/jp-public-pdf-qa.ts` を追加し、dataset copy、2件のテキスト抽出可能PDF取得、d-infra JPEG 26ページからのOCR投入用PDF生成を実装した。
- `memorag-bedrock-mvp/benchmark/package.json` に `prepare:jp-public-pdf-qa` を追加した。
- CodeBuild runnerの `jp-public-pdf-qa-v1` 分岐をprepare script実行に切り替え、`BENCHMARK_CORPUS_DIR` と `BENCHMARK_CORPUS_SUITE_ID` を設定するようにした。
- 実URL取得を `/tmp/jp-public-pdf-qa-seed` 出力で確認し、3件のcorpus file生成を確認した。

## 検証結果

- `git diff --check`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `JP_PUBLIC_PDF_QA_DATASET_OUTPUT=/tmp/jp-public-pdf-qa-seed/dataset.jsonl JP_PUBLIC_PDF_QA_CORPUS_DIR=/tmp/jp-public-pdf-qa-seed/corpus JP_PUBLIC_PDF_QA_FORCE_DOWNLOAD=1 npm --prefix memorag-bedrock-mvp run prepare:jp-public-pdf-qa -w @memorag-mvp/benchmark`: pass
