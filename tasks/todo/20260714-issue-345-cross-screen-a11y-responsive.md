# Issue #345 全画面 WCAG 2.2 AA・responsive remediation を完了する

状態: todo

タスク種別: バグ修正

## 背景

8 AppViews 横断の 320〜1280px、200%/400% zoom、keyboard、screen reader、touch、reduced motion、extreme content evidence がなく、inventory には missing/warning の静的指摘が残る。

## 目的・対象範囲

全 production Web screen の主要 journey を `SQ-016` に適合させ、semantic HTML、name/role/state、focus、contrast、target、reflow、orientation、motion、content extremes を修復する。

## 必要情報

- 要件: `SQ-016`, `FR-094`〜`FR-098`, `NFR-017`, `NFR-018`
- gap: `GAP-UI-007`
- automation/manual task と evidence matrix を共有する

## 実行計画

1. view/persona/journey × WCAG/viewport/input/content-state matrix を baseline 化する。
2. missing name/role/state、focus、contrast、target、reflow を severity 順に修復する。
3. feature task と重複する defect は owner を一意化する。
4. automated と manual evidence を結合して未達を再修復する。

## ドキュメントメンテナンス計画

`SQ-016`, `DES_UI_UX_001`、generated accessibility inventory、defect/task/evidence report を同期する。適合を自動 check だけから断定しない。

## 受け入れ条件

- [ ] relevant WCAG 2.2 A/AA 条件を主要 journey ごとに pass/NA/blocked と根拠付きで記録する。
- [ ] 320/375/768/1280px と 200%/400% zoom で content/function/focus を失わない。
- [ ] keyboard/touch/screen reader で primary journey を完了できる。
- [ ] normal/long/many/zero/loading/error/permission/partial/stale/reduced-motion を確認する。
- [ ] serious/critical defect と journey blocker を未解決のまま完了扱いしない。

## 検証計画

- component/unit、axe、Playwright responsive/visual
- contrast/target/focus computed inspection
- keyboard/screen reader/zoom/real-device manual evidence
- Web quality checks と docs/inventory freshness

## PR レビュー観点

CSS の局所 fix が別 viewport/input を壊さないか、semantic/a11y 名が利用者語彙か、permission/RAG behavior を変えていないか確認する。

## 未決事項・リスク

代表 screen reader/browser/device matrix は `OQ-UI-002` の承認まで blocked と明記し、未実施を pass にしない。
