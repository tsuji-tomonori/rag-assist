# jp-public-pdf-qa-v1 P0 精度・誤拒否修正

状態: done

## 背景

`jp-public-pdf-qa-v1` の非OCR 16問で、期待ファイルは取得できている一方、回答本文に期待語句が落ちず、false refusal も発生している。OCR系8問は `ocr_timeout` により評価対象外であり、今回の主対象は非OCR PDFの検索後段である。

## 目的

検索済み根拠から回答生成へ渡る過程で、不要な computation 実行、金額誤分類、過剰 refusal、回答スロット欠落を抑制し、非OCR PDF QA の P0 失敗要因を改善する。

## タスク種別

修正

## なぜなぜ分析サマリ

### 問題文

`jp-public-pdf-qa-v1` の非OCR 16問で、retrieval recall は期待ファイル単位で 100% だが、answerable accuracy と answer contains rate が 0% になり、4件の false refusal が発生している。

### 確認済み事実

- ユーザー提示の集計では `retrieval_recall_at_k = 100%`、`retrieval_mrr_at_k = 1`。
- 非OCR 16問は HTTP success 16/16 だが、`answerable_accuracy = 0.0%`、`answer_contains_rate = 0.0%`。
- OCR PDF 8問は `ocr_timeout` で ingest されず、今回の 0% accuracy には含まれていない。
- `円滑な入退院` の `円` が money signal として扱われている疑いがある。
- `extract_policy_computations` は今回 computed facts が 0 のままレイテンシを増やしている。

### 推定原因

- retrieval metric がファイル到達を見ており、節・項目・事実スロット到達の不足を隠している。
- 回答生成がスロット充足ではなく要約寄りで、項目数・場所・組織・節番号などを落としている。
- sufficient context / answer generation の refusal 判定が、根拠候補の存在を十分に考慮していない。
- money detector が「数値 + 単位」ではなく単位文字寄りに発火している。

### 未確認事項

- 現行実装で computation node がどの条件で呼ばれるか。
- 現行 sufficient context / answer generation の exact phrase / heading hit の扱い。
- 既存テストの粒度と追加すべき最小テスト。

### 根本原因

検索後段の計画・十分性判定・回答生成が、質問要求のスロットと根拠候補の構造を機械的に保持・検査する設計になっておらず、LLM 判定や要約に寄りすぎている。さらに、不要な computation と日本語 money signal の誤判定が遅延と false refusal を助長している。

### 対策方針

- 算術・集計が不要な場合は policy computation をスキップする。
- money detector を数値付き単位で発火する形に寄せ、`円滑` など一般語を除外する。
- 根拠候補や partial evidence がある場合は即 refusal にしない。
- 質問文から項目数・日時/場所/組織・節/項目などの required slots を抽出し、回答生成・再生成判定に使う。

## スコープ

- `memorag-bedrock-mvp/apps/api/src/agent/` 配下の RAG agent node / utility / test。
- 必要に応じて benchmark / docs の最小更新。
- OCR ingest の本格修正、TOC / section index の大規模実装は今回の P0 範囲外。

## 実装計画

1. computation 実行条件と graph の node 接続を確認する。
2. money detector / query requirement 抽出箇所を確認し、`円滑` 誤分類を修正する。
3. sufficient context / answer generation / final refusal の条件を確認し、根拠候補ありの即 refusal を抑止する。
4. 質問要求スロット抽出と coverage check を最小実装する。
5. 既存ユニットテストに regression case を追加する。
6. 変更範囲に応じたテストを実行する。

## ドキュメント保守計画

- API 形状やユーザー操作は変えないため、README / OpenAPI の更新は原則不要。
- RAG の回答制御ロジックに durable な説明が既存 docs にある場合は、最小限の追記要否を確認する。
- 作業完了レポートは `reports/working/` に残す。

## 受け入れ条件

- [x] 算術・集計不要の質問で `extract_policy_computations` がスキップされる。
- [x] `円滑な入退院` が money intent / money required fact として扱われない。
- [x] 根拠候補がある `PARTIAL` / `UNANSWERABLE` 判定で即 refusal せず回答生成へ進める。
- [x] 「3項目」「4つ」「いつ・どこ・何」「節・項目」系の質問要求スロットを検出できる。
- [x] スロット不足時に再生成または補正判断へつながる coverage check がある。
- [x] 追加・更新した unit test が通る。
- [x] `git diff --check` が通る。

## 検証計画

- 変更ファイル確認後に最小十分な API / agent unit test を選択する。
- 想定コマンド:
  - `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- <target>`
  - `git diff --check`
- benchmark 全量は時間・外部サービス依存が大きい場合、未実施理由を記録する。

## PR レビュー観点

- benchmark expected text / row id / dataset 固有値を実装へ直書きしていないこと。
- RAG の根拠性を弱めず、根拠候補のあるケースだけ refusal を緩めていること。
- Debug trace にスキップ理由や coverage 判断が残ること。
- 変更範囲に見合う unit test があること。

## リスク

- refusal gate を緩めすぎると、根拠不足時に不確かな回答を出す恐れがある。
- スロット抽出が過度に日本語ベンチ寄りになると一般化を損なう。
- LLM prompt 変更は実測 benchmark で追加確認が必要。

## 実施結果

- `extract_policy_computations` を算術・集計・文書内閾値比較が必要な場合だけ実行するよう条件化した。
- `円滑` など一般語が money 判定にならないよう、money 判定を数値付き金額または金額語に寄せた。
- 質問要求スロット検出を追加し、回答プロンプト、required facts、citation validation、構造チャンク保持に反映した。
- `PARTIAL` / `UNANSWERABLE` でも、answerability と根拠候補がある場合に限定して回答生成へ進める補助判定を追加した。
- `context-assembler` でリスト・節項目系の短いチャンクを丸ごと保持し、最終回答前に項目根拠が落ちる問題を抑制した。

## 検証結果

- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`: pass
- `./node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit`: pass
- `./node_modules/.bin/tsx --test apps/api/src/agent/computation.test.ts apps/api/src/agent/nodes/node-units.test.ts apps/api/src/agent/graph.test.ts apps/api/src/rag/prompts.test.ts apps/api/src/rag/text-processing.test.ts`: pass, 106 tests
- `git diff --check`: pass

## ドキュメント影響

- API 形状、設定キー、運用手順の変更はないため README / OpenAPI / docs 更新は不要と判断した。
- 実装変更の詳細は `reports/working/20260512-0926-jp-public-pdf-qa-p0.md` に記録する。
