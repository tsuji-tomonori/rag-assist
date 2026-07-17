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

## executable evidence contract（2026-07-17）

- contract: `tools/web-inventory/manual-a11y-evidence-contract.json`
- validator: `tools/web-inventory/manual-a11y-evidence.mjs`
- current baseline: `reports/working/issue-345-manual-a11y-evidence-baseline.json`
- `npm run docs:manual-a11y-evidence:check` は record の構造と blocker trace を検査する。blocked/not_run を pass へ変換せず、current baseline は `ready: false` のまま有効とする。
- `npm run docs:manual-a11y-evidence:require-pass` は matrix が承認済みで、required manual keyboard / screen reader / browser zoom / real-device checks がすべて pass の場合だけ 0 終了する。current baseline は意図どおり非 0 で、Issue full completion/release readiness を拒否する。
- automation/proxy の attachment は manual pass evidence kind として許可しない。実施済み pass/fail は manual execution、実 environment、role-only executor、manual evidence を必須とする。
- 本 contract は evidence 記録の欠落を検出するが、`OQ-UI-002` の matrix/owner 承認や実測を代替しない。そのため本 task の受け入れ条件は未チェックのまま維持する。

## PR レビュー観点

automation の結果を手動 evidence と誤認していないか、環境再現性、privacy、未達表示を確認する。

## 未決事項・リスク

利用可能な device/screen reader と担当者承認が必要で、環境がなければ blocked として報告する。
