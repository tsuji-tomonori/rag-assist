# 建築図面の寸法・口径・延長正規化

## 受けた指示

- マージ済みの前タスク後、次の改善を一つ進める。
- 先行ロードマップのうち、寸法・口径・延長の正規化を benchmark 評価へ接続する。

## 要件整理

- scale、dimension、diameter、length、range を deterministic parser で canonical value に変換する。
- `expectedContains` の既存採点を壊さず、図面値の正規化一致を追加評価する。
- architecture drawing QARAG の dataset row に正規化期待値を持てるようにする。
- docs と task md に検証結果を残す。

## 実施作業

- `benchmark/metrics/drawing-normalization.ts` を追加し、縮尺、寸法、口径、延長、範囲条件の正規化と比較処理を実装した。
- レビュー指摘を受け、範囲条件の巨大な個別 regex を廃止し、数値 token、単位 token、operator lexicon の近接関係から range を組み立てる実装に変更した。
- `benchmark/run.ts` に `expectedNormalizedValues`、`normalized_answer_accuracy`、`normalized_answer_mismatch` を追加した。
- `architecture-drawing-qarag.ts` で seed QA の内容から正規化期待値を生成し、dataset row に出力できるようにした。
- `run.test.ts` と `drawing-normalization.test.ts` に、正常一致、不一致、通常 `expectedContains` 併用の regression test を追加した。
- README と OPERATIONS に図面値正規化評価の仕様を追記した。

## 成果物

- `memorag-bedrock-mvp/benchmark/metrics/drawing-normalization.ts`
- `memorag-bedrock-mvp/benchmark/run.ts`
- `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag.ts`
- `memorag-bedrock-mvp/docs/OPERATIONS.md`
- `memorag-bedrock-mvp/README.md`

## 検証

- `npm run test --workspace @memorag-mvp/benchmark`: pass
- `npm run typecheck --workspace @memorag-mvp/benchmark`: pass
- `git diff --check`: pass

## Fit 評価

- 受け入れ条件 AC1 から AC4 は満たした。
- 正規化不一致は `answerCorrect` を false にし、failure reason に `normalized_answer_mismatch` を残すため、根拠値と回答値の不一致を検出できる。
- 汎用 RAG 行は `expectedNormalizedValues` がない限り評価対象外で、既存 `expectedContains` の分母と判定は維持される。

## 未対応・制約・リスク

- OCR が数値自体を誤読した場合は、この正規化だけでは救えない。
- bbox / crop の実測座標抽出は未実装で、後続の図面領域検出 task の対象。
- `npm ci` で既存依存に 3 件の audit 指摘が出たが、本タスクでは依存更新を行っていない。
