# MemoRAG MVP アーキテクチャ索引（SWEBOK-lite）

- ファイル: `memorag-bedrock-mvp/docs/ARCHITECTURE.md`
- 種別: `ARC_VIEW`
- 作成日: 2026-05-01
- 状態: Draft

## 位置づけ

MemoRAG MVP のアーキテクチャは、SWEBOK の Software Architecture に合わせて、ステークホルダー、関心事、コンテキスト、ビュー、品質属性、重要判断を分けて管理する。

本ファイルは索引であり、詳細は `2_アーキテクチャ_ARC/` 配下の分割ファイルを正とする。

## 分割ファイル

| 種別 | ファイル | 内容 |
| --- | --- | --- |
| コンテキスト | `2_アーキテクチャ_ARC/01_コンテキスト_CONTEXT/ARC_CONTEXT_001.md` | システム境界、外部アクター、依存サービス、信頼境界 |
| 能力マップ | `2_アーキテクチャ_ARC/05_能力マップ_CAPABILITY/ARC_CAPABILITY_001.md` | 機能要求 L1 とアーキテクチャ能力、ビュー、ASR の対応 |
| ビュー | `2_アーキテクチャ_ARC/11_ビュー_VIEW/ARC_VIEW_001.md` | 論理コンポーネント、RAG ランタイム、データ、認証認可、デプロイメント、運用評価のビュー索引 |
| ADR | `2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_001.md` | サーバレス RAG と guard 付き retrieval pipeline の採用判断 |
| 品質属性 | `2_アーキテクチャ_ARC/31_品質属性_QA/ARC_QA_001.md` | 根拠性、セキュリティ、評価可能性、性能、運用性の ASR |

## アーキテクチャ構成方針

機能要求は `1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/README.md` に従い、L1 主分類と L2 主機能群へ 1 回だけ配置する。

アーキテクチャは機能要求の 8 大カテゴリを物理ディレクトリとして写さず、横断的な関心事とビューで管理する。特に `Auth / Authorization`、`Hybrid Retriever`、`Debug Trace`、`Audit Log` は複数カテゴリにまたがるため、Context、Capability、Runtime、Data、Security、Deployment、Quality、ADR の観点で整理する。

## アーキテクチャ概要

MemoRAG MVP は、文書取り込み、memory/evidence indexing、clue 生成、hybrid evidence 検索、RRF 統合、回答可能性判定、回答生成、引用検証、debug trace、benchmark を含む RAG アシスタントシステムである。

初期構成は、React UI、Hono API on Lambda、Amazon Bedrock、S3 Documents、S3 Vectors を中心とするサーバレス構成である。

## 主要ステークホルダーと関心事

| ステークホルダー | 関心事 |
| --- | --- |
| 利用者 | 正確な回答、根拠、回答不能時の説明、応答速度 |
| 回答担当者 | 問い合わせ一覧、回答登録、解決済み化、担当者導線の権限 |
| 評価担当者 | benchmark API、品質指標、再現可能な評価結果 |
| 運用担当者 | debug trace、監視、コスト、復旧容易性 |
| システム管理者 | ユーザー管理、ロール付与、利用状況、コスト監査 |
| セキュリティ管理者 | 認可、情報漏えい防止、監査性 |
| 開発者 | ローカル検証、変更容易性、設計判断の追跡 |

## 機能要求 L1 とアーキテクチャビューの対応

| 機能要求 L1 | 主なアーキテクチャビュー | 主な構成要素 |
| --- | --- | --- |
| 1. 文書・知識ベース管理 | データ・インデックスライフサイクルビュー | Ingestion、Chunking、Memory Builder、S3 Documents、S3 Vectors |
| 2. チャットQA・根拠提示・回答不能制御 | RAG ランタイムビュー | Query Orchestrator、Prompt Builder、LLM Gateway、Answer Renderer |
| 3. RAG検索品質制御 | RAG ランタイムビュー、データ・インデックスライフサイクルビュー | Hybrid Retriever、Lexical Retriever、Semantic Retriever、RRF、Alias Artifact |
| 4. 回答検証・ガードレール | RAG ランタイムビュー、品質属性ビュー | Answerability Judge、Citation Validator |
| 5. 会話履歴・お気に入り | データ・インデックスライフサイクルビュー、認証認可・信頼境界ビュー | Conversation History Store、Favorite Store、userId boundary |
| 6. 問い合わせ・人手対応 | 論理コンポーネントビュー、認証認可・信頼境界ビュー | Human Question Store、Answer Editor flow |
| 7. 評価・debug・benchmark | 運用・評価ビュー | Debug Trace、Benchmark Runner、Report Store |
| 8. 認証・認可・管理・監査 | 認証認可・信頼境界ビュー | Cognito、RBAC、Admin API、Audit Log |

## アーキテクチャドライバ / ASR

| ASR | 関連 L1 | 関連要求 | 内容 |
| --- | --- | --- | --- |
| `ASR-TRUST-001` | 2 | `FR-003`, `FR-004`, `FR-005` | 回答は根拠文書箇所を示し、根拠不足時は回答不能を明示する。 |
| `ASR-GUARD-001` | 4 | `FR-014`, `FR-015` | 回答前後に evidence 十分性と引用支持関係を検証する。 |
| `ASR-RETRIEVAL-001` | 1, 3 | `FR-016`, `FR-017`, `FR-018`, `FR-020`, `FR-023`, `FR-026`, `TC-001` | hybrid retrieval、RRF、検索制御、alias により検索品質を制御する。 |
| `ASR-EVAL-001` | 7 | `FR-010`, `FR-011`, `FR-012`, `FR-019`, `SQ-001` | RAG 品質を継続測定できる benchmark と trace を持つ。 |
| `ASR-SEC-001` | 5, 6, 7, 8 | `FR-021`, `FR-022`, `FR-024`, `FR-027`, `NFR-010`, `NFR-011`, `NFR-012` | 認可、権限境界、情報漏えい防止を route-level permission と userId 境界で強制する。 |
| `ASR-SEC-002` | 8 | `FR-025`, `NFR-011` | 通常利用者の self sign-up は `CHAT_USER` のみに限定し、上位権限付与は管理者操作へ分離する。 |
| `ASR-OPER-001` | 1, 7, 8 | `FR-010`, `FR-011`, `FR-019`, `FR-024`, `FR-027` | trace、監視、評価、運用調査に必要な情報を追跡可能にする。 |

## ビュー分割方針

`ARC_VIEW_001.md` はビュー索引として扱い、詳細化するときは次のビュー単位で分割する。

| ビュー | 主な関心事 |
| --- | --- |
| 論理コンポーネントビュー | Web UI、API Server、Auth、RAG Orchestrator、Ingestion、Hybrid Retriever、Answer Guard、Admin / Governance |
| RAG ランタイムビュー | `POST /chat`、clue generation、hybrid evidence search、RRF、answerability gate、citation support verification |
| データ・インデックスライフサイクルビュー | source、manifest、memory、evidence、alias、history、question、trace、benchmark artifact、audit log |
| 認証認可・信頼境界ビュー | Cognito、RBAC、`GET /me`、route-level permission、userId boundary、管理 API |
| デプロイメントビュー | CloudFront、S3 Static Web UI、API Gateway、Lambda、Cognito、Bedrock、S3、DynamoDB、Step Functions、CodeBuild |
| 運用・評価ビュー | debug trace、benchmark run、report download、CloudWatch Logs、usage / cost audit、admin audit log |

## 要件・設計との境界

- 要件は `REQUIREMENTS.md` と `1_要求_REQ/` に記述し、達成すべき条件を管理する。
- アーキテクチャは `ARCHITECTURE.md` と `2_アーキテクチャ_ARC/` に記述し、構造、品質属性、重要判断を管理する。
- 設計は `3_設計_DES/` に記述し、API、データ、処理手順、エラー処理を実装可能な粒度へ落とす。
