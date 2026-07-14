# Issue #345 UI 語彙・semantic primitive 作業完了レポート

- 日時: 2026-07-14 18:33 JST
- 対象: Issue #345 第4マイルストーン
- branch: `codex/issue-345-ui-language-primitives`
- 依存: draft PR #348〜#350（#350 latest CI-success head `1ceafeab`）
- task: `tasks/done/20260714-issue-345-ui-language-primitives.md`

## 受けた指示

Issue #345 の全体完了へ向けて作業を継続し、repository の worktree/task/commit/PR/検証/report workflow を守る。

## 要件整理

- `NFR-017` に基づき、同じ status、intent、risk を共通の表示語彙・semantic tone・複数 cue で表す。
- raw enum、opaque ID、internal module/service 名を ordinary task の主要 label/input として露出しない。
- dialog、status、retry、warning/danger action を native semantics と共通 primitive contract へ揃える。
- production 値は API/props/state/config または明示的 unavailable state に由来させ、demo fallback を追加しない。
- API/RAG/authorization behavior と server-side access control は変更しない。

## 検討・判断

- domain type を source of truth とし、`displayMetadata.ts` は exhaustive な表示語・tone mapping だけを所有する。未知値を推測する generic fallback は作らない。
- `StatusBadge` は文字列、形状 marker、semantic tone を併用し、色だけで状態を伝えない。
- warning/danger action は共通 `Button` intent を使う。2系統の既存 `ConfirmDialog` は native dialog semantics、初期 focus、focus trap/restore、Escape、busy state を共通化した。
- 実行 ID、model ID、dataset path など必要な技術値は明示ラベル付きの詳細として残し、主要見出しや未選択 placeholder にはしない。
- arbitrary brand/layout color の全面移行、全画面 responsive、representative screen reader、実 touch/zoom/device は別 task のまま維持した。

## 実施作業

- managed user、question、benchmark、async agent、document/reindex/share、alias、debug/fact coverage の exhaustive display metadata を追加。
- semantic status token、`StatusBadge`、`Button` の warning/danger intent と component tests を追加。
- admin、agents、benchmark、debug、documents の代表表示を日本語の approved vocabulary と共通 primitive へ移行。
- API に表示名がない値は `名称未提供` / `利用不可` / `未設定` と明示し、固定名や架空値で補完しないよう修正。
- shared confirmation dialog の focus trap/restore、Escape、`aria-modal`、`aria-busy` と warning/danger action contract を強化。
- WCAG AA token contrast、色以外の cue、raw representative status、dialog contract を検証する semantic Node test を追加し、MemoRAG CI の failure aggregation へ組み込んだ。
- `@axe-core/playwright` を test-only dependency として追加し、status/dialog の axe E2E を追加。
- status/token/wording 変更に合わせて 8 visual baselines、`NFR-017`、`DES_UI_UX_001`、semantic trace、generated Web inventory を同期。

## 成果物

- `apps/web/src/shared/ui/displayMetadata.ts`
- `apps/web/src/shared/ui/StatusBadge.tsx`
- `apps/web/src/shared/ui/Button.tsx`
- `apps/web/src/shared/components/ConfirmDialog.tsx`
- `tools/web-inventory/semantic-ui-contract.test.mjs`
- `apps/web/e2e/visual-regression.spec.ts` の `E2E-UI-SEMANTIC-001`
- canonical requirement/design、semantic trace、generated Web docs、visual baselines

## 検証結果

- focused representative features: 初回 88 tests 中2件が追加 assertion の曖昧 selector/前提不足を検出。selector と利用者操作を修正後、失敗入口 83/83 pass
- Web full coverage: 43 files / 342 tests pass
  - statements 91.65%（3776/4120）
  - branches 85.26%（3587/4207）
  - functions 92.25%（1132/1227）
  - lines 94.49%（3278/3469）
- API requirements trace focused test: 1/1 pass（task lifecycle の `tasks/do/` path を検証）
- Web typecheck: pass
- repository ESLint: pass
- Web production build: pass（155 modules、JS 490.50 kB / gzip 145.99 kB）
- semantic UI contract: pass（display vocabulary、dialog intent/focus、multiple cue、WCAG AA token contrast）
- Chromium `E2E-UI-SEMANTIC-001` axe: 1/1 pass
- Chromium full `@visual`: 6/6 pass。最終文言調整後の管理/デバッグ対象: 2/2 pass
- `task docs:check`: pass
  - canonical docs validation
  - OpenAPI/API code docs freshness（95 APIs / 570 documents）
  - semantic UI trace 8 tests
  - Web/infra inventory freshness
  - hidden Unicode check
- `git diff --check`: pass

最初の final docs check は直前の dialog semantics 変更による generated Web inventory 3件の stale を検出した。inventory を再生成し、再実行して成功した。sandbox 内の一度の実行では `tsx` IPC socket が `EPERM` になったため、ユーザー承認を得た同一 read-only command を sandbox 外で実行した。その後の最終実行は sandbox 内で成功した。

## 指示への fit 評価

- semantic vocabulary/token/primitive、multiple cue、native dialog semantics、representative migration、automated axe/visual/CI gate、docs/trace 同期は本 task の受け入れ条件に適合する。
- production UI の値は API/props/state/config または正直な unavailable state に由来し、test fixture は production fallback と分離している。
- API route、authorization middleware、RAG retrieval/citation、schema/store を変更していない。
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐を product implementation に追加していない。
- draft PR #351、日本語の受け入れ条件コメント（`issuecomment-4967662322`）、セルフレビュー（`issuecomment-4967662591`）を登録後、task を `tasks/done/` へ移動し、正規要件・API trace を同期した。

## 未対応・制約・リスク

- representative screen reader、実 touch、実 browser 200%/400% zoom、safe-area/virtual keyboard、real device、Firefox/WebKit は未実施。Issue #345 の manual/cross-screen tasks に残る。
- document/admin の情報設計・用語を全件置換する task ではなく、残る専門的 technical detail は後続の document/admin milestone で文脈とラベルを再確認する。
- `@axe-core/playwright` は devDependency と lockfile のみを変更し、production bundle には追加していない。
- npm が報告した既存 dependency tree の vulnerability 8件（low 2 / moderate 1 / high 5）は別 scope で、`audit fix` は実施していない。
- PR #348〜#350 が未 merge のため、本 branch は依存 commits を含む。default branch merge 前に依存解消が必要である。
- latest GitHub Actions は lifecycle commit push 後に確認するため未確認。成功確認前は merge 不可である。
