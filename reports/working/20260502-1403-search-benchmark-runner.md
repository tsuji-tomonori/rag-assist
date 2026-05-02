# 作業完了レポート

保存先: `reports/working/20260502-1403-search-benchmark-runner.md`

## 1. 受けた指示

- `worktree` を作成して作業する。
- `rag-assist` の RAG 用 hybrid 検索 API について、検索単体評価と RAG/Agent end-to-end 評価を分ける設計に沿って実装する。
- Search API 評価用 runner、qrels dataset、管理画面の非同期 benchmark run 操作、Step Functions + CodeBuild Runner 基盤、テスト、ドキュメントを追加する。
- 作業後に git commit し、GitHub Apps を利用して main 向け PR を作成する。
- 競合発生後は、main を正として取り込み、重複実装を避けて必要な Search 評価差分だけを残す。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 作業用 worktree を作成する | 高 | 対応 |
| R2 | Search API 用 qrels runner と retrieval metrics を追加する | 高 | 対応 |
| R3 | `/benchmark-runs` 系 API と管理画面を追加する | 高 | main 側実装を採用 |
| R4 | Step Functions + CodeBuild + S3 + DynamoDB の実行基盤を CDK に追加する | 高 | main 側実装を採用し Search runner 接続のみ追加 |
| R5 | 認証・認可境界と静的 policy test を更新する | 高 | main 側 policy を維持し回帰 test で確認 |
| R6 | 実装に合わせて docs と運用手順を更新する | 中 | main 側 docs を採用し追加更新なし |
| R7 | 最小十分な test/typecheck/lint を実行する | 高 | 対応 |
| R8 | commit と main 向け PR を作成する | 高 | PR 作成済み、競合解消 commit を反映予定 |

## 3. 検討・判断したこと

- Search 評価は `/benchmark/query` 既存 runner とは分け、`benchmark/search-run.ts` と `benchmark/metrics/retrieval.ts` に分離した。
- qrels は graded relevance を扱い、`Recall@k`、`MRR@10`、`nDCG@10`、`Precision@k`、expected hit、ACL leak、latency を summary/report に出す形にした。
- ablation 用に `lexicalTopK` / `semanticTopK` の `0` 指定を `/search` schema と実装で許可した。
- benchmark 管理 API、認可、履歴 UI、Step Functions + CodeBuild 基盤は main に同等実装が入っていたため、main を正として採用した。
- CDK の CodeBuild runner は既存 npm workspace を使い、Search runner と Agent runner を `MODE` で切り替える方式にした。

## 4. 実施した作業

- `codex/search-benchmark-runner` の worktree を作成した。
- benchmark workspace に Search API runner、retrieval metrics、unit test、sample qrels dataset、`start:search` script を追加した。
- main 取り込み時に、benchmark run store、管理 API、管理画面、Step Functions + CodeBuild 基盤は main 側の実装を正として採用した。
- 既存 main の benchmark suite 一覧、管理画面、CodeBuild buildspec に Search API 評価 runner を接続した。
- `/search` で `lexicalTopK: 0` / `semanticTopK: 0` を許可し、lexical-only / semantic-only ablation を実行できるようにした。
- API 設計 docs と Operations docs は main 側の記述を正として採用し、追加更新は行わなかった。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/benchmark/search-run.ts` | TypeScript | Search API qrels runner | Search API 評価に対応 |
| `memorag-bedrock-mvp/benchmark/metrics/retrieval.ts` | TypeScript | Retrieval metrics と ACL leak 計算 | Search 指標に対応 |
| `memorag-bedrock-mvp/benchmark/datasets/search.sample.jsonl` | JSONL | qrels sample dataset | dataset 要件に対応 |
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts` | TypeScript | Search benchmark suite 追加 | 管理 API からの Search 評価起動に対応 |
| `memorag-bedrock-mvp/apps/web/src/App.tsx` | React | suite mode に応じた benchmark 起動 | 既存管理画面から Search 評価を起動可能にする対応 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | CDK | Search qrels dataset 配置と runner mode 切替 | 既存実行基盤への Search runner 接続に対応 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---|---|
| 指示網羅性 | 4.6 / 5 | Search runner と既存 benchmark 基盤への接続を実装した。管理 API、管理画面、実行基盤は main 側実装を正として採用した。大規模 dataset や本番 token secret の実投入は環境依存のため未実施。 |
| 制約遵守 | 4.8 / 5 | worktree 作成、日本語 commit/PR ルール、access-control review、docs/test/report ルールに対応した。 |
| 成果物品質 | 4.5 / 5 | 型・unit・API・web・infra test を通した。CodeBuild 実ジョブは AWS 環境未接続のため未実行。 |
| 説明責任 | 4.7 / 5 | 設計判断、認可境界、未検証事項を本レポートに記載した。 |
| 検収容易性 | 4.6 / 5 | 実行コマンド、成果物、影響範囲を分けて確認できる形にした。 |

総合fit: 4.6 / 5.0（約92%）

## 7. 検証

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts src/search/hybrid-search.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- `git diff --check`: pass

## 8. 未対応・制約・リスク

- CodeBuild runner の AWS 実行はローカル環境からは未実施。
- 本番 API を叩く場合の `API_AUTH_TOKEN` secret は CodeBuild project 側の追加設定で注入する必要がある。
- 大規模 qrels dataset は sample のみ追加し、実データセット作成は対象外。
- Step Functions の summary 読み込みは CodeBuild post_build の DynamoDB update で metrics を反映する方式とし、専用 helper Lambda は追加していない。
