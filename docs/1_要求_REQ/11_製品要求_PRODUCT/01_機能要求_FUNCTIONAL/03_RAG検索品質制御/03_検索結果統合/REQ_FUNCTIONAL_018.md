# 要件定義（1要件1ファイル）

- 要件ID: `FR-018`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft（実装・直接 test 確認済み）
- 優先度: A

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.3 検索結果統合`
- L3要件: `FR-018`
- 関連カテゴリ: なし


## 要件

- FR-018: 複数 query または clue から得た evidence 検索結果を、最大スコア採用ではなく順位融合で統合すること。

## 受け入れ条件（この要件専用）

- [x] AC-FR018-001: `rrfFuse` は同じ result key の順位寄与を複数 list から合算できること。
- [x] AC-FR018-002: RRF の `k` と list weight を設定値または関数引数で変更できること。
- [x] AC-FR018-003: 統合後の result は RRF score 降順で返ること。
- [x] AC-FR018-004: 単一 list の hit と複数 list に固有の hit を脱落させず統合できること。

## 要件の源泉・背景

- 源泉: ユーザー提示の RAG-Fusion / RRF 方針、現行 `search-evidence.ts` の実装確認。
- 背景: `hybrid-retriever.ts` の `rrfFuse` は lexical/semantic result list を、`search-evidence.ts` は複数 request-time result list を RRF で統合する。旧記載の max-score merge と `rank-fusion.ts` は現行 source に存在しない。

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
| 変更履歴 | 2026-05-01 初版。2026-07-16 `rrfFuse` と直接 test の current evidence に同期 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | 複数 clue 検索を活かすため必要 |
| 十分性 | OK | RRF、設定、互換性を含む |
| 理解容易性 | OK | `rrfFuse` の入出力 behavior として明確 |
| 一貫性 | OK | search-evidence の責務に合う |
| 標準・契約適合 | OK | RAG検索改善方針に合う |
| 実現可能性 | OK | 小さい純関数から実装可能 |
| 検証可能性 | OK | unit test で順位確認可能 |
| ニーズ適合 | OK | 検索品質改善に寄与 |

## 実装・検証トレース

- `confirmed`: `apps/api/src/rag/online/retrieval/hybrid/hybrid-retriever.ts` の `rrfFuse` と、その呼び出し元 hybrid retrieval。
- `confirmed`: `apps/api/src/rag/online/retrieval/request-time/search-evidence.ts` の複数 result list 統合。
- `confirmed`: `apps/api/src/search/hybrid-search.test.ts` の重複 hit 加点、独立 lexical hit 保持、`k` 境界 test。
- `confirmed`: `apps/api/src/rag/__tests__/runtime-layout.test.ts` の新 runtime layout から BM25/RRF behavior を保持する test。
- `conflict`: 旧 `rank-fusion.ts` 参照と max-score 現状説明は現行 source と不一致のため削除した。
