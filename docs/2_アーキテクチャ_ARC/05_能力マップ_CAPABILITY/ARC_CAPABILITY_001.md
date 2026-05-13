# MemoRAG MVP アーキテクチャ能力マップ

- ファイル: `docs/2_アーキテクチャ_ARC/05_能力マップ_CAPABILITY/ARC_CAPABILITY_001.md`
- 種別: `ARC_CAPABILITY`
- 作成日: 2026-05-04
- 状態: Draft

## 何を書く場所か

機能要求の L1 主カテゴリと、アーキテクチャ上の能力、構成要素、ビュー、ASR の対応を管理する。

## 目的

機能要求は `FR-*` を L1 主分類と L2 主機能群に 1 回だけ配置する。

アーキテクチャは機能要求の物理ディレクトリ構成を写さず、Context、Capability、Runtime、Data、Security、Deployment、Quality、ADR などの横断関心事で構造を説明する。

本能力マップは、要求側の 8 大カテゴリとアーキテクチャ側の横断ビューを接続する。

## 能力マップ

| L1 | アーキテクチャ能力 | 主な構成要素 | 主なビュー | 関連 ASR |
| --- | --- | --- | --- | --- |
| 1. 文書・知識ベース管理 | Knowledge Base Lifecycle | Ingestion、Chunking、Memory Builder、Document Store、Vector Store | データ・インデックスライフサイクルビュー | `ASR-RETRIEVAL-001`, `ASR-OPER-001` |
| 2. チャットQA・根拠提示・回答不能制御 | Grounded QA Experience | Query Orchestrator、Prompt Builder、LLM Gateway、Answer Renderer | RAG ランタイムビュー | `ASR-TRUST-001` |
| 3. RAG検索品質制御 | Retrieval Control | Hybrid Retriever、RRF、SearchPlan、Alias Artifact | RAG ランタイムビュー、データ・インデックスライフサイクルビュー | `ASR-RETRIEVAL-001` |
| 4. 回答検証・ガードレール | Answer Guard | Answerability Judge、Citation Validator | RAG ランタイムビュー、品質属性ビュー | `ASR-GUARD-001` |
| 5. 会話履歴・お気に入り | User Conversation Data | Conversation History Store、Favorite Store、userId boundary | データ・インデックスライフサイクルビュー、認証認可・信頼境界ビュー | `ASR-SEC-001` |
| 6. 問い合わせ・人手対応 | Human Escalation | Human Question Store、Answer Editor flow | 論理コンポーネントビュー、認証認可・信頼境界ビュー | `ASR-SEC-001` |
| 7. 評価・debug・benchmark | Evaluation & Observability | Debug Trace、Benchmark Runner、Report Store | 運用・評価ビュー | `ASR-EVAL-001`, `ASR-OPER-001` |
| 8. 認証・認可・管理・監査 | Access Control & Governance | Cognito、RBAC、Admin API、Audit Log | 認証認可・信頼境界ビュー、運用・評価ビュー | `ASR-SEC-001`, `ASR-SEC-002` |

## アーキテクチャ構成方針

- 機能要求 L1 をアーキテクチャの物理ディレクトリへ 1:1 で写さない。
- `Auth / Authorization`、`Hybrid Retriever`、`Debug Trace` は複数 L1 にまたがる横断構成要素として扱う。
- 詳細な処理順序はビュー文書へ、採用判断は ADR へ、評価条件は品質属性文書へ分ける。

## 関連文書

- `docs/REQUIREMENTS.md`
- `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/README.md`
- `docs/ARCHITECTURE.md`
- `docs/2_アーキテクチャ_ARC/11_ビュー_VIEW/ARC_VIEW_001.md`
- `docs/2_アーキテクチャ_ARC/31_品質属性_QA/ARC_QA_001.md`
