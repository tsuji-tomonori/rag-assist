# 建築図面の扉・窓・衛生器具・配管記号を検出して数える

保存先: `tasks/todo/20260510-1433-drawing-symbol-detector.md`

状態: todo

## 背景

扉、窓、便器、洗面、弁、桝などの記号カウントは、現行 VLM が苦手な領域である。建築図面 QARAG の count / existence QA は、VLM に数えさせるのではなく検出器の出力を根拠にする必要がある。

## 目的

図面画像をタイル分割し、主要記号カテゴリを bbox + confidence 付きで検出して、count QA の根拠として使えるようにする。

## 対象範囲

- page rendering / tiling pipeline
- detector training / inference adapter
- symbol detection artifact schema
- benchmark evaluator count metrics
- docs / tests

## 方針

初期カテゴリは扉、窓、便器、洗面、流し、階段、EV、配管、弁、桝、管径ラベル、延長ラベル、断面記号、詳細記号、引出線に絞る。タイル境界の重複は NMS で統合し、凡例辞書がある場合は案件内名称に変換する。

## 必要情報

- 学習または few-shot 評価に使える公開図面タイル
- annotation 方針
- detector 実行環境と CI での検証方法
- source_type / bbox / confidence の trace schema

## 実行計画

1. count QA に直結するカテゴリ一覧を確定する。
2. detector artifact schema と benchmark metric `count_mape` を設計する。
3. タイル分割、推論、NMS、page 座標復元を実装する。
4. 少量 annotation または fixture で unit / integration test を追加する。
5. architecture-drawing-qarag の count QA で baseline と比較する。

## ドキュメントメンテナンス計画

detector の対象カテゴリ、学習データ、実行環境、コスト、誤検出リスク、benchmark 指標を docs と PR 本文に記録する。

## 受け入れ条件

- [ ] AC1: 検出結果が `count`、`instances`、`bbox`、`confidence` を持つ。
- [ ] AC2: count QA が detector output を根拠として回答できる。
- [ ] AC3: benchmark summary に count 系の誤差または pass/fail が出る。
- [ ] AC4: detector が利用できない場合、架空の count を返さず未対応または回答不能に落ちる。

## 検証計画

- tiling / NMS unit test
- detector adapter fixture test
- benchmark count QA sample
- `git diff --check`

## PRレビュー観点

- 本番 UI / API で demo fallback や固定 count を返していないか。
- confidence と bbox が根拠として保存されるか。
- benchmark row 固有の分岐を入れていないか。

## 未決事項・リスク

- 決定事項: 初期は少数カテゴリの detector output を RAG の computed fact として扱う。
- リスク: annotation 量が不足すると recall / precision が不安定になり、unsupported answer を増やす可能性がある。
