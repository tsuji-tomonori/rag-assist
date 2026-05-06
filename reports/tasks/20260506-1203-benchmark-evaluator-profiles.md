# Benchmark Evaluator Profile の導入

保存先: `reports/tasks/20260506-1203-benchmark-evaluator-profiles.md`

## 背景

benchmark / evaluation では、`expectedContains` の includes 判定、`expectedRegex`、`資料からは回答できません` / `noanswer` 判定、recall@20、regression threshold などが固定されている。これは本番判定ではないため許容しやすいが、評価対象や suite が増えると固定 evaluator では比較が難しくなる。

## 目的

benchmark row または suite ごとに evaluator profile を指定できるようにし、期待判定と regression threshold を dataset / suite 側へ寄せる。

## 対象範囲

- `memorag-bedrock-mvp/benchmark/run.ts`
- `memorag-bedrock-mvp/benchmark/search-run.ts`
- `memorag-bedrock-mvp/benchmark/metrics/retrieval.ts`
- `memorag-bedrock-mvp/benchmark/metrics/quality.ts`
- benchmark dataset JSONL
- benchmark docs / reports

## 方針

- `evaluatorProfile` を dataset row または suite config に追加する。
- profile には answer matching、no-answer matching、retrieval K、regression thresholds、fact-slot evaluation options を持たせる。
- 既存 dataset は default evaluator profile として後方互換にする。
- report には使用 evaluator profile と threshold を出力する。

## 必要情報

- 前提タスク: `reports/tasks/20260506-1203-rag-policy-profile.md`
- 関連ファイル:
  - `benchmark/run.ts`
  - `benchmark/search-run.ts`
  - `benchmark/metrics/quality.ts`
  - `benchmark/metrics/retrieval.ts`
- 既存の sample dataset は変更時の互換性確認に使う。

## 実行計画

1. 現在の benchmark 判定ロジックと threshold を棚卸しする。
2. evaluator profile schema を定義する。
3. row / suite から profile を解決する処理を追加する。
4. default evaluator profile に既存挙動を移す。
5. report / summary JSON に profile と threshold を出す。
6. sample dataset に profile 未指定時の互換テストを追加する。
7. 必要に応じて suite-specific profile の sample を追加する。

## 受け入れ条件

- profile 未指定の既存 dataset が既存同等に評価される。
- row または suite が evaluator profile を指定できる。
- retrieval K や regression threshold を profile で変更できる。
- benchmark report に使用 profile が表示される。
- benchmark metrics tests が profile あり / なしを確認している。

## 検証計画

- `npm --prefix memorag-bedrock-mvp/benchmark test`
- `task benchmark:sample`
- `git diff --check`

## 未決事項・リスク

- benchmark package の test script が存在しない場合は、該当 metrics tests を個別に実行する必要がある。
- evaluator profile を増やすと過去 benchmark との単純比較が難しくなるため、profile version の記録が必須。
