# MemoRAG MVP 要件変更管理とトレーサビリティ

- ファイル: `memorag-bedrock-mvp/docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_001.md`
- 種別: `REQ_CHANGE`
- 作成日: 2026-05-01
- 状態: Draft

## 何を書く場所か

要求変更の扱い、影響確認、要求からアーキテクチャ、設計、評価までの対応関係を管理する。

## 変更管理手順

1. 変更要求を登録する。
2. 変更対象の `REQ_*`、`ARC_*`、`DES_*`、テストまたは評価指標を特定する。
3. 要件の原子性を確認し、複合条件は分割する。
4. アーキテクチャ上重要な要求に該当する場合は ASR と ADR への影響を確認する。
5. 設計、API、データ、運用、benchmark への影響を確認する。
6. 更新後にトレーサビリティ表を改訂する。

## トレーサビリティ

| 要求 | ASR | ADR | HLD/DLD/API/Data | 受入・評価 |
| --- | --- | --- | --- | --- |
| `FR-001`, `FR-002` | `ASR-OPER-001` | `ARC_ADR_001` | `DES_HLD_001`, `DES_DATA_001`, `DES_API_001` | 各要求の受け入れ条件 |
| `FR-003`, `FR-004`, `FR-005` | `ASR-TRUST-001` | `ARC_ADR_001` | `DES_HLD_001`, `DES_DLD_001`, `DES_API_001` | `REQ_ACCEPTANCE_001`, `SQ-001` |
| `FR-014`, `FR-015` | `ASR-GUARD-001` | `ARC_ADR_001` | `DES_DLD_001` | `REQ_ACCEPTANCE_001`, `SQ-001` |
| `FR-016`, `FR-017`, `FR-018`, `FR-026` | `ASR-RETRIEVAL-001` | `ARC_ADR_001` | `DES_HLD_001`, `DES_DLD_001`, `DES_DLD_002`, `DES_DATA_001` | `SQ-001` |
| `FR-019`, `FR-020` | `ASR-EVAL-001` | `ARC_ADR_001` | `DES_HLD_001`, `DES_DATA_001`, `DES_API_001` | `REQ_ACCEPTANCE_001`, `SQ-001` |
| `NFR-010` | `ASR-SEC-001` | `ARC_ADR_001` | `DES_API_001`, `DES_DATA_001` | `REQ_ACCEPTANCE_001` |
| `FR-021`, `FR-024`, `NFR-011` | `ASR-SEC-001` | `ARC_ADR_001` | `DES_HLD_001`, `DES_API_001`, `DES_DATA_001` | `REQ_ACCEPTANCE_001` |
| `FR-025`, `NFR-011` | `ASR-SEC-002` | `ARC_ADR_001` | `DES_HLD_001`, `DES_DLD_004`, `DES_API_001` | `REQ_FUNCTIONAL_025` |
| `FR-023`, `NFR-012` | `ASR-SEC-001`, `ASR-RETRIEVAL-001` | `ARC_ADR_001` | `DES_DLD_002`, `DES_DLD_003`, `DES_API_001`, `DES_DATA_001` | `REQ_ACCEPTANCE_001`, `SQ-001` |
| `TC-001` | `ASR-RETRIEVAL-001` | `ARC_ADR_001` | `DES_HLD_001`, `DES_DLD_001` | `SQ-001` |

## 影響確認チェック

- 要求文が 1 条件で検証可能か。
- 受け入れ条件が同一ファイルまたは横断受入基準に紐づいているか。
- ASR に影響する場合、`ARC_QA_001.md` と `ARC_ADR_001.md` を更新したか。
- API contract に影響する場合、`DES_API_001.md` を更新したか。
- データ保持、trace、評価指標に影響する場合、`DES_DATA_001.md` と benchmark 文書を更新したか。
- 未実施のテストや確認を実施済みとして記録していないか。

## 未決事項

- benchmark 合格閾値の初期値。
- LLM judge の modelId と回答生成 modelId を分けるか。
- debug trace の本番マスキング対象項目。
