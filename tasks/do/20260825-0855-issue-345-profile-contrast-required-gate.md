# Issue #345 個人設定 contrast required gate

- 状態: do
- タスク種別: 修正
- 対象Issue: #345
- 対象PR: #462

## 背景

`SQ-016`はtext、meaningful non-text UI、focus indicatorのcontrastと、色だけに依存しない状態表現を`AC-SQ016-004`に要求している。PR #462ではprofileのkeyboard、Chromium AX tree、session-only statusがrequired gateに入っている一方、screen固有のcontrast automated statusだけが`blocked`である。

## 目的

個人設定の代表的なtext contrast、送信キーselectの3px focus indicator contrast、変更結果の可視textとpolite semanticsをChromium required E2Eで検査し、`profile → SQ-016 → AC-SQ016-004 → E2E`の追跡を正本・authored matrix・生成文書で同期する。

## スコープ

- 個人設定regionの320 / 1280 CSS pxにおけるaxe `color-contrast`検査
- 送信キーselectの実computed 3px focus indicator幅・色・背景と3:1以上のcontrast検査
- 変更結果が可視text、`role=status`、`aria-live=polite`を併用し、色だけで伝達されないことの検査
- `SQ-016`、`DES_UI_UX_001`、UI trace、quality matrix、generated Web docsの同期
- PR #462とIssue #345の進捗証跡更新

## 対象外

- production component / CSS / API / 認可の変更
- `FR-051`の永続化、保存失敗/retry/permission、N/A分類、owner判断
- representative screen reader、手動keyboard、実browser 200% / 400% zoom、text-only zoom、OS scaling、touch / real device
- PR #461が所有するshared UI primitiveとproduction componentの変更

## なぜなぜ分析

### 問題

個人設定の`AC-SQ016-004`は、required E2Eに全画面axe baselineと3px focus indicatorがあるにもかかわらず、screen固有のpositive evidenceへ追跡されず`automated: blocked`である。

### confirmed

- `E2E-UI-CROSS-SCREEN-AUDIT-001`は1280pxで8画面のaxe serious / critical violationをfailさせる。
- 同auditは`color-contrast` violationを`AC-SQ016-004: fail`へ写像するが、absence of violationをscreen固有のpassへ確定しない。
- 送信キーselectには3px `:focus-visible` indicatorが実装済みだが、contrast ratioを測定しない。
- 送信キー変更結果は可視text、`role=status`、`aria-live=polite`を持つが、contrast evidenceと同じcontractに束ねられていない。
- PR #461のchanged filesに`PersonalSettingsView.tsx`と`layout.css`は含まれない。

### inferred

- 既存baselineは違反検出を主目的に設計され、focus indicatorと色非依存cueを含むscreen固有の合格条件を登録していないため、matrixを安全にpassへ昇格できない。

### open question

- representative screen reader、実browser zoom、実機での知覚確認はこのenvironmentでは実施できず、manual statusとoverall statusを`blocked`に維持する。
- `FR-051`の永続化と失敗・permission stateはowner判断待ちであり、`AC-SQ016-007`を本taskで変更しない。

### 根本原因

axeの全画面baselineとkeyboard focus幅・session statusの証跡が別々に存在し、`AC-SQ016-004`が要求するtext・focus indicator・color independenceを、個人設定固有のpositive required contractとして一意に結ぶE2E IDが欠落している。

### 全影響範囲への対応

個人設定限定の`E2E-UI-CONTRAST-004`を追加し、320 / 1280 CSS pxのtext contrast、実computed focus indicator 3:1、変更statusの複数cueを同一証跡に束ねる。trace/matrix/正本/生成物を同期し、`FR-051`とmanual evidenceは未検証のまま維持する。

## 実装計画

1. required Chromium UI quality suiteへ個人設定contrast E2Eを追加する。
2. E2E IDをauthored traceへ登録し、profileの`SQ-016`追跡と`AC-SQ016-004`を接続する。
3. authored quality matrixのprofile `AC-SQ016-004` automated statusだけをpassへ更新する。
4. canonical requirement/designとgenerated Web docsを正規generatorで同期する。
5. targeted E2E、lint、typecheck、unit、build、trace/matrix、docs checkを実行する。
6. report、commit、Draft PR #462、受け入れ確認、セルフレビュー、Issue #345を更新する。

## ドキュメント保守計画

- 要求の意味や閾値は変更せず、`SQ-016`の現在の自動証跡へprofile contrast contractを追記する。
- `DES_UI_UX_001`のprofile screen traceへ`AC-SQ016-004`とE2E境界を追記する。
- authored sourceは`tools/web-inventory/ui-traceability.json`と`ui-quality-matrix.json`に限定し、`docs/generated/`はgenerator出力だけを更新する。

## 受け入れ条件

- [ ] `E2E-UI-CONTRAST-004`が320 / 1280 CSS pxの個人設定text contrastをaxeで検査し、`color-contrast` violation 0を要求する。
- [ ] 同E2Eが送信キーselectの実computed 3px focus indicatorと背景比3:1以上を検査する。
- [ ] 同E2Eが変更statusの可視text、`role=status`、`aria-live=polite`を検査し、色だけに依存しない状態cueを証明する。
- [ ] `profile → SQ-016 → AC-SQ016-004 → E2E-UI-CONTRAST-004`が正本、authored trace/matrix、生成文書で一致する。
- [ ] profileの`AC-SQ016-004` automated statusだけがpassとなり、manual / overallと`AC-SQ016-007`はblockedを維持する。
- [ ] 選定したlint、typecheck、unit、build、targeted E2E、trace/matrix、docs checkが成功する。
- [ ] Draft PR #462に実装headと検証結果を反映し、受け入れ確認・セルフレビュー・Issue #345進捗を日本語で記録する。

## 検証計画

- `npm run lint -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/web`
- `TZ=UTC npm test -w @memorag-mvp/web`
- `npm run build -w @memorag-mvp/web`
- `npm exec -w @memorag-mvp/web -- playwright test e2e/visual-regression.spec.ts --project=chromium --grep E2E-UI-CONTRAST-004`
- `npm run docs:web-trace:test`
- `npm run test:web-semantic-ui`
- `npm run docs:web-inventory:check`
- `python3 scripts/validate_docs.py`
- `git diff --check`

## PRレビュー観点

- automated axe/computed evidenceをmanual contrast / screen reader / real zoom合格へ読み替えていないか。
- focus indicatorのcontrastを実computed valueから測定しているか。
- change statusの複数cueがproduction挙動に由来し、`FR-051`の永続保存を暗黙に保証していないか。
- PR #461のproduction pathと競合していないか。
- 正本と生成物の所在が重複していないか。

## リスク

- axeはcanvas/image/brand fidelityやmanual知覚を完全には代替しない。
- CSS viewport 320pxは実browser 400% zoomを代替しない。
- PlaywrightのChromium computed styleはFirefox / WebKit native renderingやrepresentative screen readerを代替しない。
