# 要件定義（1要件1ファイル）

- 要件ID: `CHG-002`
- 種別: `REQ_CHANGE`
- 状態: Draft
- 優先度: B

## 要件

- CHG-002: 仕様復元を更新するとき、作業レポートから要件・仕様・受け入れ条件への trace を逆引きできること。

## 受け入れ条件（この要件専用）

- AC-CHG002-001: 仕様復元に使った作業レポートは、`RPT-*` ID、分類、対象/対象外、関連 task を記録すること。
- AC-CHG002-002: product behavior に関係する作業レポートだけを facts、tasks、acceptance criteria、requirements、specifications へ取り込むこと。
- AC-CHG002-003: commit、PR、merge だけに関係する作業レポートは、仕様化対象外として分類すること。
- AC-CHG002-004: 要件、仕様、E2E、gap から、report source または task family へ逆引きできること。

## 要件の源泉・背景

- 源泉: `docs/spec-recovery/06_requirements.md` の `REQ-DOCS-001`
- 源泉: `docs/spec-recovery/03_acceptance_criteria.md` の `AC-DOCS-001`
- 源泉: `docs/spec-recovery/07_specifications.md` の `SPEC-DOCS-001`
- 背景: 復元済み仕様では、作業レポート本文を product behavior と process evidence に分けて扱うことが求められている。

## 要件の目的・意図

- 目的: 作業レポート由来の仕様が、後から根拠を追跡できる状態を維持する。
- 意図: 一時的な作業ログをそのまま要求にせず、仕様化対象と対象外を明確に分ける。
- 区分: 変更管理要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `CHG-002` |
| 説明 | spec recovery の report trace 維持 |
| 根拠 | 作業レポート由来の要件は、根拠と対象外判断を追跡できなければ妥当性確認できない |
| 源泉 | `REQ-DOCS-001`, `AC-DOCS-001`, `SPEC-DOCS-001` |
| 種類 | 変更管理要求 |
| 依存関係 | `REQ_CHANGE_001`, `docs/spec-recovery/12_report_reading_inventory.md` |
| 衝突 | report inventory 更新の保守負荷が増える |
| 受け入れ基準 | `AC-CHG002-001` から `AC-CHG002-004` |
| 優先度 | B |
| 安定性 | Medium |
| 変更履歴 | 2026-05-08 初版 |

## 関連文書

- `memorag-bedrock-mvp/docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_001.md`
- `docs/spec-recovery/README.md`
- `docs/spec-recovery/12_report_reading_inventory.md`
