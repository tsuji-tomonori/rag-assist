# Issue #345 chat contrast required gate 仕様分析

## 調査範囲

- current `main@8e542b31`
- Draft PR #462 head `d705d471`
- Issue #345、open PR #458 / #460〜#465、tasks/todo・tasks/do
- `SQ-016`、`DES_UI_UX_001`、authored UI trace / quality matrix、generated Web docs
- required Chromium / Firefox / WebKit E2E sourceとworkflow

## confirmed

- #341〜#344はmainへ統合済みで、current mainに対する追加競合はない。
- PR #462はDraft・mergeableで、current mainに対してbehind 0のUI evidence stackである。
- open PR #461はshared UI primitiveと一部production UIを所有するため、同じproduction pathの編集は競合リスクがある。
- `AC-SQ016-004`はnormal text 4.5:1、large text / meaningful non-text UI / focus indicator 3:1、color independenceを要求する。
- 8画面共通auditは1280pxのaxe serious / critical violationをfailさせるが、chatのquality matrixは`automated: blocked`である。
- chatにはkeyboard focus幅、state semantics、permission案内の個別証跡があるが、contrast acceptanceへ束ねるstable E2E IDがない。
- 自動証跡で未完了の`AC-SQ016-004`はchat / assignee / documents / profileに残り、profile `AC-SQ016-007`はFR-051 owner判断待ちである。

## inferred

- owner判断を要しないchat contrastのpositive evidence追加が、既存作業と重複せず、#461とのproduction競合も避けられる最小の優先改善である。
- full-screen axe absenceだけではfocus indicatorの実computed比率と色非依存cueを説明できないため、screen-specific E2E contractが必要である。

## conflict

- なし。要求閾値は変更せず、正本は`SQ-016`と`DES_UI_UX_001`、machine-readable joinはauthored trace / matrixに限定する。
- generated docsは正規generator出力とし、独立した並行正本を作らない。

## open_question / 未検証

- representative screen reader、manual perception、実browser 200% / 400% zoom、text-only zoom、OS scaling、touch / real deviceは未実施。
- Firefox / WebKitでのchat contrast固有検査は今回のbounded slice外。
- assignee / documents / profileの`AC-SQ016-004`は後続作業。
- FR-051永続化、OQ-UI-002、API C1 85%はownerまたは別taskの判断待ち。

## 採用した追跡

`chat → SQ-016 → AC-SQ016-004 → E2E-UI-CONTRAST-001 → apps/web/e2e/visual-regression.spec.ts → Web UI Quality Chromium required`

## 証跡境界

- axe `color-contrast`: 320 / 1280 CSS pxのchat region text contrast
- computed style: composer focus indicatorのstyle / width / foreground / background / ratio
- multiple cues: permission案内の可視text、`role=alert`、disabled送信control
- 非対象: manual / representative assistive technology / real browser zoom / OS scaling / real device
