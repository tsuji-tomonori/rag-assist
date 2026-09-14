# Issue #345 documents contrast required gate 仕様分析

## Input inventory

- current `main@8e542b31`: Git repository、confirmed
- Draft PR #462 head `65b296ee`: GitHub / Git、confirmed
- Issue #345、open PR / Issue、`tasks/todo/`・`tasks/do/`: GitHub / repository、confirmed
- `SQ-016`、`DES_UI_UX_001`: canonical requirement / design、confirmed
- authored UI trace / quality matrix、generated Web docs: machine-readable source / generated evidence、confirmed
- required Chromium / Firefox / WebKit E2E sourceとworkflow: executable verification source、confirmed

## Report facts

### confirmed

- #341〜#344はmainへ統合済みで、current mainに対する追加競合はない。
- PR #462はDraft・mergeableで、current mainに対してbehind 0のUI evidence stackである。
- open Draft PR #461はdocuments production componentとshared UI primitiveを所有し、current mainに対してbehind 88 / ahead 10かつmergeable falseである。
- `AC-SQ016-004`はnormal text 4.5:1、large text / meaningful non-text UI / focus indicator 3:1、color independenceを要求する。
- 8画面共通auditは1280pxのaxe serious / critical violationをfailさせるが、文書画面のquality matrixは`automated: blocked`である。
- 文書画面にはkeyboard focus幅、state semantics、HTTP 403 private-content suppressionの個別証跡があるが、contrast acceptanceへ束ねるstable E2E IDがない。
- 自動証跡で未完了の`AC-SQ016-004`は文書画面と個人設定に残り、個人設定の状態契約はFR-051 owner判断待ちである。

### inferred

- owner判断を要しない文書画面contrastのpositive evidence追加が、既存作業と重複せず、#461とのproduction競合も避けられる最小の優先改善である。
- full-screen axe absenceだけではfocus indicatorの実computed比率と色非依存cueを説明できないため、screen-specific E2E contractが必要である。

### conflict

- #461とdocuments production pathは競合しうるため、今回はE2E・正本・trace / matrix・生成物だけを更新し、本番component / CSSは変更しない。
- 要求閾値は変更せず、正本は`SQ-016`と`DES_UI_UX_001`、machine-readable joinはauthored trace / matrixに限定する。
- generated docsは正規generator出力とし、独立した並行正本を作らない。

### open_question

- representative screen reader、manual perception、実browser 200% / 400% zoom、text-only zoom、OS scaling、touch / real deviceは未実施。
- Firefox / WebKitでの文書画面contrast固有検査は今回のbounded slice外。
- profileの`AC-SQ016-004`は後続作業。
- FR-051永続化、OQ-UI-002、API C1 85%はownerまたは別taskの判断待ち。

## Candidate tasks

1. 文書画面のcontrast positive evidenceをrequired Chromium gateへ追加する: 採用。
2. 個人設定のcontrast evidenceを追加する: FR-051 owner判断と状態境界が残るため後続。
3. #461のdocuments production componentを修正する: 競合とstale baseを増やすため不採用。

## Acceptance criteria

- 320 / 1280 CSS pxの文書管理regionでaxe `color-contrast` violation 0。
- フォルダ検索入力の実computed focus indicatorがsolid 3px以上、背景比3:1以上。
- HTTP 403で可視案内、`role=alert`、private document panel suppressionを同時に検証。
- `documents → SQ-016 → AC-SQ016-004 → E2E-UI-CONTRAST-003`を正本・authored source・生成物で追跡。
- manual / overallとprofileの未検証statusをblockedのまま維持。

## E2E and non-UI scenarios

- `E2E-UI-CONTRAST-003`: 320 / 1280 CSS pxの文書画面text・focus contrastとHTTP 403の複数cueをChromiumで検証し、JSON evidenceを添付する。
- `NONUI-UI-TRACE-001/002`: requirement / AC / verification / evidenceの参照整合性と生成物freshnessを検証する。
- `NONUI-UI-QUALITY-MATRIX-001〜003`: automated passをmanual passへ誤変換せずoverall blockedを維持する。

## Operation and expectation groups

- 表示: `/documents`へ遷移 → regionが可視 → text contrast違反0。
- focus: フォルダ検索入力へfocus → 3px solid outline → 背景比3:1以上。
- permission: documents / groups / migrations GETが403 → 可視alert → private document panelなし → contrast違反0。
- trace: authored trace / matrix更新 → 正規generator → generated docs一致。

## 採用した追跡

`documents → SQ-016 → AC-SQ016-004 → E2E-UI-CONTRAST-003 → apps/web/e2e/visual-regression.spec.ts → Web UI Quality Chromium required`

## 証跡境界

- axe `color-contrast`: 320 / 1280 CSS pxの文書管理region text contrast
- computed style: フォルダ検索入力focus indicatorのstyle / width / foreground / background / ratio
- multiple cues: permission案内の可視text、`role=alert`、private document panel suppression
- 非対象: manual / representative assistive technology / real browser zoom / OS scaling / real device
