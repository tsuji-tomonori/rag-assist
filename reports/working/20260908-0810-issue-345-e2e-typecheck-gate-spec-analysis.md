# Issue #345 E2E TypeScript 必須gate分析

## 結論

既存E2E sourceは専用`apps/web/e2e/tsconfig.json`で型検査できるが、package scriptとCIから到達不能である。現headで専用tsconfigが成功することを確認したため、production／scenario変更なしでfail-fast gateを追加できる。

## 根拠分類

- `confirmed`: Web workspaceの通常typecheckは`apps/web/tsconfig.json`のincludeによりE2E sourceを含まない。
- `confirmed`: E2E専用tsconfigは`./*.ts`をincludeし、Node／Playwright typeを宣言する。
- `confirmed`: Web UI Qualityは3 browser jobそれぞれでbrowser install後にPlaywrightを実行し、E2E sourceの明示的typecheckを行わない。
- `confirmed`: `npx tsc -p apps/web/e2e/tsconfig.json --noEmit`は`313a5382`で成功した。
- `confirmed`: #341〜#344はopen PR一覧になく、#461はproduction UI source中心で本sliceのpackage/workflow ownershipと重複しない。
- `open_question`: 新job名をbranch protectionのrequired statusへ追加するかはrepository owner判断を要する。workflow内の`needs`によりbrowser job自体は型検査失敗時に進まない。

## 選択肢

1. 採用: Web workspace scriptと単一CI jobを追加し、3 browser jobを`needs`で接続する。
2. 非採用: 各browser jobで同じtypecheckを重複実行する。結果は同じだがCI時間とログが重複する。
3. 非採用: root Web typecheckへE2Eを混在させる。DOM／Vite sourceとNode／Playwright sourceのcompiler contextが異なり、既存の専用tsconfig責務を崩す。
4. 非採用: login/profile状態E2Eを追加する。loginはlocal認証fixtureでnetwork stateを安全に制御できず、profileはFR-051と状態分類がowner判断待ちである。

## 追跡境界

| 対象 | requirement | AC | 実装証跡 | 状態 |
| --- | --- | --- | --- | --- |
| UI release evidence gate | NFR-018 | AC-NFR018-006 / 007 | `typecheck:e2e`、Web UI Quality job | 今回実装 |
| 60件のbrowser scenario | SQ-016 | 既存AC | 既存Playwright source | 件数・内容を変更しない |
| manual evidence | NFR-018 / SQ-016 | AC-NFR018-005 / AC-SQ016-008 | manual task | blocked維持 |

## 完了不可の範囲

このgateはE2E test codeの静的整合だけを検証する。browser runtime、代表screen reader、実browser 200%／400% zoom、touch／実機、profile FR-051、API既存失敗／C1 85%、#461統合後再検証は完了扱いしない。
