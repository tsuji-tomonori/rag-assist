# benchmark CI と coverage gate の作業レポート

## 指示

- benchmark も CI で test を確認し、結果を PR コメントに入れる。
- C0 90% 以上、C1 85% 以上を目標にする。
- 現実的でなければ `tasks/` に coverage 改善計画を入れて対応する。

## 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | CI で benchmark test を実行する | 対応 |
| R2 | PR コメントに benchmark test 結果を含める | 対応 |
| R3 | C0 90% / C1 85% を確認する | 対応 |
| R4 | 未達なら coverage 改善計画 task を作る | 対応 |
| R5 | 未実施・未達を達成済み扱いしない | 対応 |

## 検討・判断

- 既存 CI は benchmark の type-check と build のみで、`npm test -w @memorag-mvp/benchmark` は未実行だったため、CI step と PR コメント行を追加した。
- Web は既存 `vitest.config.ts` で C0 90% / C1 85% gate を持っていたため、そのまま実測確認した。
- API は C1 85% gate を試したが、C1 81.62% で未達だった。全 test は pass しており、coverage 改善だけで gate 化するには追加 test が必要なため、CI を無理に落とす変更は見送った。
- PR コメントでは API/Web の C0/C1 と target 判定を表示し、API C1 未達時は改善計画 task を示すようにした。

## 実施作業

- `.github/workflows/memorag-ci.yml` に `Test benchmark` step を追加した。
- CI の PR コメント表に benchmark test 行を追加した。
- CI の最終 failure 判定に `benchmark_test` を追加した。
- coverage 表示を C0 90% / C1 85% の target 付きにし、API C1 未達時は改善計画 task を参照するようにした。
- `tasks/do/20260507-2012-benchmark-ci-coverage.md` を作成した。
- `tasks/todo/20260507-2012-api-c1-coverage-improvement.md` を作成した。

## 成果物

| 成果物 | 内容 |
|---|---|
| `.github/workflows/memorag-ci.yml` | benchmark test の CI 実行、PR コメント、failure 判定を追加 |
| `tasks/do/20260507-2012-benchmark-ci-coverage.md` | 今回作業の受け入れ条件と検証計画 |
| `tasks/todo/20260507-2012-api-c1-coverage-improvement.md` | API C1 85% gate 化へ向けた改善計画 |
| `reports/working/20260507-2012-benchmark-ci-coverage.md` | 本作業レポート |

## 検証

- `npm ci`: pass
- `npm test -w @memorag-mvp/benchmark`: pass。34 tests pass。
- `npm exec -w @memorag-mvp/api -- c8 --check-coverage --statements 90 --branches 85 --functions 90 --lines 90 --reporter=text-summary --reporter=json-summary tsx --test src/**/*.test.ts src/**/**/*.test.ts`: fail。168 tests は pass、C0 93.66%、C1 81.62%、functions 94.84%、lines 93.66%。C1 85% 未達。
- `npm run test:coverage -w @memorag-mvp/api`: pass。159 tests pass、C0 93.63%、C1 81.5%、functions 94.84%、lines 93.63%。
- `npm run test:coverage -w @memorag-mvp/web`: pass。26 files / 157 tests pass、C0 91.95%、C1 85.08%、functions 90.6%、lines 94.93%。
- `git diff --check`: pass。
- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/memorag-ci.yml"); puts "yaml ok"'`: pass。

## Fit 評価

総合fit: 4.7 / 5.0（約94%）

理由: benchmark test の CI 追加と PR コメント反映は対応済み。Web は C0/C1 目標を達成済み。API C1 85% は実測で未達だったため、達成済みとは扱わず改善計画 task を作成した。API C1 gate 化そのものは未完了だが、ユーザー指示の分岐条件に沿って計画化している。

## 未対応・制約・リスク

- API C1 85% gate は未達のため、今回の CI では強制していない。
- `npm audit` は 1 moderate vulnerability を報告したが、今回の変更範囲外のため修正していない。
- CI 上での PR コメント投稿結果は、PR 作成後の GitHub Actions 実行で確認が必要。
