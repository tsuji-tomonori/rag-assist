# 要件定義（1要件1ファイル）

- 要件ID: `FR-019`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `7. 評価・debug・benchmark`
- L2主機能群: `7.5 benchmark 指標`
- L3要件: `FR-019`
- 関連カテゴリ: なし


## 要件

- FR-019: benchmark runner は、回答可否だけでなく fact coverage、faithfulness、context relevance、不回答精度を評価できること。

## 受け入れ条件（この要件専用）

- AC-FR019-001: dataset row は `requiredFacts` または `expectedFactSlots` を指定できること。
- AC-FR019-002: summary は `fact_slot_coverage`、`faithfulness`、`context_relevance`、`refusal_precision`、`refusal_recall` を出力できること。
- AC-FR019-003: 未実施の LLM judge 評価は実施済みとして表示しないこと。
- AC-FR019-004: benchmark report は既存の answerable、citation、expected file 指標を維持すること。
- AC-FR019-005: retrieval evaluator が LLM judge を実行した場合、benchmark summary は judge 発火率、判定 label 内訳、解消率を出力できること。
- AC-FR019-006: Markdown report の Metrics 表は `metric`、`value`、`説明` の列を持ち、各 metric の意味を日本語で説明すること。
- AC-FR019-007: 図面 benchmark は optional field がある場合に限り、region recall、extraction accuracy、count MAPE、graph resolution accuracy を出力し、未指定の場合は未評価として扱うこと。

## Markdown report 指標説明

benchmark runner は report の Metrics 表で、値だけでなく運用者が読み取るべき意味を `説明` 列に出力する。

| 列 | 説明 |
|---|---|
| `metric` | summary JSON に対応する機械可読な指標名 |
| `value` | benchmark 実行結果から集計した値。未評価の場合は `-` |
| `説明` | 指標が何を測っているか、また高低どちらを重視するかを日本語で示す |

代表的な指標の意味は次の通り。

| metric | 説明 |
|---|---|
| `answerable_accuracy` | 回答可能な行で、期待語句・正規表現・引用・期待資料などの判定を満たした割合 |
| `expected_file_hit_rate` | citation または `finalEvidence` に期待ファイルまたは期待 document が含まれた割合 |
| `retrieval_recall_at_20` | 上位 20 件の raw `retrieved` に期待ファイルまたは期待 document が含まれた割合 |
| `region_recall_at_k` | evaluator profile の retrieval K 内で期待 region id が raw `retrieved` に含まれた割合 |
| `extraction_accuracy` | 抽出 artifact の正規化値が dataset の期待抽出値と一致した割合 |
| `count_mape` | 検出・抽出された count と期待 count の平均絶対パーセント誤差。低いほどよい |
| `graph_resolution_accuracy` | 詳細図・断面・参照先などの graph resolution が期待 target に到達した割合 |
| `fact_slot_coverage` | `expectedFactSlots` のうち、回答文、citation、または `finalEvidence` で支持できた fact slot の平均割合 |
| `refusal_precision` | 拒否した行のうち、dataset 上も回答不能だった割合 |
| `refusal_recall` | 回答不能な行のうち、実際に拒否できた割合 |
| `unsupported_sentence_rate` | answerSupport が検出した非支持文の割合。低いほど根拠に忠実 |
| `llm_judge_invocation_rate` | LLM judge が 1 回以上実行された行の割合 |
| `p95_latency_ms` | 初回 API call latency の 95 パーセンタイル |

## 要件の源泉・背景

- 源泉: ユーザー提示の UAEval4RAG / RAGAS / ARES 方針、現行 `benchmark/run.ts` の実装確認。
- 背景: 現行 benchmark は answerable accuracy、abstention recall、unsupported answer rate、citation hit rate などを持つが、fact 単位の網羅性と faithfulness の評価が不足している。

## 要件の目的・意図

- 目的: 改善施策が実際に不回答品質と根拠性を改善したかを測れるようにする。
- 意図: 実装順の判断を主観ではなく benchmark 結果に寄せる。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-019` |
| 説明 | benchmark runner を fact と根拠性評価へ拡張する |
| 根拠 | 検索と回答許可の改善には測定基盤が必要 |
| 源泉 | ユーザー提示方針、現行コード調査 |
| 種類 | 機能要求 |
| 依存関係 | `/benchmark/query`、`/benchmark/search`、debug trace、dataset format |
| 衝突 | 評価項目が増えると dataset 作成負荷が増える |
| 受け入れ基準 | `AC-FR019-001` から `AC-FR019-005` |
| 優先度 | S |
| 安定性 | Medium |
| 変更履歴 | 2026-05-01 初版 / 2026-05-02 LLM judge 指標を追加 / 2026-05-05 Markdown report の日本語説明列を追加 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | 改善サイクルに必要 |
| 十分性 | OK | dataset と summary の両方を含む |
| 理解容易性 | OK | 追加指標が明確 |
| 一貫性 | OK | 既存 runner の拡張として妥当 |
| 標準・契約適合 | OK | 実施済み誤記禁止を含む |
| 実現可能性 | OK | TypeScript runner に追加可能 |
| 検証可能性 | OK | sample dataset で確認可能 |
| ニーズ適合 | OK | PM判断に必要な測定軸 |
