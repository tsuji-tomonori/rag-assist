# Issue #345 権限対応 mobile navigation を完成する

状態: todo

タスク種別: 機能追加

## 背景

720px 以下で account/profile 導線と rail label が消え、最大権限 persona の全 destination を狭幅・高 zoom で操作できる保証がない。`FR-094` と `SQ-016` の未達を解消する。

## 目的・対象範囲

`RailNav`、app shell、responsive CSS と navigation test を対象に、permission に応じた全 `AppView` と個人設定を 320px/400% zoom 相当でも到達可能にする。API authorization は変更しない。

## 必要情報

- 要件: `FR-094`, `SQ-016`, `NFR-017`
- 設計: `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- gap: `GAP-UI-001`
- 検証 ID: `E2E-UI-NAV-001`, `E2E-UI-NAV-002`

## 実行計画

1. persona/permission ごとの destination 数と focus/overflow behavior を fixture 化する。
2. semantic overflow/menu または同等の narrow navigation を実装する。
3. current/expanded/name/focus restore/safe-area/virtual-keyboard 条件を整える。
4. unit、mobile E2E、visual、manual matrix を実行して修復する。

## ドキュメントメンテナンス計画

`FR-094`、`DES_UI_UX_001`、generated Web inventory と操作 evidence を実装に同期する。public API/OpenAPI への影響はない想定だが、permission contract を変える場合は別途確認する。

## 受け入れ条件

- [ ] standard/assignee/document/admin persona の許可済み destination と個人設定が 320px と 400% zoom 相当で欠落しない。
- [ ] page-level two-dimensional scroll、重なり、画面外だけの control がない。
- [ ] keyboard/touch/screen reader で current、expanded、name、focus return が判別できる。
- [ ] 権限外 destination を表示せず、UI permission は API authorization の代替にならない。
- [ ] long label、safe area、virtual keyboard、reduced motion を含む自動・手動 evidence を残す。

## 検証計画

- `RailNav` component/unit test
- Playwright 320/375px、最大権限/最小権限 navigation
- 400% zoom、keyboard、representative screen reader の手動確認
- Web lint/typecheck/test/build、inventory/docs check

## PR レビュー観点

全許可 destination が reachable か、CSS で control を消していないか、focus/認可境界/No Mock Product UI を弱めていないかを確認する。

## 未決事項・リスク

mobile navigation の表現方式は実装調査で選ぶ。表示方式より destination reachability と semantic state を優先する。
