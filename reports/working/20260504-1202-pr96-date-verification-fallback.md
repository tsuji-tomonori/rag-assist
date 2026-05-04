# PR #96 明示日付の文書確認質問 fallback 対応

## 受けた指示
- PR #96 最新 head `13bf85c...` の再レビューで指摘された、明示日付を含む文書確認質問の compute-only 誤ルーティングを修正する。
- `経費精算の期限は2026-05-10ですか？` のような質問が RAG retrieval に流れる regression test を追加する。

## 要件整理
- `期限` / `締切` / `まで` と明示日付を含むだけでは `canAnswerFromQuestionOnly=true` にしない。
- 文書確認語彙を含む質問では、質問文中の日付を根拠事実として扱わず RAG に流す。
- 明示的な日数計算や期限切れ判定は引き続き DateCalculator 対象にする。

## 検討・判断
- `isDateComputationRequest` を追加し、日数計算または期限状態判定の語彙がある場合だけ date computation とする。
- `isDocumentVerificationQuestion` を追加し、`ですか`、`合っていますか`、`資料`、`規程`、`文書`、`マニュアル` などを含む質問は compute-only から除外した。
- 既存の compute-only fallback は維持しつつ、intent の false positive 自体を抑える方針にした。

## 実施作業
- `detectToolIntent` の temporal 判定から単純な `期限` / `締切` / `まで` マッチを外した。
- `canAnswerTemporalFromQuestion` を、日付があるだけでなく計算語彙がある場合に限定した。
- computation test に明示日付の文書確認質問が `needsSearch=true` になる assertion を追加した。
- graph test に、文書上の期限が `2026年5月15日` の場合に `2026-05-10ですか？` が RAG retrieval に流れる regression test を追加した。
- 詳細設計 docs に文書確認質問と DateCalculator 対象語彙の分離を追記した。

## 成果物
- `memorag-bedrock-mvp/apps/api/src/agent/computation.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/computation.test.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/graph.test.ts`
- `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_005.md`

## 検証
- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`: 成功
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/agent/graph.test.ts src/agent/computation.test.ts`: 成功（script の glob により API 全 88 tests を実行）

## Fit 評価
- 指摘された「質問文の日付を根拠事実として扱う」リスクは、文書確認質問を RAG retrieval に流す intent 条件と graph regression test により対応済み。
- 明示的な `あと何日`、`期限切れ`、`超過` などの計算質問は DateCalculator 対象として維持している。

## 未対応・制約・リスク
- `calculation_unavailable` / `structured_index_unavailable` / `invalid_temporal_context` を benchmark で通常正答から除外する評価側対応は別作業。
- `nowIso` の UTC / `+09:00` 表現揺れは今回の correctness 修正範囲外。
