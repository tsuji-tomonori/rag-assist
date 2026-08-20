# Issue #345 管理者設定のsemantic contractをrequired gateへ追加する

- 状態: do
- タスク種別: 修正
- Issue: #345
- PR: #462（更新）
- base: `main@8e542b31`
- 着手日時: 2026-08-21 08:28 JST

## 背景

Draft PR #462では管理者設定のreflow、keyboard、contrast、touch target、状態契約をrequired E2Eへ追加済みである。一方、正本の`admin / AC-SQ016-003`だけはautomated `blocked`で、既存`E2E-UI-SR-SEMANTICS-001`にも管理者設定のChromium accessibility tree契約がない。

open PR #461は`AdminWorkspace`と配下componentを変更するため、今回はproduction componentを変更せず、既存DOMのtest-only GET fixture、共有AX E2E、正本文書・生成物の追跡に限定する。

## なぜなぜ分析

### 問題文

2026-08-21時点のDraft PR #462で、管理者設定はrequired keyboard E2Eの対象だが、landmark、管理section、ユーザー検索・filter、一覧tableのname／role／valueをChromium accessibility treeで検査する証跡がなく、`admin / AC-SQ016-003`をautomated passと判定できない。

### 確認済み事実

- `screen-reader-semantics.spec.ts`はlogin、chat、documents、history、favorites、assignee、benchmark、profileを検査するがadminを検査しない。
- `AdminWorkspace`と`AdminUserPanel`はregion、heading、navigation、native button／input／select、form、tableを実装済みである。
- authored quality matrixは`admin / AC-SQ016-003`だけをautomated `blocked`としている。
- #461は管理画面production componentを変更するため、同じcomponentへの変更は競合・重複になる。

### 推定・未確認

- 既存DOMのaccessible name／role／valueはChromium AX treeに露出する見込みだが、required E2E実走で確定する。
- #461統合後にDOMまたはaccessible nameが変わる可能性があるため、最終DOMで再実走が必要である。

### 根本原因

管理画面の既存semantic DOMを共有required AX E2Eへ結線する画面別契約と、machine-readable合否更新の手順が未実装だったため、実装済みsemanticsを継続検知できずblockedのまま残った。

### 対応範囲

- 発生原因: 管理画面の代表semantic contractを共有required AX E2Eへ追加する。
- 流出原因: authored matrix／traceと正本に一意な`AC-SQ016-003`証跡を記録し、generator／CIでstaleを拒否する。
- 競合抑制: #461が変更するproduction component、API、認証、mutationを編集しない。
- 残余: representative screen reader、manual keyboard、実browser zoom、Firefox／WebKit native AX tree、#461統合後再検証は未完了を維持する。

## 目的

許可された管理者が管理者設定を表示したとき、主要landmarkとユーザー管理の検索・filter・一覧が安定したname／role／valueを持つことをChromium required gateで検査する。自動AX証跡を代表screen readerのmanual合格へ読み替えない。

## スコープ

- `apps/web/e2e/screen-reader-semantics.spec.ts`のGET限定管理API fixtureとAX contract
- `SQ-016`、`DES_UI_UX_001`、machine-readable quality matrix／trace、正規生成文書
- task-scoped仕様分析と作業レポート

## スコープ外

- `AdminWorkspace`と配下production component、API、認証・認可、管理mutation
- representative screen reader、manual keyboard、実browser 200%／400% zoom、touch／実機
- Firefox／WebKit native accessibility tree
- #461の統合または変更

## 受け入れ条件

### AC-20260821-001: 管理者設定の主要構造をAX treeで識別できる

- Given 管理APIのGET結果が読み込まれた管理者設定を表示する
- When Chromium accessibility treeを取得する
- Then main、画面navigation、管理者設定region／heading、管理セクションnavigation、概要／ユーザーbuttonをname／roleで識別できる

### AC-20260821-002: ユーザー管理の代表controlと一覧をAX treeで識別できる

- Given ユーザーsectionを表示する
- When Chromium accessibility treeを取得する
- Then ユーザー管理region／heading、検索textbox、状態／並び順comboboxの表示value、作成form、ユーザー一覧tableをname／role／valueで識別できる

### AC-20260821-003: 自動証跡を一意に追跡できる

- Given admin semantic contractをrequired gateへ追加した
- When 正本、設計、authored trace／matrix、生成文書を確認する
- Then `admin → SQ-016 → AC-SQ016-003 → E2E-UI-SR-SEMANTICS-001 → Chromium required`を追跡できる
- Then adminの`AC-SQ016-003`はautomatedのみ`pass`、manual／overallは`blocked`を維持する

### AC-20260821-004: 変更範囲に必要な検証が成功する

- targeted Playwright、Web lint／typecheck／unit／build、trace／matrix／semantic tests、docs checkが成功する
- GitHub ActionsのWeb UI Quality、MemoRAG CI、semverがfinal headで成功する
- 未実施のmanual検証と#461統合後再検証は未完了として明記する

## 検証計画

- `npm run lint -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run test -w @memorag-mvp/web`
- `npm run build -w @memorag-mvp/web`
- `npm run test:e2e:ui-quality -w @memorag-mvp/web -- --grep E2E-UI-SR-SEMANTICS-001`
- `node --test tools/web-inventory/ui-traceability.test.mjs tools/web-inventory/ui-quality-matrix.test.mjs tools/web-inventory/semantic-ui-contract.test.mjs tools/web-inventory/manual-a11y-evidence.test.mjs`
- `npm run docs:web-inventory:check`
- `python3 scripts/validate_docs.py`
- `git diff --check`

## PRレビュー観点

- fixtureがGET routeだけに限定され、production pathへmock dataを入れていないか。
- AX contractが表示文言だけでなくname／role／valueを検査しているか。
- #461と重なるproduction componentを変更していないか。
- automated evidenceをmanual passへ読み替えていないか。

## リスク

- #461統合後にaccessible name／DOMが変わる可能性があり、最終DOMで再実走が必要。
- Chromium AX treeは代表screen readerやFirefox／WebKit native accessibility treeを代替しない。

