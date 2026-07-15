# Issue #345 共通 UI state と回復契約を実装する

状態: todo

タスク種別: 機能追加

## 背景

共通 error は文字列 banner 中心で、loading、empty、permission、partial、stale、retry を画面横断で区別できず、false zero/blank や対象不明の失敗を生み得る。

## 目的・対象範囲

`FR-095` に基づく shared state primitive と feature adapter を導入し、主要 view の非定常状態を visible/programmatic に区別して対象付き recovery を提供する。

## 必要情報

- gap: `GAP-UI-003`
- 検証 ID: `E2E-UI-STATE-001`
- No Mock Product UI: 未取得値を固定 count/date/user/capacity で補わない

## 実行計画

1. state discriminated union と public-safe display metadata を設計する。
2. status/alert/busy/target/retry primitive を native semantics 中心に実装する。
3. chat/history/questions/documents/benchmark/admin へ段階適用する。
4. variant component test と representative E2E を追加する。

## ドキュメントメンテナンス計画

`FR-095`, `NFR-017`, `DES_UI_UX_001`、feature docs と generated a11y inventory を同期する。API error schema を変更する場合は API docs/test を同一 scope で更新する。

## 受け入れ条件

- [ ] loading/empty/error/permission/partial/stale/retrying/recovered が異なる state として表現される。
- [ ] target region、原因の public-safe 表示、許可された retry/back/support action が関連付く。
- [ ] alert/status/busy semantics と focus behavior が keyboard/screen reader で認識できる。
- [ ] failure/未取得/permission を 0 件または blank に変換しない。
- [ ] retry 成否と partial result が対象単位で更新される。

## 検証計画

- shared primitive component test
- representative state fixture E2E/axe/manual screen-reader check
- Web lint/typecheck/test/build、inventory/docs check

## PR レビュー観点

API detail の過剰開示、generic global-only message、mock fallback、feature 独自 state の意味変化がないか確認する。

## 未決事項・リスク

一括移行は regression が大きいため、contract を固定して feature ごとに完了 evidence を残す。
