# Issue #359 Phase 3a ConfirmDialog primitive 一本化 作業完了レポート

## 受けた指示

- PR #367 final head `bc6455e0efe34d826079284f6dd5f0d6193cee0d` を厳密な起点とし、専用 worktree / branch で Issue #359 Phase 3a を実施する。
- `shared/ui/ConfirmDialog` を唯一の primitive とし、重複実装と全 consumer を移行する。
- structured details、`useId`、focus lifecycle、Escape / loading close policy、error announcement を実装・検証する。
- Icon / LoadingSpinner は独立 todo とし、PR #338/#361/#368 の product path と重複させない。
- generated Web inventory、Web coverage / type / build / semantic / trace、対象 Playwright、root CI を検証し、日本語 PR lifecycle を完遂する。
- PR #367 の先行 merge を必須条件として明記し、merge / deploy / release は行わない。

## 要件整理と判断

- production 実装は `apps/web/src/shared/ui/ConfirmDialog.tsx` の1件に限定した。
- `details` は表示文字列の colon split を廃止し、`Array<{ label: string; value: ReactNode }>` とした。値自身の colon や rich content を構造と混同しない。
- cancel を通常時の initial focus とし、busy mount / idle→busy 遷移では disabled action に focus を残さず dialog container へ退避する。
- Escape は busy 中に無効化し、複数 instance 時は focus を含む dialog だけが閉じる。backdrop click close は追加していない。
- error は description と共に `aria-describedby` へ関連付け、`role="alert"` で通知する。
- `DocumentConfirmDialog` は文書操作の文言、構造化 detail、削除理由 field を組み立てる domain adapter として保持した。
- existing CSS class / markup contract を維持し、PR #361 の `documents.css` / `visual-regression.spec.ts` は編集せず、同 PR の既存 E2E 資産で確認した。

## 実施作業

- `shared/components/ConfirmDialog.tsx` を削除し、既存 test を `shared/ui` へ移管・5ケースへ拡充した。
- admin 5箇所、history 1箇所、benchmark 2箇所の direct consumer を正本 import と typed details へ移行した。
- `DocumentConfirmDialog` を正本 API へ追従させた。
- semantic UI contract を、唯一 primitive の native dialog / Button 契約と旧 path の不在を検証する形へ更新した。
- generated Web inventory / accessibility / component docs を generator で同期した。
- Icon / LoadingSpinner 統合を `tasks/todo/20260716-2137-issue-359-icon-loading-spinner-unification.md` に分離した。

## 成果物

- 唯一の ConfirmDialog primitive と accessibility / busy lifecycle 実装
- 9 dialog 利用の正本化と structured details
- focus / unique ID / error / busy / double-submit regression tests
- semantic contract と generated Web inventory
- task md と独立 residual todo

## 検証結果

- `npm ci`: 成功。504 packages。既存 dependency audit は 8 vulnerabilities（low 2 / moderate 1 / high 5）を報告したが、依存更新は本タスク対象外のため `audit fix` は実施していない。
- targeted unit: 1 file / 5 tests passed。初回は detail 内 link が input より先になる正しい DOM focus order に期待値を修正し、再実行で成功した。
- `npm run test:coverage -w @memorag-mvp/web`: 61 files / 446 tests passed。statements 90.85%、branches 85.80%、functions 90.72%、lines 93.60%。
- `npm run typecheck -w @memorag-mvp/web`: 成功。
- `npm run build -w @memorag-mvp/web`: 成功。既存の 500 kB chunk size warning のみ。
- `npm run test:web-semantic-ui`: 成功。duplicate 削除後に旧 path を読むテストを修復して再実行した。
- `task docs:web-inventory:check`: 成功。
- `task docs:web-trace:test`: 成功。
- `task docs:check`: 成功。canonical docs、OpenAPI、API code 97 APIs / 582 documents、Web trace / inventory、infra inventory、hidden Unicode を確認した。
- Playwright `E2E-UI-SEMANTIC-001` / `E2E-UI-RISK-001`: Chromium 2/2 passed。初回 sandbox 内は tsx IPC socket の `listen EPERM` で起動不能、承認後に同一コマンドを sandbox 外で再実行して成功した。
- `npm run ci`: 成功。lint、全 workspace typecheck、API 801 / Web 446 / infra 38 / benchmark 102 tests、全 workspace build を含む。
- `git diff --check`: 成功。
- 変更ファイル限定 `pre-commit run --files ...`: 成功。git-secrets、hidden Unicode、trailing whitespace、EOF、large file、merge conflict、line ending を確認した。

## 指示への fit 評価

- ConfirmDialog の正本化、全 consumer 移行、typed API、a11y lifecycle、error / busy regression、generated docs 同期を満たす。
- production 表示値は既存 props / API response / state に由来し、新しい mock / demo fallback は追加していない。
- API route、認証・認可、RAG 根拠性、benchmark evaluator / dataset 分岐は変更していない。
- durable product docs の要件や運用手順は変更せず、実装 inventory のみ generator で同期した。
- PR #338 は generated Web docs の競合リスクがある。PR #361/#368 と product file の直接重複はない。

## 未対応・制約・リスク

- PR #367 の先行 merge が必須であり、本 PR はその依存が解消するまで merge blocker を持つ。
- PR #338 merge 後は generated Web inventory の再生成が必要になる可能性がある。
- manual screen reader、real-device / mobile viewport の手動実機確認は未実施。unit の accessibility lifecycle と Chromium axe / risky-operation E2E で自動確認した。
- Vite chunk size warning と npm dependency audit 8件は本差分起因ではなく、本タスクでは変更していない。
- merge / deploy / release は実施しない。
