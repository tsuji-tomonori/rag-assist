# MemoRAG MVP 品質属性シナリオ

- ファイル: `memorag-bedrock-mvp/docs/2_アーキテクチャ_ARC/31_品質属性_QA/ARC_QA_001.md`
- 種別: `ARC_QA`
- 作成日: 2026-05-01
- 状態: Draft

## 何を書く場所か

アーキテクチャ上重要な要求を、品質属性シナリオとして評価可能な形で定義する。

## 品質属性シナリオ

| ASR | 刺激 | 応答 | 測定 |
| --- | --- | --- | --- |
| `ASR-TRUST-001` | 利用者が登録文書に基づく質問をする | システムは回答と引用を返す | 回答に少なくとも 1 件の citation が含まれる |
| `ASR-GUARD-001` | 検索済み evidence だけでは答えられない質問を受ける | システムは推測回答せず回答不能を返す | refusal correctness、unsupported sentence count |
| `ASR-RETRIEVAL-001` | 通常チャットで複数 clue または query から evidence 候補を探す | システムは lexical/semantic 候補を RRF で融合し、検索評価に応じて次 action を選ぶ | retrieval recall@k、rank trace completeness、retrievalDiagnostics completeness |
| `ASR-EVAL-001` | benchmark dataset を実行する | システムは fact coverage、faithfulness、context relevance を出力する | benchmark summary と Markdown report |
| `ASR-SEC-001` | 未認可利用者が debug/benchmark API にアクセスする | システムは実行または参照を拒否する | unauthorized access count が 0 |
| `ASR-OPER-001` | 障害調査で runId を指定する | システムは該当 trace と model metadata を参照できる | trace lookup success rate |

## 評価観点

- 根拠性: 回答の主要主張が引用 chunk で支持されていること。
- 不回答品質: 根拠不足、対象外、権限外の質問に対して回答不能を返せること。
- 検索品質: clue 生成、memory search、lexical evidence search、semantic evidence search、RRF の各段階が trace 可能であること。
- セキュリティ: 本番または社内検証環境で debug/benchmark 系 API が未認可公開されないこと。
- 運用性: trace と benchmark 結果から改善対象を特定できること。

## 関連文書

- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/11_サービス品質制約_SERVICE_QUALITY/REQ_SERVICE_QUALITY_001.md`
- `2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_001.md`
- `3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md`
