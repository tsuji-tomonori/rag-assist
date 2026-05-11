# 建築図面の OCR / VLM-OCR 抽出パイプラインを局所化する

保存先: `tasks/done/20260510-1433-drawing-ocr-vlm-extraction-pipeline.md`

状態: done

タスク種別: 機能追加

## 作業チェックリスト

- [x] 既存の PDF/Textract 抽出、region index、dimension normalizer、benchmark metadata の接続点を確認する。
- [x] 局所抽出 artifact schema と fallback order を追加する。
- [x] crop region 単位で呼べる OCR/VLM-OCR adapter を fixture/mock で実装する。
- [x] titleblock / legend / dimension QA が共通 artifact を参照できるよう benchmark 出力へ接続する。
- [x] docs、test、作業レポートを更新し、PR コメントまで完了する。

## Done 条件

- extraction result に `sourceMethod`、`bbox`、`confidence`、`parserVersion`、raw text / normalized value lineage が残る。
- crop region 単位の OCR/VLM-OCR adapter を mock/fixture で呼べる。
- OCR/VLM-OCR が使えない場合に架空値で埋めず、`failureReason` が残る。
- titleblock / legend / dimension extraction が同じ artifact を利用できる。
- benchmark/API 影響範囲の targeted test、typecheck、lint、`git diff --check` が通る。

## 背景

図面全体を VLM に読ませると、誤読、コスト、latency が増える。タイトル欄、凡例、寸法、注記、表などは、領域を絞って OCR / VLM-OCR を適用する方が安定する。

## 目的

region index と連携し、PDF text、OCR、VLM-OCR を段階的に使う局所抽出 pipeline を整備する。

## 対象範囲

- PDF text extraction
- OCR / Textract fallback
- optional VLM-OCR adapter
- extraction artifact schema
- docs / tests

## 方針

PDF text を第一候補、OCR を第二候補、VLM-OCR を最後の fallback とする。VLM-OCR は page 全体ではなく crop region に限定し、抽出値には source method、bbox、confidence、parser version を残す。

## 必要情報

- 現行 PDF / Textract ingestion 経路
- region index task の成果
- model / OCR provider の利用可否とコスト

## 実行計画

1. 抽出対象 region type と fallback order を定義する。
2. extraction artifact に source method と confidence を追加する。
3. crop region 単位で OCR / VLM-OCR を実行する adapter を追加する。
4. titleblock / legend / dimension normalizer へ抽出結果を渡す。
5. latency / cost / failure reason を benchmark trace に残す。

## ドキュメントメンテナンス計画

OCR / VLM-OCR の利用条件、環境変数、コスト、fallback order、失敗時の扱いを docs と PR 本文に記載する。

## 受け入れ条件

- [x] AC1: extraction result に source method、bbox、confidence、parser version が残る。
- [x] AC2: crop region 単位の OCR / VLM-OCR を呼べる。
- [x] AC3: VLM-OCR が使えない場合に架空値で埋めず、failure reason が残る。
- [x] AC4: titleblock / legend / dimension extraction が同じ artifact を利用できる。

## 検証計画

- extraction adapter unit test
- fixture crop OCR test
- benchmark sample
- `git diff --check`

## 検証結果

- `npm ci`: pass。既存依存関係に 3 vulnerabilities が報告されたが、このタスクでは依存追加なし。
- `npm run test --workspace @memorag-mvp/benchmark`: pass。
- `npm run typecheck --workspace @memorag-mvp/benchmark`: pass。
- `npm run test --workspace @memorag-mvp/api`: pass。
- `npm run typecheck --workspace @memorag-mvp/api`: pass。
- `npm run lint`: pass。
- `npm run docs:openapi:check`: pass。
- `git diff --check`: pass。

## PR

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/265
- 受け入れ条件確認コメント: 投稿済み。
- セルフレビューコメント: 投稿済み。

## PRレビュー観点

- VLM-OCR が page 全体の高コスト fallback になっていないか。
- 抽出失敗時に本番 UI / API が demo 値を返していないか。
- raw text と normalized value の lineage が追跡できるか。

## 未決事項・リスク

- 決定事項: VLM-OCR は最後の fallback とし、局所 crop に限定する。
- リスク: 外部 OCR / VLM provider に依存する場合、CI では mock / fixture 検証が中心になる。
