# 作業完了レポート

保存先: `reports/working/20260507-1308-benchmark-reset-documents.md`

## 1. 受けた指示

- 主な依頼: 性能テスト実施時に、都度過去資料を削除してから対象ファイルを再アップロードし、チャンク化等を行うよう修正する。
- 成果物: benchmark seed 処理、API 認可、テスト、関連 docs、task md。
- 条件: repository-local workflow に従い、worktree / task / validation / report / commit / PR まで進める。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | benchmark 実行ごとに過去の benchmark 管理資料を削除する | 高 | 対応 |
| R2 | 削除後に対象 corpus を再アップロードする | 高 | 対応 |
| R3 | active chunk 生成後に測定を開始する | 高 | 対応 |
| R4 | 削除・再アップロード失敗時に古い資料で測定しない | 高 | 対応 |
| R5 | `BENCHMARK_RUNNER` の削除権限を isolated seed 文書に限定する | 高 | 対応 |
| R6 | docs と検証結果を残す | 中 | 対応 |

## 3. 検討・判断したこと

- 既存の `seedBenchmarkCorpus` は matching seed があれば skip する設計だったため、同じ `BENCHMARK_CORPUS_SUITE_ID` の isolated seed 文書を先に DELETE し、その後 upload する方式へ変更した。
- 削除対象は `benchmarkSeed: true`、`source: "benchmark-runner"`、`docType: "benchmark-corpus"`、`aclGroups: ["BENCHMARK_RUNNER"]` を満たす active 文書に限定した。
- `BENCHMARK_RUNNER` には通常の `rag:doc:delete:group` を付与せず、既存 DELETE route 内で isolated seed 文書だけ scoped delete を許可した。
- latency summary は setup 時間ではなく `/benchmark/query` または `/benchmark/search` の初回 API call を対象にする既存集計を維持し、docs に明記した。

## 4. 実施した作業

- `benchmark/corpus.ts` に seed 前削除処理を追加。
- `DELETE /documents/{documentId}` の認可を、通常削除権限または isolated benchmark seed delete に拡張。
- benchmark corpus / search runner / API contract / static access-control test を更新。
- README、API examples、LOCAL_VERIFICATION の benchmark seed 説明を更新。
- ローカル API を使った agent / search benchmark smoke で削除ログと再アップロードを確認。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/benchmark/corpus.ts` | TypeScript | seed 前削除と失敗時中断 | R1-R4 |
| `memorag-bedrock-mvp/apps/api/src/app.ts` | TypeScript | isolated seed delete 認可 | R5 |
| `memorag-bedrock-mvp/benchmark/*.test.ts` / API tests | TypeScript test | 削除、再アップロード、失敗時中断、認可境界 | R1-R5 |
| `memorag-bedrock-mvp/README.md` / docs | Markdown | benchmark seed の削除・再アップロード前提 | R6 |
| `tasks/do/20260507-1203-benchmark-reset-documents.md` | Markdown | task と受け入れ条件 | workflow |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | 削除、再アップロード、chunk 確認、失敗時中断まで実装した。 |
| 制約遵守 | 5 | worktree/task/report/validation workflow と認可 review を適用した。 |
| 成果物品質 | 4.5 | unit / contract / smoke で確認済み。remote CodeBuild は未実行。 |
| 説明責任 | 5 | docs、task、report に測定対象と未実施範囲を明記した。 |
| 検収容易性 | 5 | 変更箇所と検証コマンドを追跡可能にした。 |

総合fit: 4.9 / 5.0（約98%）
理由: 主要要件は満たした。remote CodeBuild 実行はこの環境では行っていないため満点からは差し引いた。

## 7. 検証

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts src/authorization.test.ts src/contract/api-contract.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass
- `API_BASE_URL=http://localhost:18793 task benchmark:sample`: pass
- `API_BASE_URL=http://localhost:18793 task benchmark:search:sample`: pass

## 8. 未対応・制約・リスク

- remote CodeBuild runner の実行は未実施。ローカル API smoke で runner 経路は確認した。
- 削除対象は isolated benchmark seed metadata を持つ文書に限定するため、過去の手動投入資料や metadata が不完全な資料は自動削除対象外。
- smoke 実行で生成された `.local-data` は作業後に削除した。
