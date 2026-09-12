# Issue #345 文書画面のkeyboard journeyをrequired gateへ追加する

- 状態: do
- タスク種別: 機能追加
- Issue: #345
- PR: #462（更新）
- base: `main@8e542b31`
- 着手日時: 2026-08-19 08:50 JST

## 背景

Draft PR #462では文書画面の320 CSS px reflow、状態契約、Chromium semantic contractをrequired E2Eへ追加済みである。一方、正本の`documents / AC-SQ016-002`は`focus candidate auditとkeyboard journey evidence待ち`としてautomated `blocked`のままである。既存`E2E-UI-KEYBOARD-NAV-001`はドキュメント画面への到達だけを検査し、検索・絞り込み・文書選択・detail dialog内のfocus移動と復帰を検査していない。

open PR #461は`DocumentWorkspace`と配下componentを変更するため、今回はproduction componentを変更せず、既存DOMのtest-only journeyと正本文書・生成物の追跡に限定する。

## 目的

許可された文書をkeyboard-onlyで検索・絞り込み・選択し、detail dialogを操作して元のtriggerへ復帰できることをChromium／Firefox／WebKitのrequired gateへ追加する。自動証跡をmanual keyboard、代表screen reader、実browser zoomの合格へ読み替えない。

## スコープ

- `apps/web/e2e/keyboard-navigation.spec.ts`のtest-only文書fixtureとkeyboard journey
- `apps/web/src/styles/features/documents.css`の対象control／dialog action用3px focus indicator
- 検索・filter・sort・page-size・document detail triggerのTab到達と3px focus indicator
- dialog初期focus、Tab／Shift+Tab focus trap、Escape close、trigger focus restore
- `SQ-016`、`DES_UI_UX_001`、machine-readable quality matrix、正規生成文書
- task-scoped仕様分析と作業レポート

## スコープ外

- `DocumentWorkspace`と配下production component、API、認証・認可、文書mutation
- contrastの合否変更
- representative screen reader、manual keyboard、実browser 200%／400% zoom、touch／実機
- #461の統合または変更

## 実装計画

1. 既存semantic fixtureと本番DOM contractを照合する。
2. keyboard E2EへGET限定の文書fixtureを追加する。
3. documentsの検索・filter・sort・選択・dialog focus trap／restoreをkeyboard-onlyで検査し、欠落したfocus indicatorを修正する。
4. `AC-SQ016-002`の自動証跡を正本、設計、品質マトリクス、生成文書へ同期する。
5. targeted test、lint、typecheck、unit、E2E、docs checkを実行し、CI失敗時は修正して再実行する。
6. Draft PR #462、受け入れ確認、セルフレビュー、Issue #345を更新する。

## ドキュメント保守計画

- 正本: `REQ_SERVICE_QUALITY_016.md`の`AC-SQ016-002`証跡状態を更新する。
- UI設計: `DES_UI_UX_001.md`のdocuments行を更新する。
- authored matrix: `tools/web-inventory/ui-quality-matrix.json`のdocuments判定だけを更新する。
- generated: repository generatorで`docs/generated/web-ui-quality-matrix.md`を同期する。
- `AC-SQ016-004`とmanual／overallはblockedを維持する。

## 受け入れ条件

### AC-20260819-001: 文書の主要理解導線をkeyboard-onlyで操作できる

- Given 文書とフォルダが各1件ある文書画面を表示する
- When Tabでフォルダ検索、ファイル名検索、種別・状態・所属フォルダ・並び替え・表示件数へ順に到達してkeyboard入力する
- Then 各controlが3pxのvisible focus indicatorを持ち、入力値／選択値が反映される
- When 対象文書のdetail triggerへTabで到達してEnterを押す
- Then 対象文書のdetail dialogが開き、close buttonへfocusする

### AC-20260819-002: dialog focusを閉じ込めてtriggerへ復帰できる

- Given 文書detail dialogが開いている
- When Shift+Tab／Tabでdialog境界を移動する
- Then focusはdialog内で循環し、背景へ逸脱しない
- When Escapeを押す
- Then dialogが閉じ、元のdetail triggerへfocusが戻る

### AC-20260819-003: 自動証跡を一意に追跡できる

- Given documents keyboard journeyをrequired gateへ追加した
- When 正本、設計、authored matrix、生成文書を確認する
- Then `documents → SQ-016 → AC-SQ016-002 → E2E-UI-KEYBOARD-NAV-001 → Chromium／Firefox／WebKit required`を追跡できる
- Then documentsの`AC-SQ016-002`はautomatedのみ`pass`、manual／overallは`blocked`を維持する
- Then `AC-SQ016-004`はblockedのままである

### AC-20260819-004: 変更範囲に必要な検証が成功する

- targeted Playwright、Web lint／typecheck／unit／build、trace／matrix／semantic tests、docs checkが成功する
- GitHub ActionsのWeb UI Quality、MemoRAG CI、semverがfinal headで成功する
- 未実施のmanual検証は未完了として明記する

## 検証計画

- `npm run lint -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run test -w @memorag-mvp/web`
- `npm run build -w @memorag-mvp/web`
- `npm run test:e2e:ui-quality -w @memorag-mvp/web -- --grep E2E-UI-KEYBOARD-NAV-001`
- `npm run test:e2e:cross-browser:required -w @memorag-mvp/web -- --grep E2E-UI-KEYBOARD-NAV-001`
- `node --test tools/web-inventory/ui-traceability.test.mjs tools/web-inventory/ui-quality-matrix.test.mjs tools/web-inventory/semantic-ui-contract.test.mjs tools/web-inventory/manual-a11y-evidence.test.mjs`
- `npm run docs:web-quality-matrix:check`
- `python3 scripts/validate_docs.py`
- `git diff --check`

## PRレビュー観点

- keyboard操作がclick／programmatic focusで代替されていないか。
- dialogのfocus trapとtrigger restoreを両方向で検査しているか。
- test fixtureがGET routeだけに限定され、production pathへmock dataを入れていないか。
- #461と競合するproduction pathを変更していないか。
- automated evidenceをmanual passへ読み替えていないか。

## リスク

- #461統合後にaccessible name／DOM順序が変わる可能性があり、最終DOMで再実走が必要。
- Chromium／Firefox／WebKit E2Eはbrowser keyboard contractのproxyで、代表screen readerや実機を代替しない。
- contrastは今回の対象外で、`AC-SQ016-004`は引き続きblocked。
