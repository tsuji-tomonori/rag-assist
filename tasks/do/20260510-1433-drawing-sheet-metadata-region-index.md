# 建築図面のタイトル欄・凡例・領域 index を構造化する

保存先: `tasks/do/20260510-1433-drawing-sheet-metadata-region-index.md`

状態: do

## 背景

建築図面 QARAG では、正しい図面、ページ、領域へ到達できないことが主要な失敗要因になる。図面番号、図面名、縮尺、凡例、注記、表、詳細図領域を通常チャンク検索だけに任せると、根拠到達と bbox 評価が安定しない。

## 目的

PDF / 画像図面からタイトル欄、凡例、表、注記、詳細図などを bbox 付きで抽出し、sheet metadata index と region index として検索可能にする。

## 対象範囲

- `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag-v0.1.json`
- benchmark prepare / ingestion pipeline
- document block schema または metadata schema
- retrieval / rerank / citation evidence pipeline
- 関連 docs

## 方針

PDF ネイティブテキストを優先し、足りない領域は OCR / VLM-OCR 候補で補う。タイトル欄は `drawing_no`、`sheet_title`、`scale`、`revision`、`project_name`、`discipline` を構造化し、凡例は `symbol`、`label`、`description`、`source_page`、`bbox` を保持する。

## 必要情報

- 既存の document block ingestion v2 task: `tasks/todo/20260507-2000-document-block-ingestion-v2.md`
- 建築図面 QARAG JSON 正本: `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag-v0.1.json`
- OCR / Textract fallback の現行仕様

## 実行計画

1. 現行 ingestion artifact が page、bbox、block metadata をどこまで保持できるか確認する。
2. sheet metadata と region metadata の最小 schema を追加する。
3. benchmark prepare または ingestion 時に titleblock / legend / table / note / detail region を登録する。
4. retrieval が metadata / region evidence を候補にできるようにする。
5. answer citation に page + bbox + source_type を返せるようにする。

## ドキュメントメンテナンス計画

schema、ingestion、retrieval、benchmark 出力が変わるため、関連する要求、設計、運用 docs を更新する。docs を更新しない場合は、PR 本文に影響なしの理由を書く。

## 受け入れ条件

- [ ] AC1: titleblock 由来の `drawing_no`、`sheet_title`、`scale` が構造化 metadata として保存される。
- [ ] AC2: legend / table / note / detail region が page + bbox 付きで検索候補になる。
- [ ] AC3: 建築図面 QARAG の titleblock / legend 系 seed QA で根拠 page または bbox を評価できる。
- [ ] AC4: 既存の一般文書 RAG の API 互換性を壊さない。

## 検証計画

- ingestion / retrieval の unit test
- benchmark prepare test
- `task benchmark:sample` または対象 suite の sample run 候補
- `git diff --check`

## PRレビュー観点

- bbox / page / source_type が debug trace と citation に一貫して残るか。
- benchmark 固有の期待語句や QA row id に依存した shortcut を入れていないか。
- 既存 document block ingestion v2 task と責務が衝突していないか。

## 未決事項・リスク

- 決定事項: 初期実装はタイトル欄、凡例、表、注記、詳細図の 5 種を優先する。
- リスク: OCR 品質と PDF レンダリング解像度により bbox 精度が揺らぐ。
