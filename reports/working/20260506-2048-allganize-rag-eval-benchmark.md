# 作業完了レポート

保存先: `reports/working/20260506-2048-allganize-rag-eval-benchmark.md`

## 1. 受けた指示

- `worktree` を作成して作業する。
- `allganize/RAG-Evaluation-Dataset-JA` を benchmark として実行できるようにする。
- 作業後に git commit し、main 向け PR を GitHub App で作成する。
- 情報が足りない場合は確認用プロンプトを作成する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 専用 worktree で作業する | 高 | 対応 |
| R2 | Hugging Face CSV を既存 benchmark runner で扱える JSONL に変換する | 高 | 対応 |
| R3 | `documents.csv` の source PDF を benchmark corpus として seed できる | 高 | 対応 |
| R4 | local task と managed benchmark suite から実行できる | 高 | 対応 |
| R5 | docs と tests を更新する | 高 | 対応 |
| R6 | commit と PR を作成する | 高 | 最終手順で対応 |

## 3. 検討・判断したこと

- 既存 runner は JSONL dataset と corpus seed を前提にしているため、Hugging Face CSV を直接 runner に読ませるのではなく、変換 script を追加した。
- `target_answer` は長文で完全包含判定には厳しすぎるため、既定では `referenceAnswer` として raw results に残し、file/page/citation/retrieval 指標を中心に評価する方針にした。
- 厳密な完全包含判定が必要な場合に備え、`ALLGANIZE_RAG_EXPECTED_MODE=strict-contains` を追加した。
- `documents.csv` は PDF URL の一覧であり、実際の RAG 検索には source PDF の seed が必要なため、corpus seed を PDF `contentBase64` upload に対応させた。
- CodeBuild runner では `allganize-rag-evaluation-ja-v1` の場合だけ Hugging Face から dataset と PDF を取得し、既存 S3 dataset suite には影響しない分岐にした。

## 4. 実施した作業

- `.worktrees/allganize-rag-eval-benchmark` を `origin/main` から作成した。
- `benchmark/allganize-ja.ts` を追加し、CSV parser、JSONL 変換、必要 PDF download を実装した。
- `benchmark/corpus.ts` を PDF corpus seed に対応させた。
- `benchmark/run.ts` に `referenceAnswer` と `metadata` の results 出力を追加した。
- `allganize-rag-evaluation-ja-v1` benchmark suite と CodeBuild pre_build 分岐を追加した。
- `Taskfile.yml`、README、LOCAL_VERIFICATION、OPERATIONS に実行手順と評価上の注意を追記した。
- benchmark unit tests、API tests、infra tests、Allganize 1件 smoke run を実行した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/benchmark/allganize-ja.ts` | TypeScript | Allganize CSV 変換と PDF corpus download | R2, R3 |
| `memorag-bedrock-mvp/Taskfile.yml` | YAML | `benchmark:allganize:prepare` / `benchmark:allganize:ja` | R4 |
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts` | TypeScript | managed benchmark suite 追加 | R4 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript | CodeBuild runner の Allganize 準備分岐 | R4 |
| `memorag-bedrock-mvp/docs/LOCAL_VERIFICATION.md` ほか | Markdown | ローカル実行手順と運用注意 | R5 |
| `reports/working/20260506-2048-allganize-rag-eval-benchmark.md` | Markdown | 本作業レポート | 共通指示 |

## 6. 検証結果

| コマンド | 結果 |
|---|---|
| `npm ci` | pass |
| `npm run typecheck -w @memorag-mvp/benchmark` | pass |
| `npm run test -w @memorag-mvp/benchmark` | pass |
| `ALLGANIZE_RAG_LIMIT=1 ./node_modules/.bin/tsx benchmark/allganize-ja.ts` | pass |
| `npm run typecheck -w @memorag-mvp/api` | pass |
| `npm run test -w @memorag-mvp/api` | pass |
| `UPDATE_SNAPSHOTS=1 npm run test -w @memorag-mvp/infra` | pass |
| `npm run typecheck -w @memorag-mvp/infra` | pass |
| `npm run lint` | pass |
| `git diff --check` | pass |
| local API + `DATASET=.local-data/allganize-rag-evaluation-ja/dataset.jsonl ... npm run start -w @memorag-mvp/benchmark` | pass |

## 7. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4.8/5 | worktree、実装、検証、commit/PR 前準備まで対応した |
| 制約遵守 | 5/5 | repo skill、docs、test、report ルールを適用した |
| 成果物品質 | 4.6/5 | 既存 runner に沿って local/CodeBuild の両方に対応した |
| 説明責任 | 4.7/5 | `target_answer` の扱いと公式 O/X 判定との差分を docs に明記した |
| 検収容易性 | 4.8/5 | Task と smoke 手順を残し、テスト結果も記録した |

**総合fit: 4.8/5（約96%）**

理由: Allganize dataset を既存 benchmark runner と managed benchmark suite の両方で実行可能にし、PDF corpus seed と検証を含めたため。公式 leaderboard と同等の自動 O/X 判定は未実装だが、これは既存 evaluator の範囲外であることを明記した。

## 8. 未対応・制約・リスク

- 未対応: Allganize 公式 leaderboard と同等の自動 O/X 判定や LLM judge profile は追加していない。
- 制約: CodeBuild 実行時は Hugging Face と各 PDF 配布元への outbound HTTPS が必要。
- リスク: PDF 配布元 URL が変更または停止した場合、dataset 準備が失敗する。
- 確認事項: 厳密な回答品質比較が必要なら、`target_answer` を使った LLM judge profile の追加要否を確認する。
