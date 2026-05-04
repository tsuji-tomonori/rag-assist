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
| 変更履歴 | 2026-05-01 初版 / 2026-05-02 LLM judge 指標を追加 |

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
