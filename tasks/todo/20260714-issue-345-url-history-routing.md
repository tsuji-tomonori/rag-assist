# Issue #345 URL・history・denied route 復帰を完成する

状態: todo

タスク種別: 機能追加

## 背景

`useAppShellState` は query/path と `popstate` を読むが、利用者遷移を `replaceState` で書くため back/forward の意味が不完全で、権限外・不正 URL は silent fallback し得る。

## 目的・対象範囲

全 `AppView` と承認された workspace state の canonical URL、push/replace 方針、reload/bookmark/back/forward/deep-link、denied/invalid recovery を `FR-094` と `FR-097` に合わせる。

## 必要情報

- gap: `GAP-UI-002`
- 検証 ID: `E2E-UI-ROUTE-001`, `E2E-UI-ROUTE-002`
- access guards: `AppRoutes` と server-authoritative API permission

## 実行計画

1. user navigation、normalization、transient state ごとの push/replace policy を固定する。
2. route parser/serializer と permission resolution を fail-closed にする。
3. protected fetch 前に denied target を解決し、明示的 recovery state を表示する。
4. unit/E2E で reload/history/deep link/invalid/obsolete/denied を検証する。

## ドキュメントメンテナンス計画

`FR-094`, `FR-097`, `DES_UI_UX_001` と generated route trace を同期する。CloudFront entrypoint や API route を変える場合は `TC-003` の task と分離する。

## 受け入れ条件

- [ ] visible view/restorable state と URL が一致し、user navigation は戻る履歴を保持する。
- [ ] reload、bookmark、back、forward、direct URL で同じ状態または説明された安全な代替へ復元する。
- [ ] denied target は protected data を fetch/render せず、programmatic permission state と許可済み復帰先を示す。
- [ ] unknown/obsolete/invalid value は silent misrouting せず canonical URL へ正規化する。
- [ ] URL に機微情報を過剰露出しない。

## 検証計画

- route parser/serializer/history unit test
- permission persona 別 Playwright deep-link test
- Web typecheck/test/build、docs/inventory check

## PR レビュー観点

browser history の意図、protected fetch の順序、既存 document deep link の互換性、非開示境界を確認する。

## 未決事項・リスク

document selection ID の URL 保持範囲は privacy と再開性の trade-off を設計レビューで確定する。
