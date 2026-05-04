# PR #96 営業日レビュー指摘対応

## 受けた指示
- PR #96 更新後 head `4b252413...` の再レビュー結果を受け、残っている High correctness issue を修正する。
- 「営業日」を含む文書質問が compute-only の未対応回答で終わらず、RAG 検索へ流れるようにする。
- 併せて、invalid `asOfDate` が silent fallback しないようにする。

## 要件整理
- `営業日` を含むだけでは `canAnswerFromQuestionOnly=true` にしない。
- 営業日計算未対応の computed fact は、明示的な営業日計算依頼に限定する。
- `在宅勤務手当の申請期限は何営業日ですか？` は RAG retrieval を実行し、文書由来の `5営業日` を回答できること。
- `asOfDate` が指定されていて正規化不能な場合は server date に fallback せず失敗させる。

## 検討・判断
- 文書中の「何営業日か」を聞く質問と、営業日を使った日付計算依頼は intent として分離した。
- MVP では営業日計算そのものは未対応のまま維持し、明示的な計算要求だけ `business_day_calculation` として unavailable にする。
- benchmark/test の再現性を優先し、invalid `asOfDate` は `buildTemporalContext` で例外にした。

## 実施作業
- `detectToolIntent` に `isBusinessDayCalculationRequest` を追加し、単純な `/営業日/` 判定を compute-only 条件から外した。
- `canAnswerTemporalFromQuestion` から営業日の無条件 true を削除した。
- `executeTemporalCalculation` の営業日未対応分岐を `temporalOperation === "business_day_calculation"` に限定した。
- `ToolIntentSchema.temporalOperation` に `business_day_calculation` を追加した。
- invalid `asOfDate` 指定時に `buildTemporalContext` が例外を投げるようにした。
- computation / graph test に営業日 RAG fallback と invalid `asOfDate` の regression test を追加した。
- 詳細設計 docs に営業日 intent と invalid `asOfDate` の扱いを追記した。

## 成果物
- `memorag-bedrock-mvp/apps/api/src/agent/computation.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/state.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/computation.test.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/graph.test.ts`
- `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_005.md`

## 検証
- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`: 成功
- `npm --prefix memorag-bedrock-mvp/apps/api test`: 成功（86 tests）
- `git diff --check`: 成功

## Fit 評価
- High 指摘の「営業日を含む RAG 質問が検索されない」問題は、intent 条件と graph regression test により対応済み。
- Medium 指摘の invalid `asOfDate` silent fallback も fail-fast に変更済み。
- `calculation_unavailable` の `isAnswerable` 方針は、既存方針どおり dedicated reason で区別する設計を維持した。

## 未対応・制約・リスク
- 営業日計算そのものは引き続き Phase 4 scope として未対応。
- `nowIso` の UTC / `+09:00` 表現揺れは今回の correctness 修正範囲外。
