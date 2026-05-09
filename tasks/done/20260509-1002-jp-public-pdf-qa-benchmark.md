# 日本語公開PDF QA benchmark dataset

## 背景

ユーザーが作成した `jp_public_pdf_qarag_benchmark.xlsx` には、日本語の公開PDF・スキャン画像資料を対象にした QA benchmark 候補が含まれている。既存の `memorag-bedrock-mvp/benchmark` runner で扱える評価データとして取り込む。

## 目的

Excel の `QA_Benchmark` を既存 runner の JSONL schema に変換し、RAG 評価で実行できる dataset として利用可能にする。

## スコープ

- Excel のシート構成と QA 件数を確認する。
- 既存 benchmark runner の dataset schema に合わせた JSONL を追加する。
- dataset の必須項目、件数、metadata、期待語句を検証する。
- 必要に応じて変換・検証スクリプトまたはテストを追加する。
- 作業完了レポートを `reports/working/` に残す。

## スコープ外

- 外部PDFのダウンロード、OCR投入、実RAG環境への大容量 corpus ingest。
- 実サービス API を使ったフル benchmark run。
- GitHub PR の merge。

## 計画

1. Excel と既存 benchmark dataset schema を確認する。
2. QA を JSONL に変換し、出典・文書種別・分野を metadata として残す。
3. dataset の構造と件数を検証するテストを追加する。
4. 最小十分な検証を実行する。
5. 作業レポートを作成する。
6. commit / push / PR 作成と、受け入れ条件確認コメントを行う。

## ドキュメント保守方針

挙動変更は benchmark dataset 追加に限定する。既存 API や UI の挙動は変更しない。dataset の利用方法や前提は、必要に応じて benchmark 配下の README または dataset metadata に記録する。

## 受け入れ条件

- [ ] Excel の `QA_Benchmark` から 24 問が JSONL dataset として取り込まれている。
- [ ] 3 分野それぞれ 8 問であることを機械的に検証している。
- [ ] 各行に `id`, `question`, `answerable`, `expectedResponseType`, `expectedContains`, `expectedFiles`, `metadata` が含まれている。
- [ ] 採用文書の出典URL、抽出区分、OCR前提が metadata または関連ファイルから追跡できる。
- [ ] 既存 benchmark runner が dataset を読み込めることを targeted test で確認している。
- [ ] 実施した検証と未実施の検証を作業レポートと最終回答に明記している。

## 検証計画

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`
- 必要に応じて dataset 専用の targeted test

## 実施結果

- `memorag-bedrock-mvp/benchmark/dataset.jp-public-pdf-qa.jsonl` を追加し、Excel の `QA_Benchmark` 24 問を既存 benchmark runner の JSONL schema に変換した。
- `memorag-bedrock-mvp/benchmark/jp-public-pdf-qa.test.ts` を追加し、件数、3 分野 x 8 問、text/OCR区分、必須項目、出典 metadata、OCR前提、runner 読み込みを検証した。

## 実行した検証

- `git diff --check`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass

## 未実施・制約

- 実API・実PDF corpus ingest を伴うフル benchmark run は未実施。対象PDF/スキャン画像の取得とOCR投入が必要なため、今回のローカル検証では既存 runner による dataset 読み込みまでを対象にした。
- `npm ci` 実行時に既存依存の `npm audit` 警告が 3 件表示されたが、今回の変更では依存更新を行っていない。

## PRレビュー観点

- benchmark sample 固有の期待語句をアプリ実装へ混入させていないこと。
- RAG の根拠性・認可境界を弱める変更がないこと。
- 外部資料のURLとOCR前提が、実行データから追跡可能であること。
- 実施していないフル ingest や OCR run を完了扱いしていないこと。

## リスク

- Excel は外部から受け取った調査成果物であり、PDF本文との照合は今回のスコープ外。
- OCR資料は単一PDFではなく、スキャン画像資料をPDF化して投入する前提である。
- フル benchmark 実行には対象 corpus の取得・ingest が必要で、今回のローカル検証では runner 読み込みまでを対象にする。

## 状態

done
