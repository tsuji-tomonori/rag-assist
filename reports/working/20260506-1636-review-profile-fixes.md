# 作業完了レポート

保存先: `reports/working/20260506-1636-review-profile-fixes.md`

## 1. 受けた指示

- PR review の Changes requested 相当指摘に対応する。
- `RAG_PROFILE_ID` が実際の retrieval profile selector になるよう修正する。
- benchmark evaluator profile の row 指定と集計表示が混在して誤読されないようにする。
- unknown evaluator profile の silent fallback を止める。
- 修正後に検証し、commit / push / PR コメントまで行う。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `RAG_PROFILE_ID` を label ではなく selector として扱う | 高 | 対応 |
| R2 | unknown `RAG_PROFILE_ID` を default fallback せず失敗させる | 高 | 対応 |
| R3 | unknown evaluator profile を default fallback せず失敗させる | 高 | 対応 |
| R4 | row-level evaluator profile 混在時の `recall@K` 誤集計を防ぐ | 高 | 対応 |
| R5 | search benchmark report の row detail で profile と recall K を明示する | 中 | 対応 |
| R6 | 関連テスト、docs、実動作確認を行う | 高 | 対応 |

## 3. 検討・判断したこと

- retrieval profile は現行の設定項目を保ったまま、`default` と `adaptive-retrieval` の既知 ID resolver に集約した。
- `RAG_ADAPTIVE_RETRIEVAL=true` は既存互換の shortcut として残し、`default` 未指定時は `adaptive-retrieval` を選択する挙動にした。
- benchmark の row profile は集計を profile ごとに分けるより、まず混在を失敗させる方が既存 report schema への影響が小さく安全と判断した。
- search benchmark report は将来の profile 比較時に誤読しないよう、行ごとの `evaluator_profile` と `recall_k` を表示する形にした。

## 4. 実施作業

- `apps/api/src/rag/profiles.ts` に retrieval profile ID resolver を追加し、未知 ID を例外化。
- `apps/api/src/agent/runtime-policy.ts` で resolver の結果を runtime policy / debug profile に反映。
- `benchmark/evaluator-profile.ts` で unknown evaluator profile を例外化し、suite と row の混在検出 helper を追加。
- `benchmark/run.ts` と `benchmark/search-run.ts` で suite と異なる row evaluator profile を失敗させるよう変更。
- `benchmark/search-run.ts` の Markdown row detail に `evaluator_profile` と `recall_k` を追加し、top-level await 前初期化の問題を修正。
- `docs/OPERATIONS.md` と `docs/LOCAL_VERIFICATION.md` に profile selector / fail fast / mixed profile 禁止を追記。
- API と benchmark の regression test を追加・更新。

## 5. 成果物

| 成果物 | 内容 |
|---|---|
| `memorag-bedrock-mvp/apps/api/src/rag/profiles.ts` | retrieval profile ID resolver |
| `memorag-bedrock-mvp/apps/api/src/rag/profiles.test.ts` | retrieval profile resolver test |
| `memorag-bedrock-mvp/benchmark/evaluator-profile.ts` | evaluator profile fail fast と mixed profile guard |
| `memorag-bedrock-mvp/benchmark/search-run.ts` | row profile guard と report 表示改善 |
| `memorag-bedrock-mvp/docs/OPERATIONS.md` | 運用仕様更新 |
| `memorag-bedrock-mvp/docs/LOCAL_VERIFICATION.md` | ローカル検証注意点更新 |

## 6. 検証

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api -- src/rag/profiles.test.ts src/agent/runtime-policy.test.ts`: pass。script glob により API test 全体 130 件が実行された。
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/benchmark`: pass。14 件。
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- `git diff --check`: pass
- `API_BASE_URL=http://localhost:8788 task benchmark:sample`: pass。ローカル API に対する runner 完走と artifact 生成を確認。
- `API_BASE_URL=http://localhost:8788 task benchmark:search:sample`: pass。ローカル API に対する search runner 完走と report detail の `evaluator_profile` / `recall_k` 表示を確認。

## 7. 未対応・制約・リスク

- ローカル sample benchmark は AWS credentials 未設定のため、回答品質や検索 hit rate の合否ではなく、runner / report artifact 生成の確認として扱った。
- PR comment と commit / push はこのレポート作成後に実施する。

## 8. Fit 評価

総合fit: 4.8 / 5.0（約96%）

理由: 指摘された 3 件をコード・テスト・docs で直接対応し、runner の実動作も確認した。ローカル credentials 制約により sample benchmark の品質指標そのものは評価対象外としたため、満点ではない。
