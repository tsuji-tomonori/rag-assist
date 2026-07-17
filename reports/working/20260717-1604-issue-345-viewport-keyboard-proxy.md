# Issue #345 viewport keyboard proxy 作業完了レポート

## 受けた指示

- PR #410 final head から Issue #345 の残作業を再監査し、重複しない高優先度の bounded unit を選ぶ。
- fresh worktree / branch / task md の受け入れ条件を先に作成し、実装・検証・Draft stacked PR・CI・Issue 証跡・clean worktree まで進める。
- manual / real-device / screen reader / OS virtual keyboard を自動 proxy の合格へ読み替えない。
- merge / deploy / release は行わない。

## 要件整理

- PR #361 が Firefox/WebKit scheduled scope を既に担当するため cross-browser 追加は重複として除外した。
- PR #381/#385/#396/#400/#404/#408/#410 は幅方向 responsive、keyboard、AX、touch、zoom/reflow、reduced-motion/extreme content を担当済みである。
- 未検証だった「textbox focus 中の viewport 高さ縮小」を 320×720px→320×360px の Chromium 自動 proxy として追加した。
- OS keyboard / IME / safe area / browser chrome / VisualViewport event sequence / real-device 固有挙動は manual evidence task に残す。

## 検討・判断

- 最初の E2E は composer 下端 `452.796875px`、send button を含む修正途中は下端 `396.796875px` となり、テストの過剰制約ではなく操作不能な production defect を再現した。
- 根本原因は、mobile 幅向け CSS が動的な短高 viewport を扱わないことに加え、chat content を包む `ResourceStateBoundary` wrapper が `.chat-card` の高さ配分 contract を引き継いでいないことだった。
- chat 専用 wrapper class を通常高では grid、短高では flex column とし、message history を縮小可能にしつつ composer / run ID / note を操作領域内へ収めた。
- 短高 topbar は要素を隠さず、横スクロール可能な 1 行として chat history の高さを確保した。
- full E2E 初回の visual 4 差分は画像を目視し、desktop の不要な full-page overflow 解消と mobile の composer 全体表示という意図した変更のみだったため、該当 baseline 4 件を限定更新した。

## 実施作業・成果物

- `apps/web/src/features/chat/components/ChatView.tsx`: chat 用 `ResourceStateBoundary` class を追加。
- `apps/web/src/styles/viewport-height.css`: wrapper の通常 grid contract と短高 viewport layout を追加。
- `apps/web/src/styles.css`: 新 stylesheet を import。
- `apps/web/e2e/viewport-keyboard.spec.ts`: focus、viewport/VisualViewport、control rect、overflow、Enter 送信、回答確認、再 focus、復元、JSON evidence を検証する `E2E-UI-VIRTUAL-KEYBOARD-001 @smoke` を追加。
- desktop empty/answer/debug と mobile empty の Chromium visual baseline 4 件を更新。
- task md に受け入れ条件、なぜなぜ分析、proxy 境界、検証結果を記録。

## 検証

- 対象 E2E: 1/1 passed。
- `ChatView.test.tsx`: 3/3 passed。
- required smoke E2E: 20/20 passed。
- full E2E: 初回 28 passed / visual 4 failed、目視確認・baseline 限定更新後 32/32 passed。
- visual baseline 対象更新: 4/4 passed。
- Web typecheck、repository lint、Web build、`task docs:check`、`git diff --check`: passed。
- production / E2E / snapshot / task / report files の pre-commit: passed。

## 指示への fit 評価

- 既存 PR と重複しない高さ方向の操作 journey を選び、実 defect の修正と自動回帰証跡まで実施した。
- fixture は E2E 内の chat run endpoint に限定し、production fallback、benchmark 期待語句、QA/dataset 固有分岐を追加していない。
- auth / permission / RAG 根拠性 / API / dependency を変更していない。
- README / `docs/` は既存要件の意味と運用手順を変更しないため更新不要とした。`task docs:check` は pass した。

## 未対応・制約・リスク

- Playwright viewport resize は OS virtual keyboard / IME / safe area / browser chrome / VisualViewport event sequence の完全再現ではない。
- representative screen reader、実 browser zoom、real-device、実 mobile keyboard、scheduled Firefox/WebKit の手動・外部実行証跡は未実施であり、Issue #345 の manual evidence task に残る。
- Draft PR / CI / semver label / PR comments / Issue comment は本レポート作成時点では未実施で、完了後に本レポートへ追記する。
- merge / deploy / release は行わない。
