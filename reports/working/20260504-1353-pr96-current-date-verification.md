# PR #96 資料内日付確認 fallback 対応

## 受けた指示
- PR #96 最新 head `9718bdd...` の再レビューで指摘された、`current_date` intent の false positive を修正する。
- `この資料の日付を確認してください` のような質問が RAG retrieval に流れる regression test を追加する。
- PR メタデータ上の `mergeable: false` も確認する。

## 要件整理
- `日付.*(教えて|確認|いつ)` だけでは current date としない。
- current date は `今日`、`本日`、`現在`、`今` などの基準日語彙がある場合に限定する。
- 資料・書類・契約書・発行日・作成日などの文書確認語彙がある場合は RAG retrieval に流す。
- `今日の日付は？` は引き続き compute-only で回答できること。

## 検討・判断
- `isCurrentDateRequest()` を追加し、文書確認質問を除外したうえで基準日語彙を要求するようにした。
- `inferTemporalOperation()` も同じ helper を使い、detect と実行対象のずれを避けた。
- `isDocumentVerificationQuestion()` に `書類`、`契約書`、`発行日`、`作成日` を追加した。

## 実施作業
- `detectToolIntent` の current date 判定を `isCurrentDateRequest()` に置き換えた。
- computation test に資料内日付確認が `needsSearch=true` になる assertion を追加した。
- graph test に資料内日付確認が RAG retrieval に流れ、`execute_computation_tools` が呼ばれない regression test を追加した。
- 詳細設計 docs に current date と資料内日付確認の分離を追記した。

## 成果物
- `memorag-bedrock-mvp/apps/api/src/agent/computation.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/computation.test.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/graph.test.ts`
- `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_005.md`

## 検証
- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`: 成功
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/agent/graph.test.ts src/agent/computation.test.ts`: 成功（script の glob により API 全 90 tests を実行）

## Fit 評価
- 指摘された「この資料の日付を確認してください」が server current date で回答されるリスクは、intent 条件と graph regression test により対応済み。
- `今日の日付は？` の current date compute-only は維持している。

## 未対応・制約・リスク
- PR の mergeability は push 後に GitHub metadata で再確認する。
- `calculation_unavailable` / `structured_index_unavailable` / `invalid_temporal_context` を benchmark で通常正答から除外する評価側対応は別作業。
- `nowIso` の UTC / `+09:00` 表現揺れは今回の correctness 修正範囲外。
