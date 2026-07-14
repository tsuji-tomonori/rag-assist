# Issue #345 権限対応 mobile navigation を完成する

保存先: `tasks/do/20260714-issue-345-mobile-navigation.md`

状態: do

タスク種別: 機能追加

依存: draft PR #348 / branch `codex/issue-345-uiux-foundation` の UI trace foundation。未 merge のため本 branch は foundation head `8e8cf588` から作成し、PR #348 merge 後に main 差分へ収束させる。

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

## 作業前チェックリスト

- [x] 最大権限と最小権限の destination 集合を source/test で固定する。
- [x] 320px で個人設定を含む全許可 destination が欠落する現状を再現する。
- [x] focus return、Escape、current/expanded/name、safe area、dynamic viewport の実装方針を testable にする。
- [x] production API/RAG/authorization と test-only fixture の境界を変更しない。

## Done 条件

- [x] mobile navigation、responsive CSS、unit/E2E、trace/generated docs が同じ behavior を表す。
- [x] Web lint/typecheck/test/build、mobile Chromium、docs/inventory check、pre-commit が成功する。
- [x] keyboard、400% zoom 相当、accessibility tree、可能な代表 screen reader/real-device の結果と未実施理由を report/PR に残す。
- [ ] 全受け入れ条件を満たす。代表 screen reader/real-device が未検証なら task を `done` にせず、manual evidence task と blocker を明示する。

## ドキュメントメンテナンス計画

`FR-094`、`DES_UI_UX_001`、generated Web inventory と操作 evidence を実装に同期する。public API/OpenAPI への影響はない想定だが、permission contract を変える場合は別途確認する。

## 受け入れ条件

- [x] standard/assignee/document/admin persona の許可済み destination と個人設定が 320px と 400% zoom 相当で欠落しない（320px reflow automation。実 browser 400% zoom は未検証）。
- [x] page-level two-dimensional scroll、重なり、画面外だけの control がない。
- [ ] keyboard/touch/screen reader で current、expanded、name、focus return が判別できる（keyboard と semantic role/state は成功、実 touch / screen reader は未検証）。
- [x] 権限外 destination を表示せず、UI permission は API authorization の代替にならない。
- [ ] long label、safe area、virtual keyboard、reduced motion を含む自動・手動 evidence を残す（long account、CSS safe-area/dynamic viewport、reduced motion は確認。virtual keyboard / real-device は未検証）。

## 実施結果

- `RailNav` を permission-aware destination list と 720px 以下の disclosure menu へ再構成した。
- `aria-expanded` / `aria-controls` / `aria-current` / accessible name、open 時 current focus、Escape/選択後の trigger focus return を実装した。
- safe-area inset、`100dvh`、panel 内縦 scroll、48px destination target、長文折返し、明示 focus ring を追加した。
- `E2E-UI-NAV-001` / `002` は Chromium 4本の対象 suite 内で成功し、320x720 baseline を目視確認した。
- 未実施の代表 screen reader、実 touch、実 browser 400% zoom、safe-area/virtual-keyboard real-device は `tasks/todo/20260714-issue-345-manual-a11y-evidence.md` の残余であり、本 task は `do` を維持する。

## 検証計画

- `RailNav` component/unit test
- Playwright 320/375px、最大権限/最小権限 navigation
- 400% zoom、keyboard、representative screen reader の手動確認
- Web lint/typecheck/test/build、inventory/docs check

## PR レビュー観点

全許可 destination が reachable か、CSS で control を消していないか、focus/認可境界/No Mock Product UI を弱めていないかを確認する。

## 未決事項・リスク

mobile navigation の表現方式は実装調査で選ぶ。表示方式より destination reachability と semantic state を優先する。
