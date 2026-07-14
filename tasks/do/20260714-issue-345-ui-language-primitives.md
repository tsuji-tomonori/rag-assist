# Issue #345 UI 語彙・token・共通 primitive を統一する

保存先: `tasks/do/20260714-issue-345-ui-language-primitives.md`

状態: do

タスク種別: リファクタリング

依存: draft PR #348〜#350。未 merge のため本 branch は #350 latest CI-success head `1ceafeab` まで fast-forward し、default branch merge 前に依存を解消する。

## 背景

同じ intent/status/risk の用語・色・部品が feature ごとに分散し、raw enum/ID/internal name や arbitrary CSS が ordinary task に露出する可能性がある。

## 目的・対象範囲

`NFR-017` に基づき approved display metadata、semantic design token、navigation/form/dialog/status/retry/risky-action primitive を整備し、No Mock Product UI を維持する。

## 必要情報

- 要件: `NFR-017`, `FR-095`, `FR-096`, `FR-098`, `SQ-016`
- current CSS/component/inventory と feature-specific labels
- gap: `GAP-UI-007`

## 実行計画

1. user-facing vocabulary、intent/status/risk と current duplication を inventory 化する。
2. semantic metadata/token/primitive contract を定義する。
3. representative shared/feature UI へ段階適用する。
4. contrast/state/accessible-name/visual regression を検証する。

## 作業前チェックリスト

- [x] production source/generated inventory から user-facing raw enum/ID/internal name、重複 status/intent/risk wording、任意色を棚卸しする。
- [x] domain 固有語彙を誤った generic label に置換せず、approved display metadata の owner/source を定義する。
- [x] navigation/form/dialog/status/retry/risky action の既存 primitive と native semantics の適用範囲を確定する。
- [x] production 値を API/props/state/config または明示的 unavailable state だけから表示することを確認する。

### 棚卸し結果

- 主要な raw status/internal label は benchmark、agent、document/share/reindex、admin alias、debug に分散している。各 domain type を source of truth とし、shared display metadata は表示語・tone の exhaustive mapping のみを所有する。
- 既存 `Badge` / `Button` / `ConfirmDialog` を再利用し、status は文字列 + marker + semantic tone、dialog action は共通 `Button` contract に揃える。navigation/form/retry は既存 native semantics を維持し、この task では別 primitive を重複作成しない。
- arbitrary layout/brand color の全面移行は `cross-screen-a11y-responsive` に残し、この task は状態・intent・risk の semantic token と代表画面を対象にする。
- 表示値は既存 API response/type/state だけを変換し、値がない場合の架空 fallback は追加しない。opaque ID は主要 label から外し、必要な technical detail に限定する。

## Done 条件

- [x] semantic metadata/token/primitive contract と representative feature migration が受け入れ条件を満たす。
- [x] contrast/state/accessible-name、representative visual/axe、Web full checks、docs/inventory が成功する。
- [ ] `NFR-017` / `DES_UI_UX_001`、trace/generated docs、report、PR acceptance/self-review が同期する。

## ドキュメントメンテナンス計画

`NFR-017`, `DES_UI_UX_001`、component/token usage、generated inventory を同期する。brand refresh や見た目だけの全面刷新は対象外とする。

## 受け入れ条件

- [x] 同じ status/intent/risk が共通 semantic metadata/token と複数 cue を使う。
- [x] navigation/form/dialog/status/retry/risky action は native semantics と同一 contract を使う。
- [x] raw enum、opaque ID、internal module/service 名を主要 label/input にしない。
- [x] API/props/state/config にない値を demo fallback で補わない。
- [x] representative feature test、inventory、contrast/state review が pass する。

## 実行済み検証

- Web full coverage: 43 files / 342 tests pass、statements 91.65%、branches 85.26%、functions 92.25%、lines 94.49%
- API requirements trace focused test: 1/1 pass
- Web typecheck、repository ESLint、Web production build（155 modules）: pass
- semantic UI contract（display vocabulary、dialog intent/focus、multiple cue、WCAG AA token contrast）: pass
- Chromium `E2E-UI-SEMANTIC-001` axe: 1/1 pass
- Chromium `@visual`: 6/6 pass。最終文言調整後の管理/デバッグ対象: 2/2 pass
- `task docs:check`: pass（semantic trace 8 tests、generated Web/infra freshness を含む）

representative screen reader、実 touch、実 browser 200%/400% zoom、real device、Firefox/WebKit は本 task の実施済み証跡に含めず、Issue #345 の manual/cross-screen tasks に維持する。

## 検証計画

- metadata/primitive component tests
- lint/typecheck/test/build、visual/contrast/axe
- hidden Unicode、docs/inventory check

## PR レビュー観点

semantic meaning、contrast、localization、日本語の一貫性、primitive 過剰抽象化、mock fallback を確認する。

## 未決事項・リスク

用語承認が必要な domain label は仮語で固定せず open question/owner を残す。
