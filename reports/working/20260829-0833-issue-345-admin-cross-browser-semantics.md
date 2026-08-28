# Issue #345 admin cross-browser semantics working report

## 結果

- `E2E-UI-CROSS-BROWSER-SEMANTICS-005`を追加し、管理者設定overviewからユーザー管理へ移動するrole / name / value / current / polite live status契約をFirefox／WebKit required scopeへ組み込んだ。
- `admin → SQ-016 → AC-SQ016-003 → E2E-UI-CROSS-BROWSER-SEMANTICS-005`をSQ-016正本、UI正本、authored trace / quality matrix、generated Web docsへ同期した。
- required Firefox／WebKit scopeはsemantic 10件、全26件となった。
- production component / CSS / API / authorization / RAG contractは変更していない。
- local実ブラウザ実走はsandbox内のAPI server起動時に`tsx` IPC socketが`EPERM`となるため未完了。Firefox／WebKit required実走はGitHub Actions待ちである。

## 実装範囲

| 区分 | 内容 |
|---|---|
| E2E | admin route fixture、overview workspace／heading／section navigation、overview→usersの`aria-current`、users region／search／filter／create form／table／取得status |
| evidence | browser project名付きPlaywright ARIA snapshot、current／value／live state JSON、representative screen reader / native AXではない境界 |
| canonical | `SQ-016` current evidence / history、`DES_UI_UX_001` view trace / required scope / admin semantic contract |
| authored joins | `ui-traceability.json`、`ui-quality-matrix.json` |
| generated | `web-screens.md`、`web-traceability.md`、`web-ui-inventory.json`、`web-ui-quality-matrix.md` |
| workflow | acceptance付きtask、spec analysis、本report |

## Local verification

| check | result | note |
|---|---|---|
| `npm ci` | pass | 504 packages |
| targeted ESLint | pass | `cross-browser-semantics.spec.ts` |
| Web typecheck | pass | production Web source |
| E2E TypeScript | pass after explicit lib | repository `apps/web/e2e/tsconfig.json`単独では既存`cross-screen-audit.ts`の`DOM.Iterable`不足4件。`--lib ES2022,DOM,DOM.Iterable`で全E2E source pass |
| Web unit | pass | 62 files / 449 tests |
| Web build | pass | Vite build成功。既存chunk size warningのみ |
| targeted Firefox／WebKit discovery | pass | 2 tests |
| required Firefox／WebKit discovery | pass | 26 tests / 6 files |
| Chromium targeted実走 | blocked | API serverの`tsx` IPC socket `/tmp/tsx-0/*.pipe` listenがsandbox `EPERM`。test assertion failureではない |
| trace tests | pass | 13 tests |
| semantic UI tests | pass | 5 tests |
| generated freshness | pass | authored sourceから最新 |
| docs validation | pass | canonical docs validation成功 |
| hidden Unicode | pass | docs / reports / tasks |
| authored JSON parse | pass | trace / quality matrix |
| Taskfile alias check | pass | active legacy aliasなし |
| `git diff --check` | pass | whitespace errorなし |

## Evidence boundary and residual risk

- Playwright ARIA snapshotとDOM ARIA stateはrepresentative screen readerやFirefox／WebKit native AX tree debug outputではない。
- browser UIを操作する実200%／400% zoom、text-only zoom、OS scaling、manual keyboard / contrast、touch／real deviceは未実施であり、manual / overallは`blocked`のままである。
- `FR-051`、`OQ-UI-002`、API C1 85%はowner判断または別task待ちである。
- #461統合後は最終production DOMとgenerated inventoryに対して再検証が必要である。
- Draft PR #462は累積stackであり、本sliceのCI成功だけでmerge-readyとはしない。

## CI待ち

- Required Firefox and WebKit keyboard, semantics, states, reflow, and content extremes: pending
- Chromium Web UI Quality: pending
- MemoRAG CI: pending
- semver check: pending

## CI repair loop

- initial head `9ec0395c`: Chromium requiredは成功。Firefox／WebKit requiredは既存24件が成功し、新規2件だけが同じ箇所で失敗した。
- 原因: `AdminPanelDataStatus`は明示的な`role=status`／`aria-live=polite`を持つが、Firefox／WebKitのPlaywright `getByRole('status')` locatorでは要素が解決されなかった。前段のusers region／filter／form／table／value assertionsは成功している。
- 修復: status要素だけをusers region内の明示的DOM role/live属性とfixture source textで限定し、`role`／`aria-live`／可視textを検証する。enclosing users regionのPlaywright ARIA snapshotは別途添付し、DOM stateとsnapshotの証跡境界をJSONへ明記する。
- repair head `30a9622d`: Chromium requiredと既存Firefox／WebKit 24件は再度成功したが、新規2件はsuccess statusではなく部分失敗alertを表示して失敗した。CI artifactのpage snapshotで管理対象ユーザーだけが`取得失敗`、問い合わせ参照`ui-admin-users-2`となることを確認した。
- 確定原因: 新規admin user fixtureが現行strict decoder必須の`effectivePermissions`と`projection` evidenceを欠いていた。API失敗やproduct不具合ではなく、古いfixture形状だった。
- 追加修復: fixtureへserver-defined permission projection、source／as-of／reconciliation stateを追加し、成功dataのpolite statusを検証対象へ戻した。
- false pass防止: statusの検証を削除せず、代表screen reader／native AX treeのpassにも昇格しない。修復headのrequired CI結果が確定するまで未完了とする。

## Lifecycle / cleanup recommendation

- evidence artifact retentionはworkflow既定の14日を維持する。
- taskとPRは代表screen reader、実browser zoom、実機、owner判断、#461統合後の再検証が未完了のため`do`／Draftを維持する。
- merge、deploy、release、force-pushは行わない。
