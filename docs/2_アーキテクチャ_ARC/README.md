# MemoRAG MVP アーキテクチャ索引

- ファイル: `docs/2_アーキテクチャ_ARC/README.md`
- 種別: `ARC_VIEW`
- 状態: Draft
- 最終更新: 2026-07-14

## 目的

MemoRAG MVP のシステム境界、能力、ビュー、品質属性、重要判断を管理する。詳細は同ディレクトリ配下の分割文書を正とする。

## アーキテクチャ索引

| 種別 | 正規文書 | 内容 |
| --- | --- | --- |
| Context | `01_コンテキスト_CONTEXT/ARC_CONTEXT_001.md` | 外部アクター、依存サービス、信頼境界 |
| Capability | `05_能力マップ_CAPABILITY/ARC_CAPABILITY_001.md` | 要求とアーキテクチャ能力の対応 |
| View | `11_ビュー_VIEW/ARC_VIEW_001.md` | 論理、runtime、data、security、deployment、operation |
| ADR | `21_重要決定_ADR/` | 重要な構造・技術判断と status |
| Quality attribute | `31_品質属性_QA/ARC_QA_001.md` | 根拠性、認可、評価、性能、運用性 |

現行構成は React Web、Hono API on Lambda、Amazon Bedrock、S3 Documents、S3 Vectors、DynamoDB を中心とする。実装に存在しない target architecture は、現行構成であるかのように記述せず、ADR の status または要求 baseline の gap として区別する。

## `docs/` 構成規則

`docs/` 直下には次の 5 ディレクトリだけを置く。

1. `1_要求_REQ/`
2. `2_アーキテクチャ_ARC/`
3. `3_設計_DES/`
4. `4_運用_OPS/`
5. `generated/`

`4_運用_OPS/` の恒久文書は `21_監視_MONITORING/` に集約する。旧ルート文書、移行用の重複索引、`spec/`、`spec-recovery/` は作らない。調査途中の抽出物は `reports/working/` に置き、確定した要求・判断・設計だけを正規文書へ反映する。

`generated/` は次の自動生成物だけを許可し、手編集しない。

- `openapi/`: `npm run docs:openapi`
- `web-*.md`, `web-ui-inventory.json`, `web-features/`: `npm run docs:web-inventory`。意味トレースの最小 authored join metadata は `tools/web-inventory/ui-traceability.json`、検証は `npm run docs:web-trace:test` と inventory check を正とする。
- `infra-inventory/`: `npm run docs:infra-inventory`

## 要求・設計との境界

- 要求: `docs/1_要求_REQ/` — 達成すべき検証可能条件。
- アーキテクチャ: `docs/2_アーキテクチャ_ARC/` — 構造、品質属性、重要判断。
- 設計: `docs/3_設計_DES/` — API、データ、処理、エラーの実装契約。
- 運用: `docs/4_運用_OPS/21_監視_MONITORING/` — 現行システムを観測・検証する手順。

構成 invariant は `python3 scripts/validate_docs.py` で確認する。
