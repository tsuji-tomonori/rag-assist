# RAG品質強化PM方針と実装ロードマップ

- ファイル: `memorag-bedrock-mvp/docs/1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_001.md`
- 種別: `REQ_PROJECT`
- 要求ID: `PRJ-001`
- 作成日: 2026-05-01
- 状態: Draft

## 背景

`memorag-bedrock-mvp` は、Bedrock、S3 Vectors、React UI、LangGraph 風の固定ワークフローを持つ MemoRAG MVP として成立している。

現時点の課題は、検索機能を無制限に増やすことではなく、アップロード資料から回答してよいかを厳密に判断し、回答根拠と評価指標で改善可能な状態にすることである。

## 目的

- PRJ-001: MemoRAG MVP を、回答許可、根拠検証、検索制御、ベンチマークを備えた社内RAG品質改善基盤へ段階的に拡張すること。

## PM判断

- 最優先価値は「資料から回答できない質問に答えないこと」である。
- 初期の勝ち筋は OpenSearch 互換検索基盤ではなく、S3 Vectors と軽量 lexical retrieval を組み合わせた RAG 専用 retriever である。
- MemoRAG の memory card と clue 生成は維持し、plan / act は constrained agent として段階的に強化する。
- 高抽象度要約や概念検索は、最終回答の根拠ではなく検索補助として扱う。

## スコープ

### Must

- Sufficient Context に基づく回答可能性判定を導入する。
- 回答文が引用チャンクで支持されるかを検証する。
- 検索品質に応じて再検索、query rewrite、拒否を選べる retrieval evaluator を導入する。
- benchmark runner を不回答、根拠性、fact coverage を測れる形へ拡張する。
- `/benchmark/query` を本番系で未認証公開しない。

### Should

- `SearchPlan` と `SearchAction` を state に導入し、plan / act を構造化する。
- 複数 clue 検索結果を RRF で融合する。
- section、document、concept など複数抽象度の memory record を追加する。

### Out of Scope

- OpenSearch 完全互換の自作。
- 初期段階での GraphRAG フル実装。
- 初期段階での ColBERT、SPLADE、cross-encoder 常時 rerank。
- 外部Web検索による補完回答。

## 優先順位

| Phase | 目的 | 対応要件 | 主要タスク |
|---|---|---|---|
| 0 | 安全な評価面を整える | `NFR-010`, `SQ-001` | benchmark API 認可、評価メトリクス定義 |
| 1 | 答えてよいかを厳密にする | `FR-014`, `FR-015` | sufficient context judge、support verifier |
| 2 | 検索制御を agentic にする | `FR-016`, `FR-017` | retrieval evaluator、SearchPlan、SearchAction |
| 3 | 検索統合を改善する | `FR-018` | RRF、rank trace、重複排除 |
| 4 | 測れる改善サイクルにする | `FR-019` | fact coverage、faithfulness、refusal precision/recall |
| 5 | 俯瞰検索へ拡張する | `FR-020` | section/document/concept memory、drill-down |

## 主要タスク

| ID | タスク | 優先度 | 完了条件 |
|---|---|---:|---|
| T-001 | `/benchmark/query` の認可方針を決め、管理者権限配下に置く | S | 本番設定で未認証アクセスできない |
| T-002 | `sufficient-context-gate.ts` を追加する | S | `ANSWERABLE/PARTIAL/UNANSWERABLE` が state と trace に残る |
| T-003 | `verify-answer-support.ts` を追加する | S | unsupported sentence がある回答は拒否または再生成される |
| T-004 | `retrieval-evaluator.ts` を追加する | S | 検索品質に応じた next action が記録される |
| T-005 | `SearchPlan` と `SearchAction` を state に追加する | A | required fact と action history が debug trace で確認できる |
| T-006 | `rank-fusion.ts` を追加し、max score 統合を RRF に置き換える | A | 複数 query の順位融合結果が再現可能である |
| T-007 | benchmark dataset と runner を拡張する | S | 不回答、根拠性、fact coverage をサマリ出力できる |
| T-008 | section/document/concept memory の ingestion 方針を設計する | B | L0 raw chunk を最終根拠に残した多抽象度検索案が文書化される |

## リスク

| 観点 | リスク | 対応 |
|---|---|---|
| Value | 検索改善だけ進めると、回答禁止品質が改善しない | Phase 1 を回答許可ゲートに寄せる |
| Feasibility | LLM judge のコストと遅延が増える | cheap precheck 後に必要時だけ judge する |
| Safety | benchmark API や debug trace が社内文書を露出する | 認可と管理者権限を先に入れる |
| Quality | 高抽象度要約を根拠にすると幻覚が混ざる | 最終回答の引用は raw evidence chunk に限定する |
| Operability | 多段 plan / act が追跡不能になる | actionHistory と observation を trace に保存する |

## 受け入れ条件

- PRJ-001-AC-001: 優先度 S の要件が個別の `REQ_*` ファイルとして定義されていること。
- PRJ-001-AC-002: 各要件に受け入れ条件が含まれていること。
- PRJ-001-AC-003: 実装順が Phase とタスク ID で追跡できること。

## 判断待ち

- LLM judge に使う Bedrock モデルを、回答生成モデルと同じにするか軽量モデルに分けるか。
- benchmark の合格閾値を、初期値としてどこまで固定するか。
- section/document/concept memory を同一 S3 Vectors index に入れるか、抽象度別 index に分けるか。
