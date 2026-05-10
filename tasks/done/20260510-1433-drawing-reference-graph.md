# 建築図面の部屋・記号・寸法・詳細参照グラフを作る

保存先: `tasks/done/20260510-1433-drawing-reference-graph.md`

状態: done

タスク種別: 機能追加

## 作業チェックリスト

- [x] 既存の図面 metadata / region index / graph metric 実装を確認する。
- [x] 最小 `drawingReferenceGraph` schema を追加する。
- [x] detail / section / callout QA から node / edge / target を生成する。
- [x] dataset row に `expectedGraphResolutions` を付与し、benchmark metric に接続する。
- [x] docs、test、作業レポートを更新し、PR コメントまで完了する。

PR: https://github.com/tsuji-tomonori/rag-assist/pull/261

## Done 条件

- corpus metadata に detail / section / callout の source / target bbox を含む graph artifact が出力される。
- cross-reference 系 QA row が `expectedGraphResolutions` を持つ。
- source hierarchy と根拠不足時の abstention 方針を docs に明記する。
- benchmark workspace の unit test / typecheck と `git diff --check` が通る。

## 背景

空間関係、隣接、詳細図参照、断面参照、標準図との整合確認は、単純なチャンク検索や VLM の直接推論では安定しない。room、symbol、dimension、detail、callout の関係を graph として扱う必要がある。

## 目的

`page`、`region`、`room`、`symbol`、`text`、`dimension`、`detail`、`section` の node と、`contains`、`near`、`points_to`、`references`、`same_as`、`connected_to` の edge を保持し、cross-sheet QA と空間 QA の根拠にする。

## 対象範囲

- extraction artifacts
- graph schema / storage
- retrieval / graph lookup tools
- benchmark graph metrics
- docs / tests

## 方針

最初から完全な CAD graph を目指さず、詳細図参照、断面参照、room label、symbol、dimension の bbox 関係を優先する。source hierarchy は graph lookup の後段で適用し、案件図面を標準図より優先する。

## 必要情報

- titleblock / region index task の成果
- symbol detector task の成果
- dimension normalizer task の成果
- 既存 graph / structured fact 検討 task

## 実行計画

1. 最小 graph schema と artifact 保存方式を決める。
2. detail_index、callout_edges、conflicts のテーブルまたは JSON schema を追加する。
3. graph lookup を query classification から呼び出せるようにする。
4. graph_resolution_accuracy を benchmark に追加する。
5. cross-sheet / detail-reference QA の regression test を作る。

## ドキュメントメンテナンス計画

graph schema、source hierarchy、cross-sheet reasoning、benchmark metric、debug trace を設計 docs と運用 docs に反映する。

## 受け入れ条件

- [x] AC1: detail / section / callout の source bbox と target bbox を保持できる。
- [x] AC2: graph lookup が少なくとも detail reference QA に利用される。
- [x] AC3: source hierarchy により案件図面と標準図の矛盾時に案件図面が優先される。
- [x] AC4: graph の根拠がない場合は推測回答を出さない。

## 検証結果

- `npm run test --workspace @memorag-mvp/benchmark`: pass
- `npm run typecheck --workspace @memorag-mvp/benchmark`: pass
- `npm run test --workspace @memorag-mvp/api`: pass
- `npm run typecheck --workspace @memorag-mvp/api`: pass
- `npm run lint`: pass
- `git diff --check`: pass
- `npm run docs:check --workspace @memorag-mvp/api`: script 未定義のため未実施
- `npm ci`: pass。ただし既存依存関係で 3 vulnerabilities (1 moderate, 2 high) が報告された。

## 検証計画

- graph schema unit test
- callout edge fixture test
- architecture-drawing-qarag cross-reference sample
- `git diff --check`

## PRレビュー観点

- graph edge の confidence と根拠 bbox が trace に残るか。
- source hierarchy が検索 score 任せになっていないか。
- graph が benchmark 固有データに閉じた実装になっていないか。

## 未決事項・リスク

- 決定事項: 初期 graph は detail / callout / room label 周辺を優先し、完全な壁線・経路推論は後続に分ける。
- リスク: 低品質 OCR / 検出器 output に依存すると graph edge の誤りが回答へ伝播する。
