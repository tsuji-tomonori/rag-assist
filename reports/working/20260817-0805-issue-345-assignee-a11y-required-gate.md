# Issue #345 担当者対応a11y required gate 作業記録

## Outcome

- 担当者対応のworkspace、問い合わせ一覧、カンバンlane、選択中詳細、回答formへ視覚見出し由来のaccessible nameを付与した。
- filter、search、question selection、answer input、notify toggle、一時保持へ至るkeyboard-only journeyと3px focus indicatorをrequired E2Eへ追加した。
- 担当者対応のlandmark、control value、pressed／checked／live stateをChromium AX tree契約へ追加した。
- `SQ-016`、UI設計、authored trace／quality matrix、生成Web文書を同期し、manual／overall statusは`blocked`を維持した。

## Current base and overlap

- 作業開始時のcurrent main: `8e542b31da137129927c1ea8d21650b0c0d483c8`
- 作業開始時のDraft PR #462 head: `72721b53f4ee55e0e6ccee76bd741c326d2f2c2b`、behind 0
- #341〜#344はmainへ統合済みで、正本の並行版は作成していない。
- open PR #461とは`AssigneeWorkspace.tsx`が同一pathである。#461はshared UI import、今回変更はlandmark／IDの別hunkであり、統合時は両方を保持してgeneratorを再実行する。

## Validation

| Check | Result | Evidence / boundary |
| --- | --- | --- |
| diff whitespace | pass | `git diff --check` |
| Web lint | pass | direct ESLint、warnings 0 |
| Web typecheck | pass | `npm run typecheck -w @memorag-mvp/web` |
| targeted unit | pass | `AssigneeWorkspace.test.tsx` 5 tests |
| Web unit | pass | `TZ=Asia/Tokyo`、62 files / 448 tests |
| Web build | pass | TypeScript + Vite。既存chunk-size warningのみ |
| target Chromium E2E discovery | pass | keyboard／semantics、2 testsを検出 |
| Firefox／WebKit required discovery | pass | 9 + 9 testsを検出 |
| local browser E2E execution | blocked | sandboxのhost service listen境界で開始不可。final-head GitHub Actionsを実走証跡とする |
| trace contract | pass | 13 tests |
| semantic UI contract | pass | 5 tests |
| manual evidence contract | pass / incomplete | 7 tests、baseline pass 0 / blocked 3 / not_run 1、ready false |
| canonical docs validation | pass | `python scripts/validate_docs.py` |
| generated Web docs | pass | inventory／trace／quality freshness |
| infrastructure inventory | pass | canonical inventory check |
| OpenAPI docs | pass | `node --import tsx src/validate-openapi-docs.ts` |
| API code docs | pass | 98 APIs / 588 docs、check mode |
| hidden Unicode / legacy aliases | pass | repository checks |

## Verification repair loop

Web unitの初回実行はtimezoneが`-0400`となり、既存の日付表示期待2件だけが失敗した。production差分との因果がないことを確認し、正本の想定実行環境に合わせて`TZ=Asia/Tokyo`を明示して全448件を再実行し成功した。`tsx` CLIはsandbox IPCで`EPERM`となったため、同じvalidatorを`node --import tsx`で実行し成功した。いずれも検査をskipしていない。

initial GitHub Actions run `31979123888`は、新しい「担当者対応カンバン」regionの追加により、既存の画面到達locator `getByRole('region', { name: '担当者対応' })`が親workspaceとカンバンを部分一致で同時に選択し、Chromium 1件とFirefox／WebKit各1件でstrict-mode違反になった。product semanticsと期待journeyを緩めず、画面到達assertionを既存意図どおり`exact: true`へ固定した。初回runはChromium 36／37、Firefox／WebKit 16／18が成功し、他の失敗はなかった。

## Acceptance status

- `AC-20260817-001`: implementation / unit / target discovery pass。final-head browser CI待ち。
- `AC-20260817-002`: implementation / unit / target discovery pass。final-head Chromium AX CI待ち。
- `AC-20260817-003`: canonical／authored／generated trace同期とfreshness check pass。manual／overall blocked維持。
- `AC-20260817-004`: local non-browser checks pass。Draft PR／Issue記録とfinal-head CI待ち。

## Incomplete and next action

- representative screen reader、実browser 200%／400% zoom、touch／実機、Firefox／WebKit native AXは未実施である。
- FR-051の永続化・owner判断、API C1 85%、OQ-UI-002は本変更の対象外で未完了である。
- final-head GitHub Actions結果を確認して本記録、PR、Issueへ追記する。manual未実施が残るためtaskは`do`、PRはDraftを維持する。
