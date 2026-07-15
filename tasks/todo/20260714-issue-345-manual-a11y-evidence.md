# Issue #345 手動 a11y・zoom・実機 evidence を確立する

状態: todo

タスク種別: 検証

## 背景

automation だけでは focus reading、screen reader announcement、400% zoom、virtual keyboard、touch、実機 behavior を証明できず、現行 release evidence もない。

## 目的・対象範囲

`NFR-018`, `SQ-016` の manual matrix、environment、owner、cadence、記録形式、defect routing を定め、代表 persona/journey の実測 evidence を残す。

## 必要情報

- gap: `GAP-UI-009`
- `OQ-UI-002`: screen reader/OS/browser/device matrix
- automation result と feature defect tasks

## 実行計画

1. representative environment と journey、pass/NA/blocked 判定基準を承認する。
2. keyboard、screen reader、320px/400% zoom、touch/real-device を実施する。
3. date/environment/scope/result/evidence/defect/task を report に記録する。
4. blocker を修正・再検証し release/issue completion 判定へ反映する。

## ドキュメントメンテナンス計画

`NFR-018`, `SQ-016`, `DES_UI_UX_001`、PR evidence と release report を同期する。個人情報や screen recording の機微情報を保存しない。

## 受け入れ条件

- [ ] environment、date、persona、journey、viewport/zoom/input、pass/fail/blocked、evidence が記録される。
- [ ] keyboard、representative screen reader、320px/400% zoom、real-device の承認 matrix を実測する。
- [ ] 未実施/blocked/skipped を pass と表示しない。
- [ ] defect に severity、owner、task、再検証結果が対応する。
- [ ] serious/critical blocker が残る間は Issue #345 完了扱いにしない。

## 検証計画

- evidence report schema review
- independent reviewer による sample evidence trace
- defect repair/retest loop と completion audit

## PR レビュー観点

automation の結果を手動 evidence と誤認していないか、環境再現性、privacy、未達表示を確認する。

## 未決事項・リスク

利用可能な device/screen reader と担当者承認が必要で、環境がなければ blocked として報告する。
