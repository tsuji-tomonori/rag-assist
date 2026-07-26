# Issue #359 benchmark 正本 path の一本化

- 状態: done
- タスク種別: 修正
- 対象 issue: #359 Phase 2（PR 2a〜2c の第一段、完全収束を目標）
- 作業ブランチ: `codex/issue-359-benchmark-canonical-path`
- 起点: `origin/main` (`e12abb07`)

## 受けた指示

workspace 未接続の `benchmarks/` に残る suite / schema / script / config / fixture を分類し、必要資産を workspace 正本 `benchmark/` 配下へ移管する。全内部参照・README・task docs を同期し、旧 root path の不在と再導入防止 guard を既存 `@memorag-mvp/benchmark` test 経路へ接続する。sample suite validator、init / run contract dry-run、secret hygiene、artifact path / redaction、benchmark full test / typecheck / build、root CI を検証する。

`benchmark/release-audit.ts` と `benchmark/release-audit.test.ts` は PR #366 と重複するため変更しない。benchmark dataset / runner / 認可契約、期待語句、QA sample 固有値、dataset 固有分岐を product runtime へ移さない。

## なぜなぜ分析 / RCA

### 現象

root workspace の正本は `benchmark/` である一方、未接続の `benchmarks/` に58個の benchmark contract 資産が残り、README と shell / validator が複数形 path を自己参照している。

### なぜ 1: なぜ二重 root が残ったか

既存 runner workspace `benchmark/` と別に suite contract の責務分離を先行設計した際、workspace への統合前に `benchmarks/` として追加されたため。

### なぜ 2: なぜ CI で検知されなかったか

`benchmark/package.json` の `test` は `*.test.ts` と `metrics/**/*.test.ts` のみを実行し、`benchmarks/_shared/scripts/validate-suite.test.mjs` は未接続だったため。

### なぜ 3: なぜ単純削除できないか

未接続 tree には schema、validator、negative test、secret hygiene、artifact ignore、sample suite、最小 PDF fixture があり、正本側に同等 contract がないため。削除すると将来の suite 入力検証と安全境界が失われる。

### 根本原因

suite contract の導入時に、workspace 正本 path、test 接続、旧 root 再導入 guard、移管完了条件を同一変更として完結させていなかった。

### 恒久対策

58ファイルを `benchmark/{README.md,_shared,suites}` へ履歴保持で移管し、内部 path を単数形へ変更する。validator test を既存 benchmark test script に接続し、旧 root directory と active repository の filesystem path 参照を検査する guard を追加する。

## 全参照調査

検索対象は source、tests、scripts、tools、docs、skills、workflows、package scripts、Taskfile、Node dynamic import / `require` / `new URL` / `resolve` 文字列。既存履歴の `tasks/`、`reports/` と生成 docs は利用判定から除外した。

| 参照種別 | 確認結果 | 判定 |
| --- | --- | --- |
| package workspace | root `package.json` は `benchmark` のみ | 正本は単数形 |
| source / runtime import | repo root `benchmarks/` への import / dynamic import 0件 | 移管可能 |
| tests | `benchmarks/_shared/scripts/validate-suite.test.mjs` が sample suite と旧 path を自己参照 | 移管・参照更新・既存 test 経路へ接続 |
| scripts | `_shared/scripts` と suite `init.sh` が内部 path を自己参照 | 移管・参照更新 |
| tools / skills / workflows / Taskfile | repo root `benchmarks/` filesystem path 参照 0件 | 変更不要 |
| docs | `benchmarks/README.md` と suite README のみ旧 path を説明 | `benchmark/` へ移管・更新 |
| artifacts | `artifacts/benchmarks/` と tracked `.gitignore` | 実行生成物の外部 contract。preserve |
| API test | `datasetS3Key: "benchmarks/approved-suite.jsonl"` が2件 | repository path ではない S3 object key。preserve・guard allowlist |
| open PR #366 | `benchmark/release-audit.ts` / `.test.ts` を変更 | 本 PR では変更禁止。対象移管ファイルと直接重複なし |

## preserve / migrate / delete 表

| 分類 | 現在 | 移管先 / 扱い | 件数 | 理由 |
| --- | --- | --- | ---: | --- |
| migrate | `benchmarks/README.md` | `benchmark/README.md` | 1 | singular workspace の suite contract 導線 |
| migrate | `benchmarks/_shared/configs/**` | `benchmark/_shared/configs/**` | 8 | answer policy / promotion gate / target config |
| migrate | `benchmarks/_shared/evaluators/**` | `benchmark/_shared/evaluators/**` | 6 | suite evaluator contract |
| migrate | `benchmarks/_shared/fixtures/**` | `benchmark/_shared/fixtures/**` | 4 | reusable conversation / permission fixtures |
| migrate | `benchmarks/_shared/schemas/**` | `benchmark/_shared/schemas/**` | 7 | suite / corpus / case / result / artifact schema |
| migrate | `benchmarks/_shared/scripts/**` | `benchmark/_shared/scripts/**` | 11 | validator、negative tests、contract-only runner scripts |
| migrate | `benchmarks/suites/**` | `benchmark/suites/**` | 21 | sample suite、config、expected、permission fixtures、最小 synthetic PDF |
| preserve | `artifacts/benchmarks/.gitignore` | 変更なし | 1 | artifact output contract。repository source root ではない |
| preserve | API test の `benchmarks/approved-suite.jsonl` | 変更なし | 2参照 | S3 dataset key contract。filesystem path ではない |
| preserve | `benchmark/release-audit*` | 変更禁止 | 2 | PR #366 と重複 |
| delete | root `benchmarks/` directory | 全 migrate 後に不在 | directory | 二重正本を解消。直接削除する資産ファイルなし |
| merge | なし | - | 0 | singular tree に同等 suite contract がない |
| retain externally | なし | - | 0 | PDF は数百 byte の synthetic placeholder で外部 binary / license 依存なし |

## 作業範囲

- `git mv` による全58ファイルの履歴保持移管
- README、validator、test、suite init の内部 path 更新
- benchmark package test への validator test 接続
- old root directory / active filesystem reference の再導入 guard
- sample suite validator と contract-only init / run dry-run
- task / 作業完了レポート / PR lifecycle

## 対象外

- `benchmark/release-audit.ts` / `benchmark/release-audit.test.ts`
- benchmark dataset / runner / API / 認可 / promotion policy の挙動変更
- `artifacts/benchmarks/` output contract や S3 dataset key の改名
- product runtime への benchmark 固有値・期待語句・dataset 分岐追加
- merge / deploy / release

## 受け入れ条件

- [x] `benchmarks/` の58ファイルが履歴を保って `benchmark/{README.md,_shared,suites}` へ移管され、旧 root directory が存在しない。
- [x] README、suite init、validator、validator test の filesystem path が `benchmark/` 正本を参照する。
- [x] validator test が `npm test -w @memorag-mvp/benchmark` で実行される。
- [x] guard が旧 root directory と active source / tests / scripts / tools / docs / skills / workflows の旧 filesystem path 再導入を検知する。
- [x] `artifacts/benchmarks/` と S3 key `benchmarks/approved-suite.jsonl` は意味を変えず、guard の明示 allowlist として記録される。
- [x] sample suite validator が成功する。
- [x] `init.sh` dry-run が validation-only artifact を `/tmp` に出し、secret / source data を含まない。
- [x] `run-suite.sh` dry-run が blocked contract artifact を `/tmp` に出し、secret / unauthorized document / judge prompt を含まない。
- [x] secret hygiene、artifact ignore / path、redaction contract の validator tests が成功する。
- [x] `npm test -w @memorag-mvp/benchmark`、typecheck、build が成功する。
- [x] `npm run ci`、関連 docs check、`git diff --check`、pre-commit が成功する。
- [x] `benchmark/release-audit*` に差分がない。
- [x] PR #366 との重複なし、残余競合リスクを PR と report に記録する。
- [x] 日本語 PR、受け入れ条件コメント、セルフレビュー、task done、作業完了レポートを完了する。

## PR lifecycle

- PR: #370 `♻️ benchmark正本パスを一本化`
- label: `semver:patch`
- 受け入れ条件コメント: GitHub Apps で記録済み
- セルフレビュー: blocking 指摘なしとして GitHub Apps で記録済み
- merge / deploy / release: 未実施（対象外）

## 検証計画

1. `node benchmark/_shared/scripts/validate-suite.mjs --suite-dir benchmark/suites/internal_qa/leave_policy_v1`
2. `node --test benchmark/_shared/scripts/validate-suite.test.mjs`
3. `benchmark/suites/internal_qa/leave_policy_v1/init.sh --out /tmp/...`
4. `benchmark/_shared/scripts/run-suite.sh --spec benchmark/suites/internal_qa/leave_policy_v1/benchmark.run.json --out /tmp/...`
5. `/tmp` artifact の schema / path / secret / redaction 確認
6. `npm test -w @memorag-mvp/benchmark`
7. `npm run typecheck -w @memorag-mvp/benchmark`
8. `npm run build -w @memorag-mvp/benchmark`
9. `npm run ci`
10. relevant docs / hidden Unicode / diff / pre-commit checks

## ドキュメント影響

suite contract の正本 README と sample suite README の path を更新する。製品要件・API・運用挙動は変わらないため canonical product docs と generated API / Web inventory の更新は不要。README 変更は既存構造説明の path correction に限定する。
