# Issue #345 担当者対応 cross-browser semantic required gate

- 状態: do
- タスク種別: 機能追加
- 対象Issue: #345
- 対象PR: #462
- 作成日時: 2026-08-27 08:32 JST

## 背景

Draft PR #462 は current `main@8e542b31` を祖先に含み、Firefox／WebKit required gate で login / chat / profile の Playwright ARIA snapshot と dynamic ARIA state を検証している。一方、担当者対応は Chromium AX tree と Firefox／WebKit keyboard journeyまでは required だが、Firefox／WebKitの name / role / value / pressed / checked / live state contract が required E2E にない。

また正本 `DES_UI_UX_001.md` の required cross-browser 内訳が profile semantic追加前の「semantic 2件／合計18件」のままで、実際の20件と不一致である。画面→要件→受け入れ条件→E2Eの追跡とrequired scope記述を同じ変更単位で同期する。

## 目的

担当者が問い合わせを選択して回答下書きを更新する主要導線のsemantic contractをFirefox／WebKit required gateへ追加し、`assignee → SQ-016 → AC-SQ016-003 → E2E-UI-CROSS-BROWSER-SEMANTICS-003`を正本、authored trace / quality matrix、生成文書で一意に追跡可能にする。

## スコープ

### 対象

- `apps/web/e2e/cross-browser-semantics.spec.ts`
- `tools/web-inventory/ui-traceability.json`
- `tools/web-inventory/ui-quality-matrix.json`
- `docs/1_要求_REQ/**/REQ_SERVICE_QUALITY_016.md`
- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- repository generatorが更新する `docs/generated/` のWeb inventory / quality matrix
- task / spec analysis / working report

### 対象外

- production component / CSS / API / authorization / RAG contract
- PR #461が所有するshared UI production source
- representative screen reader、Firefox／WebKit native AX tree debug output
- browser UIを操作する実200%／400% zoom、text-only zoom、OS scaling
- touch／real device、manual keyboard / contrast
- FR-051、OQ-UI-002、API C1 85%
- merge、deploy、release、force-push

## 入力と確定事項

- `confirmed`: `main@8e542b31` と #462 head `eb4343f6` のbehindは0。
- `confirmed`: #462の未解決review threadは0件。
- `confirmed`: #461はDraft・mergeable falseで、`AssigneeWorkspace.tsx`とgenerated Web inventoryを変更する。
- `confirmed`: #462の担当者対応はChromium AX contract、Firefox／WebKit keyboard、Chromium contrastまでrequiredである。
- `confirmed`: Firefox／WebKit required gateは現状20件だが、`DES_UI_UX_001.md`に18件と残る箇所がある。
- `open_question`: representative screen reader / OS / browser / device matrixとownerは `OQ-UI-002` 未決。

## 実施計画

1. 担当者対応fixtureをPlaywright routeに限定して追加する。
2. heading、list/filter、selected card、answer form、notify checkbox、polite draft statusをFirefox／WebKitで検証し、browser別evidenceを添付する。
3. SQ-016正本、UI正本、trace、quality matrixのE2E IDとrequired件数を同期する。
4. generatorを実行してgenerated Web docsを正本sourceから更新する。
5. targeted discovery / typecheck / unit / lint / build / docs checksを実行し、失敗時は原因を修復して再実行する。
6. #462を更新し、受け入れ確認・セルフレビュー・#345進捗を記録する。

## ドキュメント保守計画

- 要件の正本は既存 `SQ-016` に集約し、新しい並行要件文書を作らない。
- 画面固有の実装契約は既存 `DES_UI_UX_001.md` に追加する。
- `tools/web-inventory/*.json` をauthored sourceとし、`docs/generated/`を直接編集しない。
- Playwright ARIA snapshot / DOM stateをnative AX treeやrepresentative screen readerのpassへ読み替えない。

## 受け入れ条件

- [ ] `E2E-UI-CROSS-BROWSER-SEMANTICS-003`がFirefox／WebKitで担当者対応のheading、問い合わせ一覧、filter name/value、選択card pressed state、回答form、notify checked state、polite statusを検証する。
- [ ] 回答内容変更後にvisible status text、`role=status`、`aria-live=polite`が同じ実走で検証される。
- [ ] browser project名、新E2E ID、Playwright ARIA snapshot / DOM stateの証跡境界をartifactへ記録する。
- [ ] `assignee → SQ-016 → AC-SQ016-003 → E2E-UI-CROSS-BROWSER-SEMANTICS-003`が正本、authored trace / matrix、生成文書で一致する。
- [ ] required Firefox／WebKit scopeの内訳が、実装と一致するsemantic 6件／合計22件へ更新される。
- [ ] production component / CSS / API / authorization / RAG contractを変更しない。
- [ ] manual / overall statusは`blocked`を維持し、representative screen reader、native AX tree、実browser zoom、実機をpass扱いしない。
- [ ] 選定したlint、typecheck、unit、build、E2E discovery、docs / freshness checks、`git diff --check`が成功する。
- [ ] Draft PR #462、PR受け入れコメント、セルフレビュー、Issue #345進捗が更新される。

## 検証計画

- `npm ci`
- `npm exec -- eslint apps/web/e2e/cross-browser-semantics.spec.ts --max-warnings=0`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run test -w @memorag-mvp/web`
- `npm run build -w @memorag-mvp/web`
- `npm exec -- tsc -p apps/web/e2e/tsconfig.json --noEmit --lib ES2022,DOM,DOM.Iterable`
- `E2E_SCENARIO=all E2E_CROSS_BROWSER=1 npm exec -w @memorag-mvp/web -- playwright test e2e/cross-browser-semantics.spec.ts --project=firefox-scheduled --project=webkit-scheduled --grep E2E-UI-CROSS-BROWSER-SEMANTICS-003 --list`
- `npm run docs:web-inventory`
- `npm run docs:web-trace:test`
- `npm run test:web-semantic-ui`
- `npm run docs:web-inventory:check`
- `python3 scripts/validate_docs.py`
- `npm run docs:hidden-unicode:check`
- `git diff --check`

対象Playwright実走はlocal browser / server availabilityを確認して実行する。実行できない場合は未実施理由を記録し、GitHub Actionsのrequired Firefox／WebKit結果を待つ。

## PRレビュー観点

- test-only fixtureがproduction API / auth / RAG behaviorへ漏れていないか。
- accessible nameの日本語文言やroleを過剰に固定していないか。
- pressed / checked / value / live stateを可視textと同時に検証しているか。
- authored sourceとgenerated docsの差分がgenerator出力だけか。
- #461のproduction ownershipを侵食していないか。
- manual / native evidenceを自動証跡でpassへ昇格していないか。

## リスク

- Firefox／WebKitのARIA snapshot差により、Chromiumだけでは見えないrole/name差がCIで検出される可能性がある。
- #461統合後は最終production DOMに対する再検証が必要である。
- #462は累積stackであり、本sliceがpassしてもPR全体はmerge-readyではない。
