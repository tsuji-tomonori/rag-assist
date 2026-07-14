# debug trace redaction と評価隔離の実装

- 状態: todo
- タスク種別: セキュリティ・評価実装
- 作成日: 2026-07-13
- 関連要件・gap: `FR-074`, `FR-075`, `FR-084`, `FR-088`, `SQ-007`, `GAP-RD-018`, `GAP-RD-019`

## 背景

debug trace の raw data と redaction 宣言が一致せず、product runtime に domain/dataset 固有 rule と metadata 自動 policy 選択が残る。

## 目的と範囲

再現に必要な version/provenance を残しつつ機微 data を schema-level に redaction し、evaluation-only expected field、dataset adapter、domain policy を production default path から隔離する。

## 受け入れ条件

- [ ] trace schema、保存値、API response、download artifact の redaction 契約が一致する。
- [ ] production runtime が benchmark expected field や dataset 固有値を読まない。
- [ ] domain policy は明示 profile と provenance を持ち、欠損時に自動推定しない。
- [ ] production-equivalence、secret/PII、dataset contamination の regression test を追加する。

## 検証・文書

- trace schema/API/store test、benchmark isolation test、runtime static check を実行する。
- trace/data/API design と `FR-074`, `FR-075`, `FR-084`, `FR-088`, `SQ-007` を更新する。

## リスク

redaction で再現性を失わないよう、content と非機微 provenance/version を分離する。
