# 建築図面の寸法・口径・延長を正規化する

保存先: `tasks/done/20260510-1433-drawing-dimension-normalizer.md`

状態: done

## 背景

寸法、口径、延長、範囲条件は LLM の自由生成に任せると誤読と表記揺れが増える。建築図面 QARAG では抽出値、正規化値、根拠 bbox を揃えて評価する必要がある。

## 目的

`1/100`、`S=1/100`、`10000mm`、`10.0 m`、`φ75`、`D75`、`75A`、`L=12.5m` などを canonical value に正規化し、回答生成と benchmark 採点で同じ正規化を使えるようにする。

## 対象範囲

- extraction / computed fact pipeline
- benchmark evaluator
- architecture-drawing-qarag expected value schema
- docs / tests

## 方針

単位付き数値と範囲条件は deterministic parser を優先する。回答時は raw text、normalized value、unit、operator、bbox、confidence を分けて保持し、生成回答と抽出値の不一致を検出する。

## 必要情報

- 現行 benchmark evaluator の expectedContains / fact slot 処理
- 建築図面 QARAG の seed QA 分類
- 日本語単位表記と全角半角の取り扱い

## 実行計画

1. 寸法、縮尺、口径、延長、範囲条件の parser 仕様を決める。
2. expected value と extracted value の双方に同じ normalization を適用する。
3. benchmark summary に normalized_answer_accuracy を追加する。
4. extraction result を computed facts として answer support に渡す。
5. 代表的な表記揺れの unit test を追加する。

## ドキュメントメンテナンス計画

benchmark 指標、computed fact、answer support、図面 QA の表記正規化仕様を docs に追記する。

## 受け入れ条件

- [x] AC1: scale、dimension、diameter、length、range の正規化関数と unit test がある。
- [x] AC2: benchmark evaluator が正規化後一致を評価できる。
- [x] AC3: 抽出値と回答値が正規化後に一致しない場合、unsupported または answerability failure として扱える。
- [x] AC4: 汎用 RAG の expectedContains 採点を破壊しない。

## 検証計画

- normalizer unit test
- benchmark evaluator test
- architecture-drawing-qarag の sample run
- `git diff --check`

## 検証結果

- `npm run test --workspace @memorag-mvp/benchmark`: pass
- `npm run typecheck --workspace @memorag-mvp/benchmark`: pass
- `git diff --check`: pass

## PRレビュー観点

- 正規化が dataset 固有の期待語句に過剰適合していないか。
- raw value と normalized value の両方が trace に残るか。
- 単位変換と範囲演算子の扱いが明示されているか。

## 未決事項・リスク

- 決定事項: 初期 canonical unit は寸法 mm、延長 m、口径は表記 class + numeric value とする。
- リスク: OCR が数値自体を誤読した場合、正規化だけでは救えない。
