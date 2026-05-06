# Benchmark Evaluator Profile の導入

保存先: `tasks/todo/20260506-1203-benchmark-evaluator-profiles.md`

## 状態

- todo

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
- profile id と version は summary JSON / report Markdown / baseline comparison に必ず記録する。
- 異なる evaluator profile 同士の baseline comparison は default では不可とし、明示 option がある場合だけ参考比較として扱う。
- profile 未指定の既存 dataset は `default@1` に解決する。

## 必要情報

- 前提タスク: `tasks/todo/20260506-1203-rag-policy-profile.md`
- 関連ファイル:
  - `benchmark/run.ts`
  - `benchmark/search-run.ts`
  - `benchmark/metrics/quality.ts`
  - `benchmark/metrics/retrieval.ts`
- 既存の sample dataset は変更時の互換性確認に使う。
- 関連要求・設計:
  - `FR-012`, `FR-019`, `SQ-001`
  - `NFR-010`, `NFR-012`
  - `ASR-EVAL-001`, `ASR-SEC-*`

## 実行計画

1. 現在の benchmark 判定ロジックと threshold を棚卸しする。
2. evaluator profile schema を定義する。
3. row / suite から profile を解決する処理を追加する。
4. default evaluator profile に既存挙動を移す。
5. report / summary JSON に profile と threshold を出す。
6. sample dataset に profile 未指定時の互換テストを追加する。
7. profile mismatch 時の baseline comparison の扱いを実装する。
8. 必要に応じて suite-specific profile の sample を追加する。
9. benchmark docs / operations docs に profile と比較ルールを記載する。

## ドキュメントメンテナンス計画

- 要求仕様: `FR-012`、`FR-019`、`SQ-001` の benchmark runner、fact coverage、faithfulness、不回答精度、baseline comparison の受け入れ条件更新要否を確認する。
- architecture / design: evaluator profile、dataset row / suite config、summary JSON、report Markdown、baseline comparison の schema / workflow を `DES_HLD_001`、`DES_DATA_001`、`DES_API_001` に反映する。
- README / API examples / OpenAPI: benchmark API や artifact schema が変わる場合は API examples / OpenAPI を更新する。CLI / dataset だけの変更なら README / benchmark docs / operations を優先する。
- local verification / operations: `task benchmark:sample`、results JSONL、summary JSON、report Markdown、profile mismatch 時の確認方法を `docs/LOCAL_VERIFICATION.md` と `docs/OPERATIONS.md` に追記する。
- PR 本文: dataset / suite の後方互換、profile id / version、baseline comparison の扱い、未確認 benchmark を明記する。

## 受け入れ条件

- profile 未指定の既存 dataset が既存同等に評価される。
- row または suite が evaluator profile を指定できる。
- retrieval K や regression threshold を profile で変更できる。
- benchmark report に使用 profile が表示される。
- benchmark metrics tests が profile あり / なしを確認している。
- profile id / version が results JSONL、summary JSON、report Markdown に出力される。
- 異なる profile の baseline comparison は default で失敗または warning になり、明示 option なしに成功扱いされない。
- benchmark artifact に通常利用者へ出してはいけない debug trace、ACL metadata、raw prompt が混入しない。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/benchmark`
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/benchmark`
- `task benchmark:sample`
- `git diff --check`

## PRレビュー観点

- semver は、dataset row / suite config の optional field 追加なので `minor` を推奨する。既存 dataset 完全互換のみなら `patch` も可能だが理由を書く。
- PR 本文に evaluator profile の目的、既存 dataset 互換、baseline comparison の扱い、未確認 benchmark を書く。
- metric 追加・変更が dataset、summary JSON、report Markdown、baseline comparison と整合しているか確認する。
- answerable / unanswerable / expectedContains / expectedFiles / expectedPages / fact slot の扱いが壊れていないか確認する。
- NaN / undefined が summary に出ないか、latency / unsupported rate / refusal precision を含めて確認する。
- benchmark artifact の公開範囲と debug / ACL / raw prompt の混入を確認する。

## 未決事項・リスク

- 未決事項なし。
- 決定事項: benchmark package の test script は存在するため、`npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/benchmark` を標準検証にする。
- 決定事項: profile 未指定の既存 dataset は `default@1` に解決する。
- 決定事項: evaluator profile が異なる baseline comparison は default では不可または warning とし、明示 option がある場合だけ参考比較にする。
- リスク: evaluator profile が増えると過去結果との単純比較が難しくなるため、profile id / version の出力漏れは blocking として扱う。
