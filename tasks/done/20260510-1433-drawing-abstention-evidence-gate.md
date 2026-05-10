# 建築図面 QA の evidence sufficiency と abstention を強化する

保存先: `tasks/done/20260510-1433-drawing-abstention-evidence-gate.md`

状態: done

タスク種別: 機能追加

## 作業チェックリスト

- [x] 既存 answerability / support / benchmark metric の実装を確認する。
- [x] 図面 QA 用の evidence sufficiency rule を runner に追加する。
- [x] source hierarchy と normalized value mismatch を評価できる入力・判定を追加する。
- [x] abstain / unsupported metric と report 出力をテストで固定する。
- [x] docs と作業レポートを更新し、検証後に PR コメントまで完了する。

## Done 条件

- 根拠 bbox、source hierarchy、normalized value match の不足を通常回答 failure として検出できる。
- 回答不能行では refusal を正しく評価し、unsupported answer と分けて集計できる。
- 既存 benchmark dataset で新フィールド未設定時の互換性を壊さない。
- benchmark workspace の unit test / typecheck と `git diff --check` が通る。

## 背景

社内 QARAG では、回答率よりも根拠なし回答を減らすことが重要である。建築図面 QA では、根拠 bbox、図面種別一致、抽出値と生成回答の正規化一致がそろわない場合に答えない仕組みが必要になる。

## 目的

建築図面 QARAG に evidence sufficiency gate を導入し、回答不能、根拠不足、標準図と案件図面の矛盾を明示的に扱う。

## 対象範囲

- answerability gate
- answer support verifier
- source hierarchy
- benchmark evaluator / metrics
- docs / tests

## 方針

通常 RAG の answerability / support verifier を再利用しつつ、図面 QA では `bbox exists`、`source_type priority`、`normalized value match` を追加条件にする。根拠が足りない場合は unsupported answer を返さず、回答不能として trace に理由を残す。

## 必要情報

- 既存 `verify_answer_support` 設計
- unanswerable benchmark set task
- source_type metadata の現行仕様
- dimension normalizer / region index task の成果

## 実行計画

1. 建築図面 QA の sufficiency rule を定義する。
2. source hierarchy を answer generation 前に適用する。
3. bbox なし / source mismatch / normalized mismatch の failure reason を trace に追加する。
4. abstain_accuracy と unsupported_answer_rate を benchmark summary に出す。
5. 回答不能 seed QA または negative cases を追加する。

## ドキュメントメンテナンス計画

回答不能、unsupported answer、source hierarchy、benchmark 指標を要求、設計、運用 docs に反映する。

## 受け入れ条件

- [x] AC1: 根拠 bbox がない回答値は通常回答として正解扱いされない。
- [x] AC2: 案件図面と標準図の優先順位が score ではなく rule で適用される。
- [x] AC3: normalized extracted value と generated answer の不一致を検出できる。
- [x] AC4: benchmark summary が abstain_accuracy と unsupported_answer_rate を分けて出す。

## 検証計画

- answerability / support verifier unit test
- benchmark evaluator test
- unanswerable / conflicting evidence sample
- `git diff --check`

## 検証結果

- `npm ci`: pass。ただし既存の npm audit 脆弱性 3件（moderate 1、高 2）が報告された。
- `npm run test --workspace @memorag-mvp/benchmark`: pass
- `npm run typecheck --workspace @memorag-mvp/benchmark`: pass
- `git diff --check`: pass

## PRレビュー観点

- refusal precision と answerable accuracy の tradeoff が PR 本文に記録されているか。
- 根拠不足時の UI / API 表示が架空値で埋められていないか。
- source hierarchy が ACL や group boundary を弱めていないか。

## 未決事項・リスク

- 決定事項: 建築図面 QA では bbox evidence を通常回答の必須条件にする。
- リスク: 初期 OCR / detection が弱い段階では回答不能が増え、answerable accuracy が短期的に下がる可能性がある。
