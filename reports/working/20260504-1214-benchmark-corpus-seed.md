# 作業完了レポート

保存先: `reports/working/20260504-1214-benchmark-corpus-seed.md`

## 1. 受けた指示

- worktree を作成して作業する。
- 性能テスト時に資料をアップロードし、ベクトル化されるようにシナリオを修正する。
- `standard-agent-v1` が期待する `handbook.md` を runner から見える状態にする。
- git commit を作成し、GitHub Apps を使って `main` 向け PR を作成する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 別 worktree で作業する | 高 | 対応 |
| R2 | benchmark 実行前に前提資料をアップロードする | 高 | 対応 |
| R3 | アップロード後に active chunk があることを確認する | 高 | 対応 |
| R4 | `BENCHMARK_RUNNER` の必要最小限の権限を調整する | 高 | 対応 |
| R5 | 関連 docs と検証を更新する | 中 | 対応 |
| R6 | commit と PR を作成する | 高 | このレポート作成後に実施 |

## 3. 検討・判断したこと

- `standard-agent-v1` の dataset は `handbook.md` を期待しているため、runner 側に corpus seed 前処理を置いた。
- 任意 dataset 実行の挙動を変えないように、`BENCHMARK_CORPUS_DIR` 指定時だけ seed する設計にした。
- CodeBuild の agent mode では `benchmark/corpus/standard-agent-v1` を指定し、標準性能テストで自動 seed されるようにした。
- 重複アップロードを避けるため、`benchmarkSourceHash` 付き metadata を保存し、同じ hash の active seed document があれば再利用する。
- `BENCHMARK_RUNNER` は前処理に必要な `rag:doc:read` と `rag:doc:write:group` のみ追加し、削除、run 履歴参照、キャンセル、download は許可しない。

## 4. 実施した作業

- `benchmark/corpus.ts` を追加し、corpus directory の文書を `/documents` に seed する処理を実装した。
- `benchmark/run.ts` に benchmark query 実行前の seed 呼び出しを追加した。
- `benchmark/corpus/standard-agent-v1/handbook.md` を追加し、標準 dataset の期待語を含む社内ハンドブックを用意した。
- `Taskfile.yml` と CodeBuild buildspec で `standard-agent-v1` の corpus directory を指定した。
- `BENCHMARK_RUNNER` の RBAC、単体テスト、infra snapshot、運用/検証 docs を更新した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/benchmark/corpus.ts` | TypeScript | benchmark corpus seed 実装 | R2, R3 |
| `memorag-bedrock-mvp/benchmark/corpus/standard-agent-v1/handbook.md` | Markdown | 標準 benchmark 前提資料 | R2 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript | CodeBuild runner への corpus env 設定 | R2 |
| `memorag-bedrock-mvp/apps/api/src/authorization.ts` | TypeScript | runner の文書 read/write 権限追加 | R4 |
| README / docs | Markdown | 運用・ローカル検証・権限説明の更新 | R5 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | worktree、実装、検証、commit/PR 前準備まで対応した |
| 制約遵守 | 5 | 日本語 docs、RBAC レビュー、未実施検証の明記ルールを守った |
| 成果物品質 | 4 | seed 経路と重複回避を実装し、ローカル smoke でも確認した |
| 説明責任 | 5 | 権限追加理由、docs 更新、検証結果を整理した |
| 検収容易性 | 5 | 変更ファイルと検証コマンドを明示した |

総合fit: 4.8 / 5.0（約96%）
理由: 主要要件は満たした。root の `task docs:check:changed` は存在しなかったため未実行だが、代替として `git diff --check` と対象 test/typecheck を実行した。

## 7. 検証

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: PASS
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: PASS
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: PASS
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: PASS
- `env UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp/infra test`: PASS
- `npm --prefix memorag-bedrock-mvp/infra test`: PASS
- `task benchmark:sample API_BASE_URL=http://localhost:18998`: PASS。モック API で `handbook.md` seed と `retrievalRecallAt20 = 1` を確認した。
- `git diff --check`: PASS
- `task docs:check:changed`: 未実行。root Taskfile に該当 task が存在しなかった。

## 8. 未対応・制約・リスク

- `BENCHMARK_RUNNER` に文書 upload 権限を付与したため、runner token の漏えい時は benchmark corpus 以外の文書 upload も可能になる。削除や artifact download は許可していない。
- ローカル benchmark smoke は mock model のため回答品質保証ではない。seed と retrieval 経路の確認として実施した。
- `Quality Review: pass` 表示や run metrics 永続化の改善は今回の作業範囲外。
