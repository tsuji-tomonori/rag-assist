# Issue #345 共通 UI state・回復契約 作業完了レポート

- 日時: 2026-07-14 16:20 JST
- 対象: Issue #345 第3マイルストーン
- branch: `codex/issue-345-shared-ui-states`
- 依存: draft PR #348、draft PR #349
- task: `tasks/done/20260714-issue-345-shared-ui-state-contract.md`

## 受けた指示

Issue #345 の全体完了へ向けて作業を継続し、repository の worktree/task/commit/PR/検証/report workflow を守る。

## 要件整理

- `FR-095` の loading、confirmed empty、error、permission、partial、stale、retrying/recovered を別状態として表す。
- affected target、public-safe message、retry/back/support、alert/status/live/busy/focus semantics を共通化する。
- 初回失敗、permission、未取得を 0 件、blank、`未提供`へ変換しない。
- 複数 endpoint は part 単位で成功/失敗を保持し、refresh failure 時は source/as-of 付き stale content を区別する。
- production UI に固定 count/date/user/capacity や demo fallback を追加しない。
- API/RAG/authorization schema と server-side access control は変更しない。

## 検討・判断

- shared discriminated union、presentation primitive、part-aware controller、feature adapter に責務を分離した。
- HTTP status を失わない `HttpError` を導入し、401/403 を permission state に分類した。raw response detail は controller の表示 state に保存せず、利用者向け文言を一般化した。
- refresh/retry は取得済み part を保持し、失敗時に stale、成功時に recovered とする。superseded request は request ID で破棄する。
- chat の初期描画は認証情報解決後で独立 read がないため、架空の loading を作らず既存の回答生成中 state を対象固有表示として維持した。
- destructive confirmation の失敗は dialog 内 alert で表示し、同じ error を global alert に重複通知しない。
- representative screen reader、実 touch、実 browser 200%/400% zoom、real device の証跡は未取得のため、manual evidence task の未完了範囲として維持した。

## 実施作業

- `ResourceStateBoundary` / `ResourceStatePanel`、state model helper、`useResourceStateController`、semantic state token を追加。
- App shell の generic global loading/error を、target metadata 付き state panel と feature 単位の controller へ置換。
- history、favorites、questions、documents、benchmark、admin、debug loader を part-aware state に接続。
- confirmed result 前の count/KPI/content を非表示にし、admin の failed part を `未提供`、benchmark/documents/history の failed read を 0 件として表示しないよう修正。
- loading→500→retry→empty、HTTP 403、admin partial→recovered、refresh failure→stale→recovered の Chromium E2E を追加。
- primitive/controller tests と feature fixture/test を追加・更新。
- `FR-095`、`NFR-017`、`DES_UI_UX_001`、semantic trace manifest、generated Web inventory を同期。

## 成果物

- `apps/web/src/shared/ui/ResourceState.tsx`
- `apps/web/src/shared/ui/resourceStateModel.ts`
- `apps/web/src/shared/ui/useResourceStateController.ts`
- `apps/web/src/app/uiStateTargets.ts`
- `apps/web/e2e/visual-regression.spec.ts` の `E2E-UI-STATE-001`
- canonical requirements/design、generated Web docs、task 本文

## 検証結果

- focused documents/App tests: 2 files / 60 tests pass
- Web full unit/component: 40 files / 337 tests pass
- Web typecheck: pass
- repository ESLint: pass
- Web production build: pass（153 modules、JS 485.05 kB / gzip 144.07 kB）
- Chromium `E2E-UI-STATE-001`: 4/4 pass
- `task docs:check`: pass
  - canonical docs validation
  - OpenAPI/API code docs freshness
  - semantic UI trace: 8 tests pass
  - Web/infra inventory freshness
  - hidden Unicode check
- `git diff --check`: pass
- staged-file pre-commit（secrets、hidden Unicode、whitespace、EOF、large file、conflict、debug statement、line ending）: pass

`pre-commit run --all-files` の初回試行は本 task 外の既存レポート `reports/working/20260501-0419-architecture-diagram-review.md` の意図的な Markdown hard break を trailing-whitespace hook が変更して失敗した。その task 外変更を元に戻し、今回の staged files に限定した正規 gate を再実行して全 hook が成功した。

初回 full Web test は旧 generic loading 期待と dialog/global error の二重 alert を検出した。chat を架空の initial loading にしない実装、target-specific loading 期待、confirmation error の局所通知へ修正後、失敗入口と full suite を再実行して成功した。初回 lint は component file から非 component export を検出し、model helper を別 module へ分離後に再実行して成功した。

## 指示への fit 評価

- shared state と recovery、false-zero prevention、public-safe controller、representative E2E、docs/trace 同期は受け入れ条件に適合する。
- API/RAG/authorization behavior、benchmark expected phrase、QA/dataset 固有分岐を変更していない。
- production UI の値は API/props/state/config または明示的 unavailable/loading/error/permission state に由来し、test fixture は production fallback と分離されている。
- task lifecycle、PR #350 の日本語 acceptance comment（`issuecomment-4966526682`）、self-review（`issuecomment-4966526903`）を完了し、task を `done` へ移動した。

## 未対応・制約・リスク

- representative screen reader、実 touch、実 browser zoom、safe-area/virtual keyboard、Firefox/WebKit は未実施。Issue #345 全体の manual/cross-screen tasks に残る。
- `npm install --ignore-scripts --prefer-offline` は worktree-local dependency 解決のため実施した。npm は既存 dependency tree の vulnerability 8 件（low 2 / moderate 1 / high 5）を報告したが、本 task では lockfile/dependency update や `audit fix` を行っていない。
- PR #348/#349 が未 merge のため、本 branch は依存 commit を含む。default branch merge 前に依存解消が必要である。
- Issue #345 全体には risky-operation、documents IA、chat/assignee journey、cross-screen a11y、automated/manual quality gate などの未完了 task が残る。
