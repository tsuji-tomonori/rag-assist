# Issue #345 性能テスト cross-browser state 必須証跡 作業レポート

## 結果

性能テスト画面のloading、実行履歴取得500によるpartial、retry、confirmed empty recovery、全resource 403 permissionをFirefox／WebKit required E2Eへ追加した。画面から`SQ-016`、`AC-SQ016-007`、`E2E-UI-CROSS-BROWSER-STATE-007`までの追跡を正本、authored trace／quality matrix、生成文書で同期し、required範囲を56件から60件へ更新した。

production component／CSS／API／authorization／RAG／benchmark dataset contractは変更していない。manual／overallは`blocked`、taskは`do`、PRはDraftを維持する。

## 実装した契約

- loading中は待機statusを公開し、確定前のempty／zeroを表示しない。
- 実行履歴だけが500の場合は取得済みテスト定義を保持し、partial statusとretryを公開する。
- partial中は未確認の履歴件数／history regionとprivate detailを表示しない。
- retry中は処理中statusを公開し、retry成功後だけrecovered status、`0 件の実行履歴`、明示的empty stateを表示する。
- run／suite resource read countを2回に固定し、retryが全resourceを再読込する現行契約を検証する。
- 全resource 403はpermissionとして公開し、empty／zero、テスト定義、履歴region、private detailを表示しない。
- artifactへbrowser project名、状態系列、read count、test-only route fixture境界を記録する。

## 変更範囲

- E2E: `apps/web/e2e/cross-browser-state.spec.ts`、README
- 正本: `REQ_SERVICE_QUALITY_016.md`、`REQ_NON_FUNCTIONAL_018.md`、`DES_UI_UX_001.md`
- authored source: `tools/web-inventory/ui-traceability.json`、`ui-quality-matrix.json`
- generated: `docs/generated/web-screens.md`、`web-traceability.md`、`web-ui-inventory.json`、`web-ui-quality-matrix.md`
- task／spec analysis／本report

## ローカル検証

- PASS: `npx eslint apps/web/e2e/cross-browser-state.spec.ts`
- PASS: Web typecheck
- PASS: Web unit 66 files／473 tests
- PASS: Web build（既知の500 kB超chunk warningのみ）
- PASS: Firefox／WebKit required 60件discovery、新規ID 2 browser×2 scenario
- PASS: `npm run docs:web-trace:test` 13件
- PASS: `npm run test:web-semantic-ui` 5件
- PASS: generated freshness、canonical docs、hidden Unicode、authored JSON parse、Taskfile alias、`git diff --check`
- BLOCKED: 通常のlocal E2E起動は`tsx` IPCが`EPERM`。`node --import tsx`でAPIを起動する回避後、対象4件は開始したがFirefoxの`browserContext.newPage`が60秒でtimeoutし、assertionまで到達しなかった。ローカル実ブラウザpassとは扱わず、GitHub Actions required gateを最終証跡にする。

## 競合・正本確認

- current mainは`8e542b31`、作業開始時のPR #470 headは`4663f24f`でbehind 0。
- PR #341〜#344はmerge済み。
- Draft PR #461は`BenchmarkWorkspace.tsx`を変更するが、本sliceはproduction sourceを変更しない。統合後の最終DOM再検証は未完了。
- 要件正本は既存`SQ-016`へ集約し、新しい並行正本は作成していない。

## 未完了・blocker

- final-head Web UI Quality／MemoRAG CI／semverの確認。
- representative screen reader、Firefox／WebKit native AX tree。
- 実ブラウザ200%／400% zoom、text-only zoom、OS scaling、touch／実機、manual keyboard／contrast。
- 実API／AWS認可、benchmark start／cancel／download。
- #461統合後の再検証。
- FR-050／FR-051、TC-003、OQ-UI-002のowner判断。
- 既存API test fixture型不整合、API build、API C1 branch coverage 85%未達の解消。

## 次の具体的作業

1. Draft PR #470の最終headでGitHub Actionsを確認し、失敗時は本slice由来か既存blockerかを分離する。
2. PRへ受け入れ確認とセルフレビュー、Issue #345へ進捗・未完了事項を記録する。
3. #461統合後に最終DOMとrequired gateを再検証する。
4. ownerが代表screen reader／OS／browser／device matrixを確定後、manual証跡を採取する。
