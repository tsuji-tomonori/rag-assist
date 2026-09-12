# Issue #345 担当者対応 contrast required gate

- 状態: do
- タスク種別: 修正
- 対象Issue: #345
- 対象PR: #462

## 背景

`SQ-016`はtext、meaningful non-text UI、focus indicatorのcontrastと、色だけに依存しない状態表現を`AC-SQ016-004`に要求している。PR #462では担当者対応のkeyboard、Chromium AX tree、loading／error／permission／retry証跡がrequired gateに入っている一方、screen固有のcontrast automated statusだけが`blocked`である。

## 目的

担当者対応の代表的なtext contrast、3px focus indicator contrast、permission stateの非色依存cueをChromium required E2Eで検査し、`assignee → SQ-016 → AC-SQ016-004 → E2E`の追跡を正本・authored matrix・生成文書で同期する。

## スコープ

- 担当者対応regionの320 / 1280 CSS pxにおけるaxe `color-contrast`検査
- 検索入力の実computed 3px focus indicator幅・色・背景と3:1以上のcontrast検査
- permission stateが可視text、`alert`、private content suppressionを併用し、色だけで伝達しないことの検査
- `SQ-016`、`DES_UI_UX_001`、UI trace、quality matrix、generated Web docsの同期
- PR #462とIssue #345の進捗証跡更新

## 対象外

- production component / CSS / API / 認可の変更
- documents / profileの`AC-SQ016-004`
- representative screen reader、手動keyboard、実browser 200% / 400% zoom、text-only zoom、OS scaling、touch / real device
- PR #461が所有するshared UI primitiveの変更

## なぜなぜ分析

### 問題

担当者対応の`AC-SQ016-004`は、required E2Eに全画面axe baselineがあるにもかかわらず、screen固有のpositive evidenceへ追跡されず`automated: blocked`である。

### confirmed

- `E2E-UI-CROSS-SCREEN-AUDIT-001`は1280pxで8画面のaxe serious / critical violationをfailさせる。
- 同auditは`color-contrast` violationを`AC-SQ016-004: fail`へ写像するが、absence of violationをscreen固有のpassへ確定しない。
- 担当者対応の検索入力には3px `:focus-visible` indicatorが実装済みだが、contrast ratioを測定しない。
- 担当者対応のHTTP 403 stateは可視textと`role=alert`を持ち、private data regionを表示しないが、contrast evidenceと同じcontractに束ねられていない。

### inferred

- 既存baselineは違反検出を主目的に設計され、focus indicatorと色非依存cueを含むscreen固有の合格条件を登録していないため、matrixを安全にpassへ昇格できない。

### open question

- representative screen reader、実browser zoom、実機での知覚確認はこのenvironmentでは実施できず、manual statusとoverall statusを`blocked`に維持する。

### 根本原因

axeの全画面baselineとkeyboard focus幅の証跡が別々に存在し、`AC-SQ016-004`が要求するtext・focus indicator・color independenceを、担当者対応固有のpositive required contractとして一意に結ぶE2E IDが欠落している。

### 全影響範囲への対応

担当者対応限定の`E2E-UI-CONTRAST-002`を追加し、320 / 1280 CSS pxのtext contrast、実computed focus indicator 3:1、permission stateの複数cueを同一証跡に束ねる。trace/matrix/正本/生成物を同期し、他画面とmanual evidenceは未検証のまま維持する。

## 実装計画

1. required Chromium UI quality suiteへ担当者対応contrast E2Eを追加する。
2. E2E IDをauthored traceへ登録し、担当者対応の`SQ-016`追跡と`AC-SQ016-004`を接続する。
3. authored quality matrixの担当者対応automated statusだけをpassへ更新する。
4. canonical requirement/designとgenerated Web docsを正規generatorで同期する。
5. targeted E2E、lint、typecheck、unit、build、trace/matrix、docs checkを実行する。
6. report、commit、Draft PR #462、受け入れ確認、セルフレビュー、Issue #345を更新する。

## ドキュメント保守計画

- 要求の意味や閾値は変更せず、`SQ-016`の現在の自動証跡へ担当者対応contrast contractを追記する。
- `DES_UI_UX_001`の担当者対応screen traceへ`AC-SQ016-004`とE2E境界を追記する。
- authored sourceは`tools/web-inventory/ui-traceability.json`と`ui-quality-matrix.json`に限定し、`docs/generated/`はgenerator出力だけを更新する。

## 受け入れ条件

- [x] `E2E-UI-CONTRAST-002`が320 / 1280 CSS pxの担当者対応text contrastをaxeで検査し、`color-contrast` violation 0を要求する。
- [x] 同E2Eが検索入力の実computed 3px focus indicatorと背景比3:1以上を検査する。
- [x] 同E2Eがpermission stateの可視text、alert semantics、private content suppressionを検査し、色だけに依存しない状態cueを証明する。
- [x] `assignee → SQ-016 → AC-SQ016-004 → E2E-UI-CONTRAST-002`が正本、authored trace/matrix、生成文書で一致する。
- [x] 担当者対応のautomated statusだけがpassとなり、manual / overallおよび他画面の未検証statusはblockedを維持する。
- [x] 選定したlint、typecheck、unit、build、targeted E2E、trace/matrix、docs checkが成功する。
- [x] Draft PR #462に最終headと検証結果を反映し、受け入れ確認・セルフレビュー・Issue #345進捗を日本語で記録する。

## 検証計画

- `npm run lint -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/web`
- `TZ=UTC npm test -w @memorag-mvp/web`
- `npm run build -w @memorag-mvp/web`
- `npm exec -w @memorag-mvp/web -- playwright test e2e/visual-regression.spec.ts --project=chromium --grep E2E-UI-CONTRAST-002`
- `npm run docs:web-trace:test`
- `npm run test:web-semantic-ui`
- `npm run docs:web-inventory:check`
- `python3 scripts/validate_docs.py`
- `git diff --check`

## PRレビュー観点

- automated axe/computed evidenceをmanual contrast / screen reader / real zoom合格へ読み替えていないか。
- focus indicatorのcontrastを実computed valueから測定しているか。
- permission stateの複数cueがproduction挙動に由来し、test fixtureはAPI境界だけに限定されているか。
- PR #461のshared UI production pathと競合していないか。
- 正本と生成物の所在が重複していないか。

## CI修復記録

- 初回Web UI Quality `32605762679`は、既存38件とFirefox / WebKit jobが成功し、新規`E2E-UI-CONTRAST-002`だけが初回・retryとも失敗した。
- 失敗原因はaxe対象を`section[aria-label="担当者対応"]`と指定した一方、production regionは`aria-labelledby`で命名されており、対象要素が0件だったこと。role / accessible nameによるPlaywright検査は同じDOMで成功していた。
- axe対象を実DOMの`.assignee-workspace[aria-labelledby]`へ限定し直した。regionのrole / name、`color-contrast` rule、focus 3:1、permission複数cueの要求は緩和していない。
- 修正head `d56ee34f`のWeb UI QualityはChromium 39/39、Firefox / WebKit 18/18で成功した。MemoRAG CI `32606041959`は実処理がbuild / synthまで成功した一方、公開時にlarge generated JSONの転送出力が途中省略され、`Check generated web inventory`だけがfailure outcomeとなった。
- local検証treeの生成JSONはfreshness check成功・Git objectも完全であり、source / generator起因ではない。公開branch上の破損blobだけをlocal Git objectと一致する完全内容へ復旧し、final-head CIを再実行する。

## 最終検証・記録

- 実装・復旧head: `f0dbae37762a48bc0084463a824c894e8d8a7bf5`、local / remote tree: `280d6aba6f75ef6b391c39f21402c1b360f02b12`
- [Web UI Quality](https://github.com/tsuji-tomonori/rag-assist/actions/runs/32606519075): Chromium 39/39、Firefox / WebKit 18/18成功
- [MemoRAG CI](https://github.com/tsuji-tomonori/rag-assist/actions/runs/32606519106): 成功
- [semver検査](https://github.com/tsuji-tomonori/rag-assist/actions/runs/32606519072): 成功
- [受け入れ確認](https://github.com/tsuji-tomonori/rag-assist/pull/462#issuecomment-5383278680)
- [セルフレビュー](https://github.com/tsuji-tomonori/rag-assist/pull/462#issuecomment-5383278611)
- [Issue #345進捗](https://github.com/tsuji-tomonori/rag-assist/issues/345#issuecomment-5383278545)

このtaskの自動受け入れ条件は満たしたが、Issue #345全体のmanual evidence、実browser zoom、実機、documents / profile contrast、owner判断が未完了のため、状態は`do`を維持する。

## リスク

- axeはcanvas/image/brand fidelityやmanual知覚を完全には代替しない。
- CSS viewport 320pxは実browser 400% zoomを代替しない。
- PlaywrightのChromium computed styleはFirefox / WebKit native renderingやrepresentative screen readerを代替しない。
