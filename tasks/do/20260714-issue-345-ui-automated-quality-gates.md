# Issue #345 UI 自動品質 gate を PR CI に導入する

状態: do

タスク種別: テスト追加

## 背景

Playwright は desktop Chromium 中心で、E2E workflow は手動 dispatch である。axe、mobile Chromium、代表 visual、browser scope を merge 前に保証できない。

## 目的・対象範囲

`NFR-018` に基づき representative login/chat/documents/questions/admin journey の a11y、mobile、visual と承認 browser scope を deterministic fixture で PR required gate にする。

## 必要情報

- gap: `GAP-UI-008`
- `OQ-UI-001`: Firefox/WebKit required/scheduled scope
- CI runtime、artifact、failure triage policy

## 今回の着手（2026-07-16）

- pull request の UI 関連 path 変更時に Chromium の axe / mobile / visual を required workflow として実行する。
- Firefox / WebKit は週次および手動 dispatch の scheduled scope とし、未実行を pass と表示しない。
- failure 時は Playwright report、test-results、trace、screenshot を artifact として保持する。
- manual screen reader、実 browser 200% / 400% zoom、real-device は本 task で代替せず、専用 manual evidence task に残す。

## 実行計画

1. change detection と representative matrix/cost budget を決定する。
2. axe serious/critical、320/375px Chromium、visual test を CI に統合する。
3. Firefox/WebKit の approved required/scheduled scope を実装する。
4. artifact、diagnostic、retry/flaky policy と PR summary を整える。

## ドキュメントメンテナンス計画

`NFR-018`, `SQ-016`, `DES_UI_UX_001`、CI/Taskfile/Playwright docs と PR template を同期する。skip を pass と表示しない。

## 受け入れ条件

- [ ] representative views の serious/critical axe violation が required check を fail させる。
- [ ] mobile Chromium 320/375px primary journeys が PR required scope で動く。
- [ ] 300 pixelsを超える deterministic visual mismatch が非0となり artifact を取得できる。
- [ ] Firefox/WebKit の scope/owner/cadence/failure handling が実装・文書化される。
- [ ] UI 非変更 PR の不要な高コスト実行を避けつつ shared Web/CI change を漏らさない。

## CI 初回検出（2026-07-16）

- Chromium gate は chat composer note の contrast 3.02:1（WCAG AA 4.5:1 未達）を検出したため、text color を `#68758f`（white背景で4.64:1）へ修正した。
- visual baseline は stable capture 後も最大219 pixelsの差が残ったため、最大300 pixelsだけを OS / browser anti-aliasing tolerance として明示した。超過差分は引き続き failure とする。
- 修正後の CI は再実行待ちであり、受け入れ条件は未完了のまま維持する。

## 検証計画

- workflow syntax、Playwright list/target run、failure fixture
- local/CI artifact and summary inspection
- Taskfile resolved command、docs check

## PR レビュー観点

required status、continue-on-error 集約、flaky retry による false pass、secret/network 依存、fixture の本番混入を確認する。

## 未決事項・リスク

browser matrix の最終 required 範囲は `OQ-UI-001`。CI 時間増は測定し、未承認 scope を勝手に required 化しない。
