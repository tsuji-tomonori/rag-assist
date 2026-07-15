# Issue #345 UI 語彙・token・共通 primitive を統一する

状態: todo

タスク種別: リファクタリング

## 背景

同じ intent/status/risk の用語・色・部品が feature ごとに分散し、raw enum/ID/internal name や arbitrary CSS が ordinary task に露出する可能性がある。

## 目的・対象範囲

`NFR-017` に基づき approved display metadata、semantic design token、navigation/form/dialog/status/retry/risky-action primitive を整備し、No Mock Product UI を維持する。

## 必要情報

- 要件: `NFR-017`, `FR-095`, `FR-096`, `FR-098`, `SQ-016`
- current CSS/component/inventory と feature-specific labels
- gap: `GAP-UI-007`

## 実行計画

1. user-facing vocabulary、intent/status/risk と current duplication を inventory 化する。
2. semantic metadata/token/primitive contract を定義する。
3. representative shared/feature UI へ段階適用する。
4. contrast/state/accessible-name/visual regression を検証する。

## ドキュメントメンテナンス計画

`NFR-017`, `DES_UI_UX_001`、component/token usage、generated inventory を同期する。brand refresh や見た目だけの全面刷新は対象外とする。

## 受け入れ条件

- [ ] 同じ status/intent/risk が共通 semantic metadata/token と複数 cue を使う。
- [ ] navigation/form/dialog/status/retry/risky action は native semantics と同一 contract を使う。
- [ ] raw enum、opaque ID、internal module/service 名を主要 label/input にしない。
- [ ] API/props/state/config にない値を demo fallback で補わない。
- [ ] representative feature test、inventory、contrast/state review が pass する。

## 検証計画

- metadata/primitive component tests
- lint/typecheck/test/build、visual/contrast/axe
- hidden Unicode、docs/inventory check

## PR レビュー観点

semantic meaning、contrast、localization、日本語の一貫性、primitive 過剰抽象化、mock fallback を確認する。

## 未決事項・リスク

用語承認が必要な domain label は仮語で固定せず open question/owner を残す。
