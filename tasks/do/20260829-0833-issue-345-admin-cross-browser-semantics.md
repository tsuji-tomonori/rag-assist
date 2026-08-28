# Issue #345 admin cross-browser semantic required gate

- 状態: do
- タスク種別: 機能追加
- 対象Issue: #345
- 対象PR: #462
- 作成日時: 2026-08-29 08:33 JST

## 背景

Draft PR #462 は current `main@8e542b31` を祖先に含み、管理者設定についてChromium AX tree、Chromium／Firefox／WebKit keyboard journey、Firefox／WebKit reflow／layout stressをrequired gateで検証している。一方、管理者設定overview、active section、ユーザー管理のfilter／form／table、取得状態をFirefox／WebKitで検証するsemantic snapshotはrequired gateにない。

管理者設定は権限に応じて操作範囲が変わる画面である。並行Draft PR #461は管理画面を含むproduction sourceとgenerated Web inventoryを変更するため、今回sliceはproduction sourceを避け、既存DOM contractをrequired E2Eと正本／生成文書へ同期する。

## 目的

管理者設定overviewからユーザー管理へ到達する主要導線のsemantic contractをFirefox／WebKit required gateへ追加し、`admin → SQ-016 → AC-SQ016-003 → E2E-UI-CROSS-BROWSER-SEMANTICS-005`を正本、authored trace / quality matrix、生成文書で一意に追跡可能にする。

## スコープ

### 対象

- `apps/web/e2e/cross-browser-semantics.spec.ts`
- `tools/web-inventory/ui-traceability.json`
- `tools/web-inventory/ui-quality-matrix.json`
- `docs/1_要求_REQ/**/REQ_SERVICE_QUALITY_016.md`
- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- repository generatorが更新する`docs/generated/`のWeb inventory / quality matrix
- task / spec analysis / working report

### 対象外

- production component / CSS / API / authorization / RAG contract
- PR #461が所有するproduction source
- representative screen reader、Firefox／WebKit native AX tree debug output
- browser UIを操作する実200%／400% zoom、text-only zoom、OS scaling
- touch／実機、manual keyboard / contrast
- FR-051、OQ-UI-002、API C1 85%
- merge、deploy、release、force-push

## 入力と確定事項

- `confirmed`: `main@8e542b31` と #462 head `5f13cbc3` のbehindは0。
- `confirmed`: #461はDraftで、production sourceとgenerated Web inventoryを変更する。
- `confirmed`: adminはChromium AX、Chromium／Firefox／WebKit keyboard、Firefox／WebKit reflow／layout stressまでrequiredである。
- `confirmed`: Firefox／WebKit required gateは現状semantic 8件／合計24件である。
- `confirmed`: adminのFirefox／WebKit semantic snapshotは未実装である。
- `open_question`: representative screen reader / OS / browser / device matrixとownerは`OQ-UI-002`未決。

## 実施計画

1. admin fixtureをPlaywright routeに限定して追加する。
2. overview landmark、active section、ユーザー管理のsearch／filter value／create form／table、取得statusをFirefox／WebKitで検証し、browser別evidenceを添付する。
3. SQ-016正本、UI正本、trace、quality matrixのE2E IDとrequired件数を同期する。
4. generatorを実行してgenerated Web docsをauthored sourceから更新する。
5. targeted lint / typecheck / unit / build / E2E discovery / docs checksを実行し、失敗時は原因を修復して再実行する。
6. #462を更新し、受け入れ確認・セルフレビュー・#345進捗を記録する。

## ドキュメント保守計画

- 要件の正本は既存`SQ-016`に集約し、新しい並行要件文書を作らない。
- 画面固有の実装契約は既存`DES_UI_UX_001.md`へ追加する。
- `tools/web-inventory/*.json`をauthored sourceとし、`docs/generated/`を直接編集しない。
- Playwright ARIA snapshot / DOM stateをnative AX treeやrepresentative screen readerのpassへ読み替えない。

## 受け入れ条件

- [x] `E2E-UI-CROSS-BROWSER-SEMANTICS-005`がFirefox／WebKitで管理者設定region／heading／section navigationとoverview active sectionを検証する。
- [x] ユーザー管理へ移動後、active section、名前付きregion／search／create form／table、query／status／sort／initial role value、取得statusのpolite live regionを同じ実走で検証する。
- [x] browser project名、新E2E ID、Playwright ARIA snapshot / DOM stateの証跡境界をartifactへ記録する。
- [x] `admin → SQ-016 → AC-SQ016-003 → E2E-UI-CROSS-BROWSER-SEMANTICS-005`が正本、authored trace / matrix、生成文書で一致する。
- [x] required Firefox／WebKit scopeの内訳がsemantic 10件／合計26件へ更新される。
- [x] production component / CSS / API / authorization / RAG contractを変更しない。
- [x] manual / overall statusは`blocked`を維持し、representative screen reader、native AX tree、実browser zoom、実機をpass扱いしない。
- [x] 選定したlint、typecheck、unit、build、E2E discovery、docs / freshness checks、`git diff --check`が成功する。
- [ ] Draft PR #462、PR受け入れコメント、セルフレビュー、Issue #345進捗が更新される。

## 検証計画

- `npm ci`
- targeted ESLint / E2E TypeScript
- `npm run typecheck -w @memorag-mvp/web`
- `TZ=Asia/Tokyo npm run test -w @memorag-mvp/web`
- `npm run build -w @memorag-mvp/web`
- targeted Firefox／WebKit discovery
- required Firefox／WebKit 26件discovery
- `npm run docs:web-inventory`
- `npm run docs:web-trace:test`
- `npm run test:web-semantic-ui`
- `npm run docs:web-inventory:check`
- `python3 scripts/validate_docs.py`
- `npm run docs:hidden-unicode:check`
- authored JSON parse
- `git diff --check`

対象Playwright実走はlocal browser / server availabilityを確認して実行する。実行できない場合は未実施理由を記録し、GitHub Actions required Firefox／WebKit結果を待つ。

## PRレビュー観点

- test-only fixtureがproduction API / auth / RAG behaviorへ漏れていないか。
- role / name / value / current / live statusの主要contractに限定し、装飾的文言を過剰固定していないか。
- authored sourceとgenerated docsの差分がgenerator出力だけか。
- #461のproduction ownershipを侵食していないか。
- manual / native evidenceを自動証跡でpassへ昇格していないか。

## リスク

- Firefox／WebKitのARIA snapshot差により、Chromiumだけでは見えないrole/name差がCIで検出される可能性がある。
- #461統合後は最終production DOMに対する再検証が必要である。
- #462は累積stackであり、本sliceがpassしてもPR全体はmerge-readyではない。
