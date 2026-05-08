# 要件定義（1要件1ファイル）

- 要件ID: `FR-045`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.6 retrieval adoption gate`
- L3要件: `FR-045`
- 関連カテゴリ:
  - `4. 回答検証・ガードレール`
  - `7. 評価・debug・benchmark`

## 要件

- FR-045: RAG graph は、採用基準を満たす検索根拠だけを回答生成へ渡すこと。

## 受け入れ条件（この要件専用）

- AC-FR045-001: retrieval evaluator は候補 chunk ごと、または候補集合ごとに quality と採用判断を記録できること。
- AC-FR045-002: 採用基準を満たす根拠だけが回答生成 node の入力 evidence になること。
- AC-FR045-003: 採用基準を満たす根拠が不足する場合、RAG graph は再検索、context expansion、回答不能のいずれかへ分岐すること。
- AC-FR045-004: 採用判断の trace は chunk、score、quality、nextAction を含み、dataset 固有の期待語句や QA sample 固有値を使わないこと。

## 要件の源泉・背景

- 源泉: `docs/spec-recovery/06_requirements.md` の `REQ-SRCH-002`
- 源泉: `docs/spec-recovery/03_acceptance_criteria.md` の `AC-SRCH-002`
- 源泉: `docs/spec-recovery/07_specifications.md` の `SPEC-SRCH-002`
- 背景: 復元仕様では semantic chunking、hybrid retrieval、retrieval evaluator の結果を採用 gate で選別することが求められている。

## 要件の目的・意図

- 目的: 検索候補をそのまま回答生成へ渡さず、回答根拠として採用可能な evidence だけを使う。
- 意図: 検索 miss、根拠不足、採用判断の失敗を trace と benchmark で診断できるようにする。
- 区分: 機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `FR-045` |
| 説明 | retrieval adoption gate による回答根拠選別 |
| 根拠 | 採用基準を満たさない検索候補を回答生成へ渡すと、unsupported answer のリスクが上がる |
| 源泉 | `REQ-SRCH-002`, `AC-SRCH-002`, `SPEC-SRCH-002` |
| 種類 | 機能要求 |
| 依存関係 | `FR-014`, `FR-016`, `FR-017`, `FR-018`, `FR-026`, `SQ-001` |
| 衝突 | 再検索や context expansion により latency が増える |
| 受け入れ基準 | `AC-FR045-001` から `AC-FR045-004` |
| 優先度 | S |
| 安定性 | Medium |
| 変更履歴 | 2026-05-08 初版 |

## 関連文書

- `memorag-bedrock-mvp/docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/03_RAG検索品質制御/04_検索結果評価/REQ_FUNCTIONAL_016.md`
- `memorag-bedrock-mvp/docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/03_RAG検索品質制御/02_Hybrid_retrieval/REQ_FUNCTIONAL_026.md`
- `memorag-bedrock-mvp/docs/2_アーキテクチャ_ARC/31_品質属性_QA/ARC_QA_001.md`
