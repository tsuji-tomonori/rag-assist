# 建築図面 benchmark page gate 修正

- 作成日時: 2026-05-12 20:20
- タスク種別: 修正
- 状態: do

## 背景

`architecture-drawing-qarag-v0.1` の strict accuracy が、回答内容ではなく `expected_page_not_hit` によって 0% へ過度に悪化している。現状の benchmark runner は `expectedPages` がある行で citation / finalEvidence に page evidence がない場合も一律で miss とし、その結果を `answerCorrect` の必須 gate にしている。

## 目的

page metadata が返らない run を page miss と誤判定せず、回答内容・ファイル根拠・ページ根拠を分離して評価できるようにする。

## スコープ

- `memorag-bedrock-mvp/benchmark/run.ts` の評価ロジックと summary/report metric。
- `memorag-bedrock-mvp/benchmark/run.test.ts` の regression test。
- 関連 README / OPERATIONS / benchmark 指標要求 docs の最小更新。
- 作業レポート、commit、PR、PR コメント。

## 対象外

- API citation への `pageOrSheet` / `regionId` / `bbox` 追加。
- 図面 dataset row の hidden context 修正。
- false refusal / extractor / visual retrieval 本体の改善。

## なぜなぜ分析サマリ

### 問題文

2026-05-12 時点の `architecture-drawing-qarag-v0.1` run で、回答可能行の strict accuracy が `expected_page_not_hit` により 0% と表示され、回答内容や期待ファイル到達の実力が見えにくくなっている。

### 確認済み事実

- `benchmark/run.ts` は `expectedPages.length > 0` の場合に `hasExpectedPageHit([...citations, ...finalEvidence], expectedPages)` を必ず評価している。
- `answerCorrect` は `expectedPageHit !== false` を必須条件にしている。
- API citation の `toCitation()` は `pageStart` / `pageEnd` を返す導線を持つが、図面 sheet label の `pageOrSheet` は citation に返していない。
- `architecture-drawing-qarag.ts` は `qa.pageOrSheet` を `expectedPages` に入れている。

### 推定原因

- evaluator が「expectedPages が指定されている」ことと「実行結果が page evidence を持つ」ことを同一視している。
- 図面の page/sheet label と numeric page metadata の差を、評価器側で `not_applicable` として扱う導線がない。

### 根本原因

page evidence の観測可能性を判定する前に page hit を strict gate として扱う設計になっており、metadata 未整備 run の評価不能状態を失敗として集計している。

### 対策方針

- citation / finalEvidence / retrieved に page metadata が観測できない場合、`expectedPageHit` を `null` とし `expected_page_not_hit` を出さない。
- 回答内容、期待ファイル grounding、期待ページ grounding の metric を分離する。
- page metadata がある行では従来どおり page hit / miss を評価する。

## 受け入れ条件

- [x] AC1: citation / finalEvidence / retrieved に page metadata がない run では、`expectedPageHit` と `expected_page_hit_rate` が `not_applicable` になる。
- [x] AC2: page metadata が存在する run では、期待 page に当たらない場合に `expected_page_not_hit` が残る。
- [x] AC3: `answer_content_accuracy`、`grounded_file_accuracy`、`grounded_page_accuracy` が summary / Markdown report に出力される。
- [x] AC4: `answerable_accuracy` は page metadata 不在だけでは 0% 化しない。
- [x] AC5: benchmark regression test と benchmark typecheck が pass する。
- [x] AC6: README / OPERATIONS / benchmark 指標要求 docs が変更後の metric 意味に同期している。

## 実装計画

1. `run.ts` に page evidence presence 判定を追加する。
2. `answerContentCorrect`、`groundedFileCorrect`、`groundedPageCorrect` を評価結果に追加する。
3. summary / dependency metrics / report / threshold metric handling を更新する。
4. `run.test.ts` に page metadata 不在と page metadata あり miss の regression test を追加する。
5. docs を最小更新する。
6. targeted validation を実行する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark -- run.test.ts`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`
- `git diff --check`

## PR レビュー観点

- page metadata がないことを成功扱いにせず、`not_applicable` として分離できているか。
- page metadata がある場合の strict page grounding 評価を弱めていないか。
- 新 metric が既存 suite の互換性を壊していないか。

## リスク

- `answerable_accuracy` の意味が従来より content/file 寄りになるため、strict page grounding を見たい利用者には `grounded_page_accuracy` を案内する必要がある。
- API citation metadata 追加は後続 PR のため、今回だけでは `expected_page_hit_rate` の値自体は改善しない。

## 実施結果

- `run.ts` に page metadata 観測判定と `answerContentCorrect` / `groundedFileCorrect` / `groundedPageCorrect` を追加した。
- `run.test.ts` に、page metadata 不在行が `expectedPageHit=null` かつ `answerCorrect=true` になり、page metadata miss 行が `expected_page_not_hit` になる regression test を追加した。
- README、OPERATIONS、REQ_FUNCTIONAL_019 に metric の意味を追記した。

## 検証結果

- `npm ci`: pass。既存依存関係に 3 vulnerabilities（moderate 1、高 2）が報告されたが、依存更新は今回の範囲外。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark -- run.test.ts`: pass。npm script の glob 定義により benchmark test 全体 80 件が実行され、80 pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass。
- `git diff --check`: pass。
