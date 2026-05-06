# MMRAG-DocQA 性能テスト UI 実行導線追加

保存先: `tasks/done/20260506-2049-mmrag-docqa-benchmark-ui.md`

状態: done

## 背景

PR #133 では、`MMRAG-DocQA: A Multi-Modal Retrieval-Augmented Generation Method for Document Question-Answering with Hierarchical Index and Multi-Granularity Retrieval` を性能テストとして UI から起動できるようにする必要があった。

ユーザーから与えられた情報は論文タイトルのみだったため、実 paper corpus、multimodal assets、ground-truth answers、評価閾値は未確定である。

## 目的

管理画面の性能テストから `MMRAG-DocQA` を選択し、`mmrag-docqa-v1` suite として CodeBuild benchmark run を起動できる状態にする。

## 対象範囲

- `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts`
- `memorag-bedrock-mvp/apps/api/src/app.ts`
- `memorag-bedrock-mvp/apps/web/src/App.test.tsx`
- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts`
- `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts`
- `memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json`
- `memorag-bedrock-mvp/benchmark/dataset.mmrag-docqa.sample.jsonl`
- `memorag-bedrock-mvp/benchmark/corpus/mmrag-docqa-v1/mmrag-docqa-method.md`
- `memorag-bedrock-mvp/docs/`
- PR #133

## 方針

- 既存の `/benchmark-suites` と `/benchmark-runs` の非同期 benchmark flow を変更せず、suite 定義を追加する。
- CodeBuild runner の既存 pre_build corpus seed 方式に `mmrag-docqa-v1` を追加する。
- 実評価データが不足しているため、sample dataset / corpus は UI と runner 導線確認用と明記する。
- 本番評価化に必要な確認事項は別 task と確認プロンプトへ分離する。

## 必要情報

- 既存 benchmark suite 定義: `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts`
- CodeBuild runner buildspec: `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts`
- 確認プロンプト: `memorag-bedrock-mvp/docs/1_要求_REQ/31_変更管理_CHANGE/MMRAG_DOCQA_CONFIRMATION_PROMPT.md`
- 作業レポート: `reports/working/20260506-2041-mmrag-docqa-benchmark-ui.md`

## 実行計画

1. `mmrag-docqa-v1` suite を API の benchmark suite 一覧に追加する。
2. benchmark seed upload の許可 suite に `mmrag-docqa-v1` を追加する。
3. CDK の benchmark dataset deployment に `dataset.mmrag-docqa.sample.jsonl` を追加する。
4. CodeBuild pre_build で `benchmark/corpus/mmrag-docqa-v1/` を seed する設定を追加する。
5. UI test で `MMRAG-DocQA` 選択と `/benchmark-runs` 起動 request を確認する。
6. README、運用 docs、API 設計 docs、ローカル検証 docs を更新する。
7. 競合解消後に snapshot と検証を更新する。
8. PR #133 に受け入れ条件チェック結果をコメントする。

## ドキュメントメンテナンス計画

- `memorag-bedrock-mvp/README.md`: `mmrag-docqa-v1` の UI 起動と dataset / corpus の注意点を追加する。
- `memorag-bedrock-mvp/docs/OPERATIONS.md`: CodeBuild runner、dataset deploy、metrics 更新、`mmrag-docqa-v1` seed 方針を維持する。
- `memorag-bedrock-mvp/docs/LOCAL_VERIFICATION.md`: ローカルで `mmrag-docqa-v1` を試す場合の環境変数を追加する。
- `memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_001.md`: `/benchmark-suites` で返る suite として `mmrag-docqa-v1` を記載する。
- 実 paper corpus の評価要件は `tasks/todo/20260506-2049-mmrag-docqa-production-dataset.md` と確認プロンプトへ分離する。

## 受け入れ条件

- [x] 管理画面の性能テスト suite として `MMRAG-DocQA` が選択可能である。
  - 根拠: `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts` に `mmrag-docqa-v1` / `MMRAG-DocQA` を追加。
- [x] `mmrag-docqa-v1` を選択した起動 request が `POST /benchmark-runs` に送られる。
  - 根拠: `memorag-bedrock-mvp/apps/web/src/App.test.tsx` の性能テスト起動 test。
- [x] CodeBuild runner が `mmrag-docqa-v1` の dataset を S3 deploy 対象として扱う。
  - 根拠: `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` の `mmrag-docqa-v1.jsonl` deploy 設定。
- [x] CodeBuild runner が `mmrag-docqa-v1` の corpus seed 設定を持つ。
  - 根拠: `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` の `BENCHMARK_CORPUS_DIR=benchmark/corpus/mmrag-docqa-v1` 設定。
- [x] benchmark seed upload の suite whitelist に `mmrag-docqa-v1` が含まれる。
  - 根拠: `memorag-bedrock-mvp/apps/api/src/app.ts` の `benchmarkSeedSuites`。
- [x] 実評価データ不足への確認プロンプトが存在する。
  - 根拠: `memorag-bedrock-mvp/docs/1_要求_REQ/31_変更管理_CHANGE/MMRAG_DOCQA_CONFIRMATION_PROMPT.md`。
- [x] benchmark 運用・API 設計・ローカル検証 docs が更新されている。
  - 根拠: README、`docs/OPERATIONS.md`、`docs/LOCAL_VERIFICATION.md`、`DES_API_001.md`。
- [x] `main` との競合が解消されている。
  - 根拠: `git rebase origin/main` 後に競合ファイルを解消し、rebase 完了。
- [x] 受け入れ条件の確認結果が PR #133 のコメントに記載されている。
  - 根拠: GitHub Apps で PR #133 にコメント追加。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `env UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`
- `npm --prefix memorag-bedrock-mvp run lint`
- `git diff --check`

## 検証結果

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass
- `env UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- `git diff --check`: pass

## PRレビュー観点

- `blocking`: `mmrag-docqa-v1` が通常利用者の文書一覧・検索に混入しないこと。
- `blocking`: `summary.json` から `BenchmarkRunsTable.metrics` を更新する既存 main 側変更が競合解消で失われていないこと。
- `should fix`: sample dataset / corpus を本番評価結果として誤読しない注意書きが docs と PR コメントにあること。
- `should fix`: UI、API、Infra の変更に対応する tests / snapshot が更新されていること。

## 未決事項・リスク

- 決定事項: この task は UI / runner 導線追加までを完了条件とする。
- 実装時確認: 実 AWS 環境での CodeBuild run 起動は未実施。
- リスク: sample dataset / corpus は論文手法の性能評価としては不十分である。
- 後続 task: `tasks/todo/20260506-2049-mmrag-docqa-production-dataset.md` で実 corpus / multimodal assets / ground-truth answers への差し替えを扱う。
