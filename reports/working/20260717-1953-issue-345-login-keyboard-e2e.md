# Issue #345 login 前 keyboard-only journey 作業レポート

## 受けた指示

- GitHub Issue #345 の WCAG 2.2 AA / responsive 対応を未対応がなくなるまで進める。
- リポジトリ所定の worktree、task、commit、Draft PR、日本語コメント、自己レビュー、final-head CI の lifecycle を守る。
- merge、deploy、release は行わない。

## 要件整理と判断

- Issue #345 のうち、既存の visual/reflow と認証後 keyboard evidence で固定されていない login 前 journey を独立した。
- native form semantics を保つため、JavaScript 独自 validation ではなく sign-in email/password に `required` を追加した。
- keyboard focus は existing primary token の 3px outline で明示し、正の `tabindex` は追加しなかった。
- rejected authentication は既存の `role="alert"` と `aria-describedby` の関係を保ち、submit focus と controls の再有効化を component test で固定した。
- E2E は test server の既存 local auth だけを用い、production UI に mock/demo fallback を追加していない。

## 実施作業・成果物

- `LoginPage` の sign-in email/password に native required constraint を追加。
- login input/button に primary token の `:focus-visible` outline を追加。
- LoginPage component test に empty submit と rejected authentication の focus/retry contract を追加。
- `apps/web/e2e/login-keyboard.spec.ts` に `E2E-UI-LOGIN-KEYBOARD-001` を追加。Tab order、Space/Enter、native invalid focus、focus indicator、chat 到達、horizontal containment を 1280×720 / 320×720 で検証する。
- `SQ-016`、`DES_UI_UX_001`、UI trace manifest、generated Web trace/inventory を同期。
- task: `tasks/done/20260717-1937-issue-345-login-keyboard-e2e.md`

## 検証

- targeted LoginPage unit: 2 files / 9 tests pass
- targeted login keyboard E2E: 1/1 pass
- Web unit: 61 files / 442 tests pass
- E2E smoke: 24/24 pass
- E2E all: 36/36 pass
- Web typecheck / root lint / Web build: pass
- semantic UI / trace tests / Web inventory freshness: pass
- `task docs:check`: pass
- `npm run rag:release:source-audit`: dataset-specific branch 0 / artifact mismatch 0
- `npm run ci`: pass（contract 1、API 802、Web 442、infra 38、benchmark 102 tests）
- `git diff --check`: pass
- implementation-head MemoRAG CI: [run 29575196283](https://github.com/tsuji-tomonori/rag-assist/actions/runs/29575196283) success
- semver validation: [run 29575208758](https://github.com/tsuji-tomonori/rag-assist/actions/runs/29575208758) success

## PR / lifecycle

- implementation commit: `d40d3fb3`
- Draft PR: [#427](https://github.com/tsuji-tomonori/rag-assist/pull/427)
- semver: `semver:patch` 1 件
- 受け入れ条件 comment: https://github.com/tsuji-tomonori/rag-assist/pull/427#issuecomment-5002466879
- セルフレビュー comment: https://github.com/tsuji-tomonori/rag-assist/pull/427#issuecomment-5002467740
- PR 作成直後の semver run `29575196233` は label 付与前に起動して failure。`semver:patch` 付与後の再評価で success となった。
- GitHub Apps PR 操作 connector が利用できない実行環境のため、所定 fallback として `gh` を使用した。
- lifecycle commit push 後の final-head CI、Issue #345 進捗 comment、clean/upstream は branch 最終確認として実施する。

## 指示への fit 評価

- login 前 keyboard-only journey は native semantics を保ったまま desktop/mobile Chromium で実行可能な自動証跡となった。
- docs と実装・test ID は trace manifest / canonical generator 経由で同期している。README、API、OpenAPI、運用手順は public API / setup / operation を変えないため更新不要と判断した。
- 認可、RAG 根拠性、benchmark 実装は変更せず、QA sample / dataset 固有分岐も追加していない。

## 未対応・制約・リスク

- representative screen reader、実 browser 200%/400% zoom、real device、Firefox、WebKit、actual Cognito rejection は未検証。Chromium viewport/keyboard automation をこれらの代替とはしない。
- `npm ci` は成功したが、npm audit は既存の 8 vulnerabilities（2 low / 1 moderate / 5 high）を報告した。本差分で dependency / lockfile は変更していない。
- Web build は既存の 500kB 超 chunk warning を報告したが build は成功した。
- merge、deploy、release は実施しない。
