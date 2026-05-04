# MemoRAG MVP 品質属性シナリオ

- ファイル: `memorag-bedrock-mvp/docs/2_アーキテクチャ_ARC/31_品質属性_QA/ARC_QA_001.md`
- 種別: `ARC_QA`
- 作成日: 2026-05-01
- 状態: Draft

## 何を書く場所か

アーキテクチャ上重要な要求を、品質属性シナリオとして評価可能な形で定義する。

## 品質属性シナリオ

| ASR | 関連 L1 | 関連要求 | 刺激 | 応答 | 測定 |
| --- | --- | --- | --- | --- | --- |
| `ASR-TRUST-001` | 2 | `FR-003`, `FR-004`, `FR-005` | 利用者が登録文書に基づく質問をする | システムは回答と引用を返し、根拠不足時は回答不能を返す | citation presence、refusal correctness |
| `ASR-GUARD-001` | 4 | `FR-014`, `FR-015` | 検索済み evidence だけでは答えられない質問を受ける | システムは回答前に evidence 十分性を判定し、回答後に引用支持関係を検証する | unsupported sentence count、citation support pass rate |
| `ASR-RETRIEVAL-001` | 1, 3 | `FR-016`, `FR-017`, `FR-018`, `FR-020`, `FR-023`, `FR-026` | 通常チャットで複数 clue または query から evidence 候補を探す | システムは lexical/semantic 候補を RRF で融合し、検索評価に応じて次 action を選ぶ | retrieval recall@k、rank trace completeness、retrievalDiagnostics completeness |
| `ASR-EVAL-001` | 7 | `FR-010`, `FR-011`, `FR-012`, `FR-019`, `SQ-001` | benchmark dataset を実行する | システムは fact coverage、faithfulness、context relevance を出力する | benchmark summary と Markdown report |
| `ASR-SEC-001` | 5, 6, 7, 8 | `FR-021`, `FR-022`, `FR-024`, `FR-027`, `NFR-010`, `NFR-011`, `NFR-012` | 未認可利用者が debug/benchmark API、管理 API、別 userId の履歴へアクセスする | システムは実行または参照を拒否し、通常検索 response に内部 metadata を出さない | unauthorized access count が 0、metadata leakage count が 0 |
| `ASR-SEC-002` | 8 | `FR-025`, `NFR-011` | 未認証の通常利用者が self sign-up を完了する | システムは `CHAT_USER` のみを付与し、上位権限は管理者操作へ分離する | automatic privileged assignment count が 0 |
| `ASR-OPER-001` | 1, 7, 8 | `FR-010`, `FR-011`, `FR-019`, `FR-024`, `FR-027` | 障害調査で runId、benchmark run、管理操作履歴を指定する | システムは該当 trace、model metadata、評価成果物、監査情報を参照できる | trace lookup success rate、artifact lookup success rate |

## 評価観点

- 根拠性: 回答の主要主張が引用 chunk で支持されていること。
- 不回答品質: 根拠不足、対象外、権限外の質問に対して回答不能を返せること。
- 検索品質: clue 生成、memory search、lexical evidence search、semantic evidence search、RRF の各段階が trace 可能であること。
- セキュリティ: 本番または社内検証環境で debug/benchmark 系 API が未認可公開されないこと。
- 最小権限: self sign-up ユーザーと管理者、回答担当者、benchmark runner service user の権限境界が分離されていること。
- 運用性: trace と benchmark 結果から改善対象を特定できること。

## 関連文書

- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/11_サービス品質制約_SERVICE_QUALITY/REQ_SERVICE_QUALITY_001.md`
- `2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_001.md`
- `3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md`
