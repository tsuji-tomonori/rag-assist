# 作業完了レポート

保存先: `reports/working/20260507-2110-bench-search-performance.md`

## 1. 受けた指示

- 主な依頼: `.workspace/bench_20260507T111644Z_d3579f01` の性能改善を plan 後に実行する。
- 成果物: search benchmark の性能・安定性改善、検証結果、PR 作成。
- 形式・条件: repository local workflow に従い、task md、検証、レポート、commit、PR、受け入れ条件コメントまで進める。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | alias query の HTTP 500 / recall miss を解消する | 高 | 対応 |
| R2 | benchmark corpus の混入を抑止する | 高 | 対応 |
| R3 | cold latency の主要要因を診断可能にする | 高 | 対応 |
| R4 | ACL negative で forbidden document を返さない | 高 | 対応 |
| R5 | 変更範囲に見合う検証を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- ベンチ結果では `search-expense-001` が 48.8 秒、`search-alias-001` が HTTP 500、検索候補に過去 benchmark corpus PDF が混在していた。
- `source=benchmark-runner` / `docType=benchmark-corpus` だけでは suite を跨いだ corpus が同じ検索対象になり、lexical index の chunk 数と cold build latency が増えると判断した。
- production search に dataset 固有分岐を入れず、汎用 filter として `benchmarkSuiteId` を追加し、benchmark runner が seed 済み corpus の suite を自動付与する方針にした。
- ACL 境界は既存の manifest/vector ACL 判定を維持し、suite filter は lexical と semantic の両方に適用した。
- API 仕様は OpenAPI schema に反映した。追加 filter は既存 benchmark metadata の検索範囲指定であり、運用手順変更はないため durable docs の本文更新は不要と判断した。

## 4. 実施した作業

- `SearchInput.filters` / OpenAPI schema / vector filter に `benchmarkSuiteId` を追加した。
- ingestion 時に `benchmarkSuiteId` を vector metadata に保存し、local / S3 Vectors の filter に反映した。
- search benchmark runner が corpus seed 実施時に `benchmarkSuiteId=<BENCHMARK_CORPUS_SUITE_ID>` を `/benchmark/search` へ渡し、API 側で `source=benchmark-runner` / `docType=benchmark-corpus` と合わせて強制 scope するようにした。
- search diagnostics に visible manifest 数、indexed chunk 数、index cache 種別、index load 時間を追加した。
- suite 混入防止、alias hit、runner filter 自動付与のテストを追加した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/search/hybrid-search.ts` | TypeScript | suite filter と index diagnostics | R1-R4 |
| `memorag-bedrock-mvp/benchmark/search-run.ts` | TypeScript | benchmark suite scope 指定 | R2 |
| `memorag-bedrock-mvp/apps/api/src/search/hybrid-search.test.ts` | Test | suite isolation と alias query | R1-R4 |
| `memorag-bedrock-mvp/benchmark/search-run.test.ts` | Test | runner request filter 確認 | R2 |
| `/tmp/search-report-fixed-runner.md` | Markdown | local search benchmark smoke 結果 | R1-R5 |

## 6. 指示への fit 評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | plan の主要課題を実装・検証した。 |
| 制約遵守 | 5 | worktree、task md、検証、レポートの flow に従った。 |
| 成果物品質 | 4 | local benchmark では p95 47ms まで確認したが、prod 環境の再実行は未実施。 |
| 説明責任 | 5 | diagnostics とレポートで判断根拠を残した。 |
| 検収容易性 | 5 | targeted test と smoke artifact を明示した。 |

総合fit: 4.8 / 5.0（約96%）

## 7. 検証

- `./node_modules/.bin/tsx --test apps/api/src/search/hybrid-search.test.ts`: pass
- `./node_modules/.bin/tsx --test benchmark/search-run.test.ts benchmark/corpus.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `API_BASE_URL=http://127.0.0.1:18795 ... npm --prefix memorag-bedrock-mvp run start:search -w @memorag-mvp/benchmark`: pass
- `git diff --check`: pass

## 8. セキュリティ・アクセス制御レビュー

- 追加・変更 route: なし。
- 変更 schema: `/search` / `/benchmark/search` の filter に `benchmarkSuiteId`、diagnostics に index summary を追加。
- permission: 既存の `rag:doc:read`、`benchmark:query`、`BENCHMARK_RUNNER` user override 境界は維持。
- 所有者・ACL 境界: manifest ACL と vector ACL は既存どおり適用し、suite filter は候補集合を狭める方向の変更。
- 機微情報: diagnostics は caller がアクセス可能な manifest/chunk 数と cache 種別のみで、alias 内容や ACL metadata は返さない。

## 9. 未対応・制約・リスク

- prod endpoint `https://w2bk6itly9.execute-api.us-east-1.amazonaws.com/prod/` への再 benchmark は未実施。
- local benchmark の初回実行で `LOCAL_AUTH_GROUPS=BENCHMARK_RUNNER` を付けない場合、ACL negative の user override が 403 になったため、正しい runner 権限で再実行して pass を確認した。
- 既存 benchmark dataset が明示的に別 source/docType filter を指定する場合、runner は suite filter を自動付与しない。
