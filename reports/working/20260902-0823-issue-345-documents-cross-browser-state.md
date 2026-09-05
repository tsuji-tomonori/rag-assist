# Issue #345 文書画面 cross-browser state required gate 作業レポート

## 結果

- 文書画面の `loading / partial / retrying / recovered / confirmed empty / permission` を `E2E-UI-CROSS-BROWSER-STATE-002` として Firefox／WebKit required E2Eへ追加した。
- `documents → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-002` をSQ-016正本、UI正本、authored trace／quality matrix、generated Web docsへ同期した。
- required Firefox／WebKit scopeは32件から36件へ増えた。
- production component、CSS、API、authorization、RAG contract、文書mutationは変更していない。
- 実装確認head `2b28099bd85e8259bcedc8b157d8864db4348002` で必須CIは成功した。

## 実装範囲

- `apps/web/e2e/cross-browser-state.spec.ts`
  - catalog／folder／reindexのloading中にbusyと対象付きloadingを検証
  - 文書取得HTTP 500をpartialとして扱い、取得済み／未更新を区別
  - retry中のcatalog抑止、recovered後のconfirmed empty／0件、各resource read countを検証
  - 全resource HTTP 403をpermissionとして扱い、文書内容／empty／zero／private detailを抑止
  - browser project、state sequence、read count、fixture boundaryをJSON artifactへ記録
- `REQ_SERVICE_QUALITY_016.md`、`DES_UI_UX_001.md`
- `tools/web-inventory/ui-traceability.json`、`ui-quality-matrix.json`
- generator出力4ファイル、E2E README、task、spec analysis

## ローカル検証

- targeted ESLint: pass
- Web typecheck: pass
- Web unit: 62 files／449 tests pass（`TZ=Asia/Tokyo`）
- Web build: pass
- cross-browser state discovery: 8 tests（history 4 + documents 4）
- required cross-browser discovery: 36 tests／6 files
- UI trace validator: 13/13 pass
- semantic UI contract: 5/5 pass
- generated inventory freshness、canonical docs、hidden Unicode、Taskfile alias、`git diff --check`: pass
- local Firefox／WebKit実走: API dev serverの`tsx` IPC socketがsandboxで`listen EPERM`となり、browser起動前に停止。未完了としてCI実走と区別する。
- E2E専用TypeScript: 既存`cross-screen-audit.ts`の`DOMTokenList`／`NodeList` iterator 4件（TS2488）でfailure。新specはPlaywright discoveryでcompile済みだが、この既存failureをpass扱いしない。

## CIとGitHub証跡

- verified implementation head: `2b28099bd85e8259bcedc8b157d8864db4348002`
- [Web UI Quality](https://github.com/tsuji-tomonori/rag-assist/actions/runs/33572990390): pass。Firefox／WebKit required 36/36、Chromium required成功。
- [MemoRAG CI](https://github.com/tsuji-tomonori/rag-assist/actions/runs/33572990402): pass。
- [Validate Semver Label](https://github.com/tsuji-tomonori/rag-assist/actions/runs/33572990419): pass。
- 初回 [MemoRAG CI](https://github.com/tsuji-tomonori/rag-assist/actions/runs/33572235097) は大きな`web-ui-inventory.json`の転送切り詰めによりgenerated freshnessとcanonical docsでfailure。local blob SHA `74ad38740f942c9c46d36a906fb4063566f36859` とGitHub blob SHAを一致させて修復した。
- [PR受け入れ確認](https://github.com/tsuji-tomonori/rag-assist/pull/462#issuecomment-5502287655)
- [セルフレビュー](https://github.com/tsuji-tomonori/rag-assist/pull/462#issuecomment-5502287789)
- [Issue #345進捗](https://github.com/tsuji-tomonori/rag-assist/issues/345#issuecomment-5502287940)

## 未完了・残余リスク

- representative screen reader、Firefox／WebKit native AX tree
- 実browser 200%／400% zoom、text-only zoom、OS scaling
- manual keyboard／contrast、touch／実機
- production incident／実AWS resource、文書mutation
- #461統合後の最終production DOM／generated inventory再検証
- FR-051／OQ-UI-002のowner判断、API C1 85%
- E2E専用tsconfigの既存DOM iterator不整合

上記は今回の自動証跡で完了扱いにしない。今回sliceの受け入れ条件は満たすが、累積taskは`do`、PR #462はDraftを維持する。

## Lifecycle / cleanup recommendation

- #461統合後にDocuments production DOMとtrace／generated inventoryを再検証する。
- manual evidence taskとowner判断が完了するまでPRをReady／mergeへ進めない。
- merge後のbranch／worktree cleanupはmaintainer判断とし、本作業では削除しない。
