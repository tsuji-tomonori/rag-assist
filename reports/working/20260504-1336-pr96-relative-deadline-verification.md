# PR #96 相対期限ルール確認質問 fallback 対応

## 受けた指示
- PR #96 最新 head `f7e7ecc...` の再レビューで指摘された、相対期限ルールを含む文書確認質問の compute-only 誤ルーティングを修正する。
- `経費精算の期限は申請から30日以内ですか？` のような質問が RAG retrieval に流れる regression test を追加する。

## 要件整理
- `申請から30日以内ですか？` のような記載確認を DateCalculator に流さない。
- 相対期限ルールの実計算要求は引き続き computation path に残す。
- unit test と graph test の両方で false positive を防ぐ。

## 検討・判断
- `parseRelativeDeadline()` の結果を文書確認除外の外側で compute-only に使っていたため、`asksRelativeDeadlineCalculation` として明示的な計算要求に限定した。
- 文書確認語彙がある場合は、相対期限ルールが含まれていても RAG retrieval に流す方針にした。
- `申請日`、`提出日`、`期限日`、`いつ`、`あと何日`、`計算` などがある場合は相対期限の計算要求として扱う。

## 実施作業
- `detectToolIntent` で `relativeDeadline` と `asksRelativeDeadlineCalculation` を分離した。
- `canAnswerTemporalFromQuestion` を相対期限ルールがあるだけで true にせず、計算要求語彙を要求するようにした。
- computation test に相対期限確認質問が `needsSearch=true` になる assertion を追加した。
- graph test に相対期限確認質問が RAG retrieval に流れ、`execute_computation_tools` が呼ばれない regression test を追加した。
- 詳細設計 docs に相対期限ルール確認と相対期限計算要求の分離を追記した。

## 成果物
- `memorag-bedrock-mvp/apps/api/src/agent/computation.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/computation.test.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/graph.test.ts`
- `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_005.md`

## 検証
- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`: 成功
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/agent/graph.test.ts src/agent/computation.test.ts`: 成功（script の glob により API 全 89 tests を実行）

## Fit 評価
- 指摘された「資料では申請から30日以内ですか？」が計算不能回答になるリスクは、intent 条件と graph regression test により対応済み。
- 相対期限の実計算要求は `asksRelativeDeadlineCalculation` で継続して DateCalculator 対象にしている。

## 未対応・制約・リスク
- `calculation_unavailable` / `structured_index_unavailable` / `invalid_temporal_context` を benchmark で通常正答から除外する評価側対応は別作業。
- `nowIso` の UTC / `+09:00` 表現揺れは今回の correctness 修正範囲外。
