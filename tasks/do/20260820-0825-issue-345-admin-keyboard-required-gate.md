# Issue #345 管理者設定のkeyboard journeyをrequired gateへ追加する

- 状態: do
- タスク種別: 修正
- Issue: #345
- PR: #462（更新）
- base: `main@8e542b31`
- 着手日時: 2026-08-20 08:25 JST

## 背景

Draft PR #462では管理者設定の320 CSS px reflow、contrast、touch target、状態契約をrequired E2Eへ追加済みである。一方、正本の`admin / AC-SQ016-002`は`focus candidate auditとkeyboard journey evidence待ち`としてautomated `blocked`のままである。既存`E2E-UI-KEYBOARD-NAV-001`は管理者設定への到達だけを検査し、管理セクション、overview card、ユーザー検索・絞り込みのkeyboard操作を検査していない。

open PR #461は`AdminWorkspace`と配下componentを変更するため、今回はproduction componentを変更せず、既存DOMのtest-only journey、管理画面固有CSS、正本文書・生成物の追跡に限定する。

## なぜなぜ分析

### 問題文

2026-08-20時点のDraft PR #462で、管理者設定はrequired keyboard E2Eの到達先に含まれるが、画面内の代表管理jobをkeyboard-onlyで操作する証跡と3px focus indicatorの契約がなく、`admin / AC-SQ016-002`をautomated passと判定できない。

### 確認済み事実

- `keyboard-navigation.spec.ts`は管理者設定のregion表示まで確認するが、管理画面用journeyを呼ばない。
- `AdminWorkspace`はnative button、`管理セクション`navigation、`aria-current`を実装済みである。
- `AdminUserPanel`はnative search input、status／sort select、submit buttonを実装済みである。
- `admin.css`は44px targetを定義するが、管理control用3px `:focus-visible`を定義していない。
- authored quality matrixは`admin / AC-SQ016-002`をautomated `blocked`としている。
- #461は管理画面componentを変更するが、`admin.css`とkeyboard E2Eは変更しない。

### 推定・未確認

- browser defaultまたは共通focus styleだけではrequired testの3px契約を満たさない可能性が高い。computed styleはE2Eで確定する。
- #461統合後にaccessible nameまたはDOM順序が変わる可能性があるため、最終DOMで再実走が必要である。

### 根本原因

管理画面の既存semantic controlを共有keyboard E2Eの代表jobへ結線する実装・判定ルールがなく、画面固有のfocus-visible契約も未定義だったため、画面到達の検査を`AC-SQ016-002`の合格証跡へ昇格できなかった。

### 対応範囲

- 発生原因: 管理画面journeyをrequired E2Eへ追加する。
- 流出原因: authored matrixと正本に具体的な操作・focus判定を記録し、generator／CIでstaleを拒否する。
- 競合抑制: #461が変更するproduction componentを編集せず、GET限定fixtureとCSSへ限定する。
- 残余: manual keyboard、代表screen reader、実browser zoom、#461統合後再検証は未完了を維持する。

## 目的

許可された管理者がkeyboard-onlyでoverviewからユーザー管理を開き、検索・状態・並び順を変更できることをChromium／Firefox／WebKitのrequired gateへ追加する。自動証跡をmanual keyboard、代表screen reader、実browser zoomの合格へ読み替えない。

## スコープ

- `apps/web/e2e/keyboard-navigation.spec.ts`のGET限定管理API fixtureとkeyboard journey
- `apps/web/src/styles/features/admin.css`の管理control用3px focus indicator
- overview card、section tab、ユーザー検索・status／sort・submitのTab到達、keyboard操作、URL state
- `SQ-016`、`DES_UI_UX_001`、machine-readable quality matrix／trace、正規生成文書
- task-scoped仕様分析と作業レポート

## スコープ外

- `AdminWorkspace`と配下production component、API、認証・認可、管理mutation
- 管理者設定のscreen-reader semantic合否
- representative screen reader、manual keyboard、実browser 200%／400% zoom、touch／実機
- #461の統合または変更

## 実装計画

1. 既存管理API fixtureと本番DOM contractを照合する。
2. keyboard E2EへGET限定の管理API fixtureを追加する。
3. overview card、section tab、ユーザー検索・絞り込みをkeyboard-onlyで検査し、欠落したfocus indicatorを修正する。
4. `AC-SQ016-002`の自動証跡を正本、設計、品質マトリクス、trace、生成文書へ同期する。
5. targeted test、lint、typecheck、unit、E2E、docs checkを実行し、CI失敗時は修正して再実行する。
6. Draft PR #462、受け入れ確認、セルフレビュー、Issue #345を更新する。

## ドキュメント保守計画

- 正本: `REQ_SERVICE_QUALITY_016.md`の`AC-SQ016-002`証跡状態を更新する。
- UI設計: `DES_UI_UX_001.md`にadmin keyboard contractを追加する。
- authored trace／matrix: adminのverificationと`AC-SQ016-002`判定だけを更新する。
- generated: repository generatorでWeb inventory／trace／quality matrixを同期する。
- adminの`AC-SQ016-003`とmanual／overallはblockedを維持する。

## 受け入れ条件

### AC-20260820-001: 管理overviewからユーザー管理へkeyboard-onlyで移動できる

- Given 管理APIのGET結果が読み込まれた管理者設定を表示する
- When `ユーザー管理を開く`へTabで到達してEnterを押す
- Then 3pxのvisible focus indicatorを持ち、ユーザー管理sectionへ移動してURLに`section=users`が反映される

### AC-20260820-002: ユーザー管理の代表絞り込みをkeyboard-onlyで操作できる

- Given ユーザー管理sectionを表示する
- When ユーザー検索、状態、並び順、検索buttonへTabで到達し、native keyboardで値を変更・送信する
- Then 各controlが3pxのvisible focus indicatorを持つ
- Then 検索語、`userStatus=suspended`、`userSort=updatedDesc`がURL stateへ反映される

### AC-20260820-003: 自動証跡を一意に追跡できる

- Given admin keyboard journeyをrequired gateへ追加した
- When 正本、設計、authored trace／matrix、生成文書を確認する
- Then `admin → SQ-016 → AC-SQ016-002 → E2E-UI-KEYBOARD-NAV-001 → Chromium／Firefox／WebKit required`を追跡できる
- Then adminの`AC-SQ016-002`はautomatedのみ`pass`、manual／overallは`blocked`を維持する
- Then `AC-SQ016-003`はblockedのままである

### AC-20260820-004: 変更範囲に必要な検証が成功する

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
- `npm run docs:web-inventory:check`
- `python3 scripts/validate_docs.py`
- `git diff --check`

## PRレビュー観点

- keyboard操作がclick／programmatic focusで代替されていないか。
- test fixtureがGET routeだけに限定され、production pathへmock dataを入れていないか。
- #461と重なるproduction componentを変更していないか。
- URL state反映をobservable resultとして待っているか。
- automated evidenceをmanual passへ読み替えていないか。

## リスク

- #461統合後にaccessible name／DOM順序が変わる可能性があり、最終DOMで再実走が必要。
- Chromium／Firefox／WebKit E2Eはbrowser keyboard contractのproxyで、代表screen readerや実機を代替しない。
- adminのsemantic `AC-SQ016-003`は今回の対象外で引き続きblocked。
