# 要件定義（1要件1ファイル）

- 要件ID: `FR-018`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2機能群:
  - `3.3 検索結果統合`
- L3要件: `FR-018`
- 関連カテゴリ: なし

## 要件

- FR-018: 複数 query または clue から得た evidence 検索結果を、最大スコア採用ではなく順位融合で統合すること。

## 受け入れ条件（この要件専用）

- AC-FR018-001: `rank-fusion.ts` に RRF を実装し、同じ chunk key の順位寄与を合算できること。
- AC-FR018-002: RRF の `k` と list weight を設定値または関数引数で変更できること。
- AC-FR018-003: 統合後の chunk は score 降順で安定的に返ること。
- AC-FR018-004: 既存の単一 query 検索結果では現行と同等の並びを維持できること。

## 要件の源泉・背景

- 源泉: ユーザー提示の RAG-Fusion / RRF 方針、現行 `search-evidence.ts` の実装確認。
- 背景: 現行検索は複数 query の hit を key 単位で最大 score 統合しており、複数 clue で安定して上位に出る chunk を優遇しにくい。

## 要件の目的・意図

- 目的: 複数 clue の検索結果を安定して統合し、検索 recall と ranking の頑健性を上げる。
- 意図: BM25、semantic、HyDE、clue 検索のように score 尺度が異なる結果にも拡張しやすくする。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-018` |
| 説明 | evidence 検索結果を RRF で統合する |
| 根拠 | score 尺度差と複数 query の安定性に対応するため |
| 源泉 | ユーザー提示方針、現行コード調査 |
| 種類 | 機能要求 |
| 依存関係 | `search-evidence.ts`、`RetrievedVector` |
| 衝突 | 既存 score の意味が RRF score に変わる可能性 |
| 受け入れ基準 | `AC-FR018-001` から `AC-FR018-004` |
| 優先度 | A |
| 安定性 | High |
| 変更履歴 | 2026-05-01 初版 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | 複数 clue 検索を活かすため必要 |
| 十分性 | OK | RRF、設定、互換性を含む |
| 理解容易性 | OK | 既存 max score 置換として明確 |
| 一貫性 | OK | search-evidence の責務に合う |
| 標準・契約適合 | OK | RAG検索改善方針に合う |
| 実現可能性 | OK | 小さい純関数から実装可能 |
| 検証可能性 | OK | unit test で順位確認可能 |
| ニーズ適合 | OK | 検索品質改善に寄与 |
