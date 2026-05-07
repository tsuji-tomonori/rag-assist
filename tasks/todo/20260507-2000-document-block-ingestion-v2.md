# DocumentBlock による構造化 ingestion v2

保存先: `tasks/todo/20260507-2000-document-block-ingestion-v2.md`

## 状態

- todo

## 背景

neoAI Chat から最初に取り入れる価値が高い差分は、チャット UI やモデル追加ではなく、複雑な日本企業文書、表、OCR、画像内テキスト、脚注、注記、別紙、規程文書を RAG に載せる前処理である。rag-assist は RAG runtime、guard、citation validation、benchmark の設計が進んでいるため、正しい根拠を検索可能な chunk として残す ingestion layer が品質ボトルネックになりやすい。

## 目的

`DocumentBlock` 中間表現を導入し、PDF / DOCX / Textract / OCR / table / figure 由来の情報を layout-aware、table-aware、citation-aware に chunk 化できる ingestion v2 を作る。

## 対象範囲

- `memorag-bedrock-mvp/apps/api/src/ingest/`
- document parser / chunker / manifest
- Textract JSON parser
- table / figure / caption / note chunker
- citation metadata
- ingestion pipeline tests
- `memorag-bedrock-mvp/docs/` のデータ構造、RAG workflow、運用手順

## 方針

- `DocumentBlock` を parser output の中間表現として追加する。
- block type は `heading`、`paragraph`、`list`、`table`、`table_row`、`figure`、`caption`、`footer`、`note` を基本にする。
- `bbox`、`page`、`sectionPath`、`parentBlockId`、table row / column metadata、confidence、`parserVersion` を optional field として保持する。
- 検索用 chunk と回答引用用 metadata を分離する。
- 表は caption、headers、row text、footnote を検索に含め、引用は page / table / row / column へ戻せるようにする。
- OCR 低信頼領域は回答時に断定しないため、confidence を trace と policy で参照可能にする。
- 既存 manifest / chunk schema は後方互換の fallback を持たせる。

## 必要情報

- 現行 PDF / DOCX / Textract 取り込み実装。
- 既存 pipeline version 管理。
- 関連 task: `tasks/todo/20260507-2000-rag-baseline-evaluation-set.md`
- 関連 task: `tasks/todo/20260507-2000-ingestion-bluegreen-benchmark-gate.md`
- ユーザー前提: neoAI Chat 側の複雑文書対応は前回調査の公開情報ベースであり、今回外部 Web では再確認しない。

## 実行計画

1. 現行 parser / chunker / manifest / citation metadata を棚卸しする。
2. `DocumentBlock` type と versioned schema を追加する。
3. PDF / DOCX / Textract parser の output を `DocumentBlock[]` に変換する adapter を実装する。
4. paragraph、heading、list、note の chunk 生成を `DocumentBlock` 経由へ移行する。
5. table chunker を追加し、headers、row text、merged cell の展開、footnote を検索可能にする。
6. figure / caption / OCR chunk を追加する。
7. citation metadata が page / section / table / row / figure へ戻れることを確認する。
8. confidence と parser / chunker version を manifest と debug trace に残す。
9. 既存 ingestion tests と table / OCR fixture tests を追加する。
10. docs と local verification を更新する。

## ドキュメントメンテナンス計画

- 要求仕様: 文書取り込み、引用、回答不能制御、評価に関係する `FR-*`、`SQ-*`、`NFR-*`、`TC-*` を確認し、必要なら 1 要件 1 ファイル方針で追記する。
- architecture / design: DocumentBlock schema、Ingestion pipeline、Citation metadata、Debug trace、Benchmark Runner の該当 design docs を更新する。
- README / API examples / OpenAPI: public ingest API の request / response が変わる場合のみ更新する。内部 manifest だけなら PR 本文に API docs 不要理由を書く。
- local verification / operations: parserVersion / chunkerVersion の確認、再 ingest、rollback、OCR confidence の扱いを追記する。
- PR 本文: docs 更新箇所、更新不要の判断、未実施の OCR / Textract 実環境検証を明記する。

## 受け入れ条件

- `DocumentBlock` schema が型とテストで定義されている。
- 既存 PDF / DOCX / Textract 取り込みが `DocumentBlock` 経由で chunk を生成できる。
- paragraph / heading / list / note / table / table_row / figure / caption の主要 block type が fixture で検証されている。
- 表 chunk が caption、headers、row text、footnote を含む検索表現を持つ。
- citation metadata から page / section / table / row / figure を識別できる。
- `parserVersion`、`chunkerVersion`、confidence が manifest または debug trace で確認できる。
- OCR 低信頼領域を断定回答に使わない policy hook が存在する。
- 既存 manifest / chunk 形式の runtime fallback が維持されている。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- ingestion fixture tests
- table / OCR fixture tests
- `task benchmark:sample`
- `git diff --check`

## PRレビュー観点

- `blocking`: 既存 indexed document / manifest が読めなくなる破壊的変更がないこと。
- `blocking`: citation が検索 chunk の内部 ID だけでなく、利用者に検証可能な page / section / table / row へ戻れること。
- `blocking`: ACL metadata、raw OCR text、内部 confidence、debug trace が通常利用者へ過剰露出していないこと。
- `should fix`: parserVersion / chunkerVersion が benchmark と debug trace に残ること。
- `should fix`: table fixture が merged cell、row header、footnote を含むこと。
- `question`: OCR engine と Textract JSON の実環境 fixture をどの範囲まで repository に置けるか。

## 未決事項・リスク

- 決定事項: v2 は既存 parser を即時置換せず、versioned schema と fallback で段階移行する。
- 決定事項: `DocumentBlock` は検索用 chunk そのものではなく、複数検索表現と引用 metadata を生成する中間表現とする。
- 実装時確認: Textract / OCR の sample JSON や画像 fixture のライセンス、サイズ、匿名化条件。
- リスク: chunk 数増加により retrieval latency、index size、cost が悪化する可能性がある。
