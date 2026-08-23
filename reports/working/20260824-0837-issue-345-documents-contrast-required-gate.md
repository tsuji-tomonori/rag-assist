# Issue #345 文書画面 contrast required gate 作業レポート

## 受けた指示

Issue #345をcurrent main、前回差分、open PR / Issue、task、正本・生成文書から継続し、既存作業と競合しない最優先の小さなUI/UX改善を1件実装する。受け入れ条件付きtask、実装、文書同期、最小十分な検証、Draft PR #462、Issue #345進捗まで行い、未検証を完了扱いしない。

## 要件整理

- 対象: 文書画面の`AC-SQ016-004`
- 追跡: `documents → SQ-016 → AC-SQ016-004 → E2E-UI-CONTRAST-003`
- 閾値: normal text 4.5:1、large text / meaningful UI / focus indicator 3:1、color independence
- 境界: 320 / 1280 CSS px、Chromium automated evidence
- 非対象: representative screen reader、manual contrast、実browser zoom、OS scaling、touch / real device

## 検討・判断

- current `main@8e542b31`は前回から不変、Draft PR #462はhead `65b296ee`でbehind 0 / ahead 115、mergeable。
- #341〜#344は統合済み。Draft PR #461はcurrent mainに対してbehind 88 / ahead 10、mergeable falseで、documents production componentを所有する。
- #461との競合を避けるためproduction component / CSS / APIは変更せず、既存挙動をrequired E2E、正本、authored trace / matrix、generated docsへ接続する方針を採用した。
- profile contrastはFR-051状態契約のowner判断が残るため後続とした。

## 実施作業

- `E2E-UI-CONTRAST-003`を`apps/web/e2e/visual-regression.spec.ts`へ追加した。
  - 320 / 1280 CSS pxで文書管理regionのaxe `color-contrast` violation 0を要求。
  - フォルダ検索入力のfocus indicatorをcomputed styleからsolid / 3px以上 / 背景比3:1以上と要求。
  - documents / document-groups / reindex-migrations GETのHTTP 403で可視text、`role=alert`、private document panel suppressionを要求。
  - viewport、computed outline、axe結果、permission cue、browser project、automation境界をJSON attachmentへ記録。
- `REQ_SERVICE_QUALITY_016`、`DES_UI_UX_001`、authored trace / quality matrixを同期した。
- 正規generatorでWeb screens、traceability、inventory JSON、quality matrixを更新した。
- documentsの`automated`だけを`pass`へ更新し、`manual` / `overall`とprofileは`blocked`を維持した。

## 検証

### 成功

- Web lint: `eslint apps/web --cache --cache-location .eslintcache --max-warnings=0`
- Web typecheck: `tsc -p apps/web/tsconfig.json --noEmit`
- Web unit: 62 files / 449 tests
- Web build: `tsc -p apps/web/tsconfig.json && vite build`
- trace / quality matrix / semantic / manual evidence: 25 tests
- Web inventory / quality matrix freshness
- canonical docs validation、hidden Unicode、JSON generator consistency、`git diff --check`
- targeted Playwright discovery: `E2E-UI-CONTRAST-003` 1件

### 未検証

- targeted Playwright実走: localhost server起動を伴うコマンドがenvironmentのnetwork/approval境界で停止した。権限昇格は行わず、GitHub Actions required Chromium gateで実走する。
- representative screen reader、manual contrast perception、実browser 200% / 400% zoom、text-only zoom、OS scaling、touch / real device。
- Firefox / WebKit native accessibility treeと文書画面contrast固有検査。
- #461統合後のfinal production DOM再検証。

## 成果物

- `apps/web/e2e/visual-regression.spec.ts`
- `docs/1_要求_REQ/.../REQ_SERVICE_QUALITY_016.md`
- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- `tools/web-inventory/ui-traceability.json`
- `tools/web-inventory/ui-quality-matrix.json`
- `docs/generated/web-screens.md`
- `docs/generated/web-traceability.md`
- `docs/generated/web-ui-inventory.json`
- `docs/generated/web-ui-quality-matrix.md`
- `tasks/do/20260824-0837-issue-345-documents-contrast-required-gate.md`
- `reports/working/20260824-0837-issue-345-documents-contrast-required-gate-spec-analysis.md`

## 指示へのfit評価

- 最優先の小さな改善1件に限定し、owner判断不要・production競合なしのcontrast証跡gapを選んだ。
- task、E2E、正本、authored trace / matrix、生成文書を一意な経路で同期した。
- automation evidenceをmanual / real zoom完了へ読み替えず、taskとDraft PRを未完了として維持する。

## 未対応・制約・リスク

- final-head GitHub Actions、Draft PR本文、受け入れ確認、セルフレビュー、Issue #345コメントは公開後に記録する。
- profile `AC-SQ016-004`、FR-051 / OQ-UI-002 owner判断、API C1 85%は残件。
- merge、deploy、release、force-push、破壊的変更は行わない。
