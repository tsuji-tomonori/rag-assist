# 要件定義（1要件1ファイル）

- 要件ID: `FR-017`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2機能群:
  - `3.1 検索計画`
- L3要件: `FR-017`
- 関連カテゴリ: なし

## 要件

- FR-017: システムは質問に答えるための `SearchPlan` と許可済み `SearchAction` を state に保持し、実行履歴と観測結果を追跡すること。

## 受け入れ条件（この要件専用）

- AC-FR017-001: `SearchPlan` は `complexity`、`intent`、`requiredFacts`、`actions`、`stopCriteria` を保持すること。
- AC-FR017-002: `SearchAction` は whitelisted action のみを表現し、自由な外部 tool call を許可しないこと。
- AC-FR017-003: 実行済み action と observation が debug trace から確認できること。
- AC-FR017-004: required fact の `supported`、`partially_supported`、`missing`、`conflicting` 状態を更新できること。
- AC-FR017-005: `evidence_search`、`query_rewrite`、`expand_context` は action executor から実行され、`rerank` と `finalize_refusal` は検索 loop の停止 action として扱われること。

## 要件の源泉・背景

- 源泉: ユーザー提示の Plan-and-Act 方針、現行 `planSearch` の実装確認。
- 背景: 現行 `planSearch` は未解決参照抽出と `continue_search` 設定が中心で、構造化された検索計画や action history を持たない。

## 要件の目的・意図

- 目的: 固定ワークフローを壊さずに、検索計画、行動、観測、再計画を追跡可能にする。
- 意図: 社内QA向けに constrained agentic RAG を段階導入する。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-017` |
| 説明 | structured plan と whitelisted action を state に保持する |
| 根拠 | plan / act の監査性と再現性が必要 |
| 源泉 | ユーザー提示方針、現行コード調査 |
| 種類 | 機能要求 |
| 依存関係 | `state.ts`、`graph.ts`、`trace.ts` |
| 衝突 | state 複雑化による保守負荷 |
| 受け入れ基準 | `AC-FR017-001` から `AC-FR017-005` |
| 優先度 | A |
| 安定性 | Medium |
| 変更履歴 | 2026-05-01 初版 / 2026-05-03 action executor 条件を追加 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | 複雑質問への検索制御に必要 |
| 十分性 | OK | plan、action、trace、coverage を含む |
| 理解容易性 | OK | whitelisted action として明確 |
| 一貫性 | OK | 既存 graph に段階追加できる |
| 標準・契約適合 | OK | 外部検索禁止方針と整合 |
| 実現可能性 | OK | state 拡張と node 分割で可能 |
| 検証可能性 | OK | trace と state で確認可能 |
| ニーズ適合 | OK | PM要求のタスク化、監査性に合う |
