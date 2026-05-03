# 要件定義（1要件1ファイル）

- 要件ID: `FR-016`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2機能群:
  - `3.4 検索結果評価`
- L3要件: `FR-016`
- 関連カテゴリ: なし

## 要件

- FR-016: 検索実行後に、システムは検索結果の品質を評価し、次に取る検索行動または拒否判断を選択すること。

## 受け入れ条件（この要件専用）

- AC-FR016-001: 評価結果に `retrievalQuality`、`missingFacts`、`nextAction`、`reason` が含まれること。
- AC-FR016-002: `retrievalQuality` は `sufficient`、`partial`、`irrelevant`、`conflicting` のいずれかで表されること。
- AC-FR016-003: `partial` の場合、iteration と search budget の範囲内で query rewrite、追加 evidence search、context expansion のいずれかへ進めること。
- AC-FR016-004: `irrelevant` または `conflicting` が解消できない場合、回答生成前に拒否へ進めること。

## 要件の源泉・背景

- 源泉: ユーザー提示の CRAG 方針、現行 `evaluateSearchProgress` の実装確認。
- 背景: 現行評価は件数、top score、反復回数、新規 evidence 数に依存しており、必要事実が埋まったかを見ていない。

## 要件の目的・意図

- 目的: 検索を続けるか、検索方針を変えるか、拒否するかを根拠付きで選べるようにする。
- 意図: CRAG の retrieval evaluator を社内資料限定の検索制御として導入する。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-016` |
| 説明 | 検索結果品質を評価して次 action を決める |
| 根拠 | score だけでは回答可能性を判断できない |
| 源泉 | ユーザー提示方針、現行コード調査 |
| 種類 | 機能要求 |
| 依存関係 | `retrievedChunks`、`iteration`、`searchBudget`、`FR-017` |
| 衝突 | evaluator の誤判定で過剰検索または早期拒否が起きうる |
| 受け入れ基準 | `AC-FR016-001` から `AC-FR016-004` |
| 優先度 | S |
| 安定性 | Medium |
| 変更履歴 | 2026-05-01 初版 / 2026-05-02 `retrieval_evaluator` 実装 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | plan / act 強化の中核 |
| 十分性 | OK | 品質分類と next action を含む |
| 理解容易性 | OK | 4分類と action で明確 |
| 一貫性 | OK | 現行 searchDecision を拡張できる |
| 標準・契約適合 | OK | 外部検索なしの方針に合う |
| 実現可能性 | OK | node 追加で実装可能 |
| 検証可能性 | OK | trace と分岐で確認可能 |
| ニーズ適合 | OK | 検索不足と不正回答の両方を減らす |
