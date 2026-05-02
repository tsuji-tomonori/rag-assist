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
| ビュー | `2_アーキテクチャ_ARC/11_ビュー_VIEW/ARC_VIEW_001.md` | 論理ビュー、RAG ランタイムビュー、データ配置ビュー |
| ADR | `2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_001.md` | サーバレス RAG と guard 付き retrieval pipeline の採用判断 |
| 品質属性 | `2_アーキテクチャ_ARC/31_品質属性_QA/ARC_QA_001.md` | 根拠性、セキュリティ、評価可能性、性能、運用性の ASR |

## アーキテクチャ概要

MemoRAG MVP は、文書取り込み、memory/evidence indexing、clue 生成、evidence 検索、RRF 統合、回答可能性判定、回答生成、引用検証、debug trace、benchmark を含む RAG アシスタントシステムである。

初期構成は、React UI、Hono API on Lambda、Amazon Bedrock、S3 Documents、S3 Vectors を中心とするサーバレス構成である。

## 主要ステークホルダーと関心事

| ステークホルダー | 関心事 |
| --- | --- |
| 利用者 | 正確な回答、根拠、回答不能時の説明、応答速度 |
| 評価担当者 | benchmark API、品質指標、再現可能な評価結果 |
| 運用担当者 | debug trace、監視、コスト、復旧容易性 |
| セキュリティ管理者 | 認可、情報漏えい防止、監査性 |
| 開発者 | ローカル検証、変更容易性、設計判断の追跡 |

## アーキテクチャドライバ / ASR

| ASR | 関連要求 | 内容 |
| --- | --- | --- |
| `ASR-TRUST-001` | `FR-004`, `FR-005` | 回答は根拠文書箇所を示し、根拠不足時は回答不能を明示する。 |
| `ASR-GUARD-001` | `FR-014`, `FR-015` | 回答前後に evidence 十分性と引用支持関係を検証する。 |
| `ASR-RETRIEVAL-001` | `FR-016`, `FR-017`, `FR-018`, `TC-001` | 検索結果品質を評価し、許可済み action と RRF で検索制御する。 |
| `ASR-EVAL-001` | `FR-019`, `SQ-001` | RAG 品質を継続測定できる benchmark と trace を持つ。 |
| `ASR-SEC-001` | `NFR-010` | benchmark/debug 系 API は本番または社内検証環境で認可対象とする。 |
| `ASR-SEC-002` | `FR-025`, `NFR-011` | 通常利用者の self sign-up は `CHAT_USER` のみに限定し、上位権限付与は管理者操作へ分離する。 |

## 要件・設計との境界

- 要件は `REQUIREMENTS.md` と `1_要求_REQ/` に記述し、達成すべき条件を管理する。
- アーキテクチャは `ARCHITECTURE.md` と `2_アーキテクチャ_ARC/` に記述し、構造、品質属性、重要判断を管理する。
- 設計は `3_設計_DES/` に記述し、API、データ、処理手順、エラー処理を実装可能な粒度へ落とす。
