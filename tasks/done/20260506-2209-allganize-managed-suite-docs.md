# Allganize managed benchmark suite と運用手順

## 保存先

`tasks/done/20260506-2209-allganize-managed-suite-docs.md`

## 状態

done

## 背景

Allganize dataset を local CLI だけでなく、管理画面から起動される managed benchmark suite としても扱えるようにする必要があった。既存 CodeBuild runner は S3 dataset を前提としていたため、Hugging Face から準備する suite 用の分岐が必要だった。

## 目的

`allganize-rag-evaluation-ja-v1` を benchmark suite 一覧に追加し、local task と CodeBuild runner の両方で同じ dataset 変換・corpus seed 経路を使えるようにする。

## 対象範囲

- `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts`
- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts`
- `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts`
- `memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json`
- `memorag-bedrock-mvp/Taskfile.yml`
- `memorag-bedrock-mvp/README.md`
- `memorag-bedrock-mvp/docs/LOCAL_VERIFICATION.md`
- `memorag-bedrock-mvp/docs/OPERATIONS.md`

## 方針

- API の benchmark suite 一覧に `allganize-rag-evaluation-ja-v1` を追加する。
- CodeBuild pre_build で Allganize suite の場合だけ `npm run prepare:allganize-ja` を実行する。
- 既存 S3 dataset suite は従来どおり `aws s3 cp "$DATASET_S3_URI" "$DATASET"` を使う。
- local verification と operations docs に実行手順、環境変数、外部 network 依存、評価上の制約を明記する。

## 必要情報

- PR: #134
- 既存 benchmark suite: `standard-agent-v1`, `smoke-agent-v1`, `clarification-smoke-v1`, search suites
- CodeBuild buildspec の pre_build / post_build
- 既存 metrics persistence script: `infra/scripts/update-benchmark-run-metrics.mjs`

## 実行計画

1. `benchmarkSuites` に Allganize suite を追加する。
2. Taskfile に prepare / run task を追加する。
3. CodeBuild pre_build に Allganize suite 用の dataset 準備分岐を追加する。
4. 既存 post_build metrics persistence を維持した snapshot に更新する。
5. README / LOCAL_VERIFICATION / OPERATIONS を更新する。
6. API / infra / benchmark の検証を実行する。

## ドキュメントメンテナンス計画

- README に local 実行例と `target_answer` の扱いを記載する。
- `docs/LOCAL_VERIFICATION.md` に `task benchmark:allganize:ja` を記載する。
- `docs/OPERATIONS.md` に CodeBuild 実行時の Hugging Face / PDF URL 依存と公式 O/X 判定との差分を記載する。
- `docs/API_EXAMPLES.md` と OpenAPI は新規 endpoint / request schema 追加がないため更新不要。

## 受け入れ条件

| ID | 条件 |
|---|---|
| AC-SUITE-001 | API の benchmark suite 一覧に `allganize-rag-evaluation-ja-v1` が含まれる。 |
| AC-SUITE-002 | `task benchmark:allganize:prepare` と `task benchmark:allganize:ja` が定義される。 |
| AC-SUITE-003 | CodeBuild runner は Allganize suite の場合だけ Hugging Face から dataset / corpus を準備する。 |
| AC-SUITE-004 | 既存 S3 dataset suite の download 経路は維持される。 |
| AC-SUITE-005 | CodeBuild post_build の metrics persistence は rebase 後も維持される。 |
| AC-SUITE-006 | README / LOCAL_VERIFICATION / OPERATIONS が更新される。 |
| AC-SUITE-007 | 関連 typecheck / tests / lint / smoke が pass している。 |

## 受け入れ条件チェック

| ID | 判定 | 根拠 |
|---|---|---|
| AC-SUITE-001 | PASS | `memorag-service.ts` に `allganize-rag-evaluation-ja-v1` を追加済み。 |
| AC-SUITE-002 | PASS | `Taskfile.yml` に `benchmark:allganize:prepare` / `benchmark:allganize:ja` を追加済み。 |
| AC-SUITE-003 | PASS | `memorag-mvp-stack.ts` の pre_build に Allganize suite 分岐を追加済み。 |
| AC-SUITE-004 | PASS | Allganize 以外は `aws s3 cp "$DATASET_S3_URI" "$DATASET"` を実行する分岐を維持。 |
| AC-SUITE-005 | PASS | rebase 後の infra test で `update-benchmark-run-metrics.mjs` の post_build 実行を検証済み。 |
| AC-SUITE-006 | PASS | README、LOCAL_VERIFICATION、OPERATIONS を更新済み。 |
| AC-SUITE-007 | PASS | benchmark/api/infra typecheck、benchmark/api/infra tests、lint、Allganize smoke が pass。 |

## 検証計画

- `npm run typecheck -w @memorag-mvp/benchmark`
- `npm run test -w @memorag-mvp/benchmark`
- `npm run typecheck -w @memorag-mvp/api`
- `npm run test -w @memorag-mvp/api`
- `UPDATE_SNAPSHOTS=1 npm run test -w @memorag-mvp/infra`
- `npm run typecheck -w @memorag-mvp/infra`
- `npm run lint`
- `git diff --check`

## PRレビュー観点

- managed suite 追加が benchmark run 作成 UI/API の後方互換性を壊していないか。
- CodeBuild 分岐が既存 S3 dataset suite と search mode の挙動に影響しないか。
- 外部 download 依存、評価制約、未実装の公式 O/X 判定が docs と PR に明記されているか。

## 未決事項・リスク

- 決定事項: `allganize-rag-evaluation-ja-v1` は managed suite として追加し、datasetS3Key は識別用に `hf://datasets/allganize/RAG-Evaluation-Dataset-JA` を使う。
- リスク: CodeBuild 実行環境で Hugging Face または source PDF URL へ outbound HTTPS できない場合、run は準備段階で失敗する。
