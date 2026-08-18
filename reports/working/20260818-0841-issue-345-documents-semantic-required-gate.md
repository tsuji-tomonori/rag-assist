# Issue #345 文書semantic required gate 作業レポート

## 結果

- Draft PR #462の既存`E2E-UI-SR-SEMANTICS-001`に、文書画面の検索、filter value、file table、detail dialog／主要action／disclosure expandedのChromium AX tree契約と選択行のDOM `aria-selected`を追加した。
- fixtureはPlaywright routeに限定し、`DocumentWorkspace`、配下production component、API、effective permissionは変更していない。
- `documents → SQ-016 → AC-SQ016-003 → quality matrix global evidence → E2E-UI-SR-SEMANTICS-001 → Chromium required`を正本、authored JSON、生成文書で同期した。
- `documents / AC-SQ016-003`はautomatedだけを`pass`とし、manual／overallは`blocked`を維持した。

## 変更範囲

- E2E: `apps/web/e2e/screen-reader-semantics.spec.ts`
- 正本: `REQ_SERVICE_QUALITY_016.md`、`DES_UI_UX_001.md`
- authored trace: `ui-traceability.json`、`ui-quality-matrix.json`
- generated: `web-screens.md`、`web-traceability.md`、`web-ui-inventory.json`、`web-ui-quality-matrix.md`
- task／分析／本レポート

## セルフレビュー

- fixtureはGETのdocuments／document-groups／reindex-migrationsに限定し、mutationと想定外methodは従来routeへfallbackする。
- internal IDではなくvisible file nameでdetail actionとdialogを識別する。
- Chromium AX treeがtable rowの`aria-selected` propertyを公開しないことを初回CIで確認した。選択行はDOM attributeで検証し、AX stateはdetail disclosureの`expanded=false`で検証する。
- open PR #461が変更するproduction文書componentには触れず、競合範囲をE2E／正本／追跡に限定した。#461統合後の最終DOM再検証は後続とする。
- automationを代表screen reader、実browser zoom、touch／実機のmanual passに読み替えていない。

## ローカル検証

| 検証 | 結果 | 証跡／制約 |
| --- | --- | --- |
| `git diff --check` | pass | whitespace error 0 |
| trace／quality matrix／semantic／manual evidence Node test | pass | 25 tests, 0 fail |
| `python3 scripts/validate_docs.py` | pass | `docs validation passed` |
| authored／generated JSON parse | pass | 3 files parse success |
| quality matrix generator | pass | authored matrixからgenerated Markdownを再生成 |
| Web lint／typecheck／unit／build | blocked locally | worktreeに`node_modules`がなく、実行環境のnetwork policyでregistryから依存を取得できない。final-head GitHub Actionsで判定する |
| Chromium Playwright E2E | blocked locally | Playwright／browser依存がない。final-head Web UI Qualityで実走する |
| 通常web inventory freshness command | blocked locally | generatorのTypeScript dependencyがない。production source無変更のため既存inventoryを入力にtrace再結合し、正規renderer／validatorとGitHub Actionsで最終判定する |

## GitHub状態

- 対象: Draft PR #462
- 実装・修復head: `f5438754c69d334f91e384c333b02b76320d7baa`
- Web UI Quality run `32083354028`: success。Chromium 37/37、Firefox／WebKit 18/18、retry／flaky 0
- Chromium artifact `9305870662`: `sha256:98753a88888cf95f7b30849c00b3e54f8ce5d7f7491580f66f797271faf9ebf3`
- cross-browser artifact `9305873830`: `sha256:aa297e3898ecfa0ba3739349c35fa5740e731fe7ab0401c9e7bf4552faf5c7e3`
- MemoRAG CI run `32083353951`: success。lint、typecheck、unit／coverage、build、docs freshnessを含む
- semver run `32083354012`: success

## CI修復ループ

1. head `718f95ec`のWeb UI Quality run `32082928768`はChromium 36/37。table rowのDOM `aria-selected=true`がCDP AX propertyとして公開されず失敗した。
2. 選択行はDOM ARIA属性で検証し、AX stateはdetail disclosureの`expanded=false`で検証する実際の証跡境界へ修正した。正本、matrix、task／reportも同期した。
3. 修復head `f5438754`でWeb UI Quality、MemoRAG CI、semverがすべて成功した。

## 未完了・blocker

- 代表screen readerの実操作、実browser 200%／400% zoom、text-only zoom、OS scaling、touch／実機、Firefox／WebKit accessibility treeは未検証。
- documents keyboard journeyとcontrastは別ACとしてblocked。
- FR-051の永続化、API C1 85%、OQ-UI-002、manual evidenceのowner／実行環境判断は未完了。
- #461統合後は文書画面の最終DOMでAX契約を再実走する。
- taskとPRは`do`／Draftを維持し、merge、deploy、releaseは行わない。
