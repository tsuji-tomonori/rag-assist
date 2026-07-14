# Issue #345 URL・history・denied route 復帰を完成する

保存先: `tasks/do/20260714-issue-345-url-history-routing.md`

状態: do

タスク種別: 機能追加

依存: draft PR #348 / branch `codex/issue-345-uiux-foundation` の UI trace foundation。未 merge のため本 branch は foundation head `8e8cf588` から作成し、PR #348 merge 後に main 差分へ収束させる。

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

## 作業前チェックリスト

- [x] 現行 query/path parser、document URL state、`replaceState`、`popstate`、permission fallback を再現する。
- [x] user navigation は push、normalization/permission recovery/transient filter は replace とする policy を固定する。
- [x] denied route で protected loader/render が走らず、非開示の復帰 message が programmatic に伝わる設計にする。
- [x] existing document deep link と URL 内の既存識別子範囲を不用意に拡張しない。

## Done 条件

- [x] parser/serializer/history/permission recovery と UI notice が unit/E2E で観測可能である。
- [x] reload/bookmark/back/forward/direct/invalid/obsolete/denied の自動検証が成功する。
- [x] Web lint/typecheck/test/build、docs/inventory check、pre-commit が成功する。
- [ ] trace manifest、generated docs、task report、PR acceptance/self-review が同期し、全受け入れ条件を満たす。

## ドキュメントメンテナンス計画

`FR-094`, `FR-097`, `DES_UI_UX_001` と generated route trace を同期する。CloudFront entrypoint や API route を変える場合は `TC-003` の task と分離する。

## 受け入れ条件

- [x] visible view/restorable state と URL が一致し、user navigation は戻る履歴を保持する。
- [x] reload、bookmark、back、forward、direct URL で同じ状態または説明された安全な代替へ復元する。
- [x] denied target は protected data を fetch/render せず、programmatic permission state と許可済み復帰先を示す。
- [x] unknown/obsolete/invalid value は silent misrouting せず canonical URL へ正規化する。
- [x] URL に機微情報を過剰露出しない。

## 実施結果

- exact `AppView` と安全な document deep-link の parser/serializer を `appRoute.ts` に分離した。
- user navigation は `pushState`、legacy/unknown/obsolete/conflicting query/path、permission recovery、document transient state は `replaceState` へ分けた。
- unknown query、重複 query、空 document state、不正 sort、未定義 hash、path-escaping/malformed segment を canonical URL へ正規化した。
- permission 解決前に protected view を描画せず、denied admin deep link で protected request が発生しないことを E2E で確認した。
- `E2E-UI-ROUTE-001` / `002`、route/hook unit、Web 321 tests、build/typecheck/lint、docs/API trace gate が成功した。PR acceptance/self-review と task lifecycle は PR 作成後に同期する。

## 検証計画

- route parser/serializer/history unit test
- permission persona 別 Playwright deep-link test
- Web typecheck/test/build、docs/inventory check

## PR レビュー観点

browser history の意図、protected fetch の順序、既存 document deep link の互換性、非開示境界を確認する。

## 未決事項・リスク

document selection ID の URL 保持範囲は privacy と再開性の trade-off を設計レビューで確定する。
