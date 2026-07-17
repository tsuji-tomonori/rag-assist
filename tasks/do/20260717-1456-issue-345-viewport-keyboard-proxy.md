# Issue #345 virtual-keyboard viewport proxy E2E

- 状態: do
- タスク種別: 修正
- 関連 Issue: #345
- Stacked base: PR #410 final head `bd361e86800a4436c96de6672061b62fa9268fc3`

## 背景

Issue #345 の manual evidence task は virtual keyboard / real-device behavior を未完了としている。既存 PR #361 は Firefox/WebKit scheduled scope、#381/#385 は幅方向 cross-screen、#396/#400/#404 は keyboard/AX/touch、#408/#410 は zoom/reflow と reduced-motion/extreme content の自動 proxy を担当する。一方、chat composer に focus した状態で viewport 高さが動的に縮小しても、入力・送信・回答確認を完了できる自動証跡はない。

本 task は実 mobile OS の IME、safe area、browser chrome、VisualViewport quirks を再現せず、320px viewport の高さを 720px から 360px へ縮小する代表 proxy に限定する。

## 目的

chat textbox focus 中に 320×360px へ viewport が縮小しても、composer/textbox/send が viewport 内で操作可能で、Enter 送信と回答確認を完了し、root/chat region の水平 overflow が発生しないことを自動検出する。

## スコープ

- `apps/web/e2e/viewport-keyboard.spec.ts` を新規追加する。
- chat layout の意図した表示変更に合わせ、desktop empty/answer/debug と mobile empty の Chromium visual baseline 4 件を更新する。
- test 内で chat run endpoint のみ deterministic response へ差し替える。
- 320×720px で sign-in/focus 後、320×360px へ縮小し、focus・bounding rect・submit・answer・overflow を確認する。
- initial/compact/restored viewport、visual viewport、active element、element rect、overflow、URL を JSON evidence として添付する。
- 短高 viewport で chat composer が viewport 外へ押し出される CSS の高さ制約を修正する。
- API / auth / permission / RAG / benchmark / dependency は変更しない。

## なぜなぜ分析

### 発生事象（confirmed）

- 320×720px で textbox に focus した後、Playwright の viewport を 320×360px へ縮小すると、focus と `innerHeight=360` は維持された一方、composer の下端は `452.796875px` となり viewport 外へ約 93px はみ出した。
- mobile 幅では `.main-area` が `100dvh - 64px`、`.split-workspace` が残り領域を担うが、`.chat-card` は `height: auto` と `min-height: min(560px, 100%)`、composer は `min-height: 136px` を持つ。
- `.chat-card` は `overflow: hidden` であり、短高 viewport で内在高が利用可能高を超えると composer 側が画面外へ切り落とされる。
- chat の実コンテンツは `ResourceStateBoundary` が生成する wrapper 内にあり、`.chat-card` の grid / flex sizing は message list と composer へ直接適用されない。短高時の実測では chat card 自体は 178–356px に収まった一方、wrapper content の `scrollHeight` は 582px、focus による `scrollTop` は 291pxで、send button 下端は 396.8px に残った。

### なぜ連鎖

1. なぜ送信 UI が viewport 外へ出たか: mobile 幅の chat card が短高 viewport の利用可能高まで縮まらなかったため。
2. なぜ縮まらなかったか: 幅 breakpoint は `height: auto` と mobile 向け min-height / composer min-height を指定する一方、高さが急減する状態の override がなかったため。
3. なぜ chat card を縮めても composer が収まらなかったか: `ResourceStateBoundary` wrapper に chat content の高さ配分 contract がなく、message list / composer / run ID / note が wrapper の内在高で積み上がったため。
4. なぜ focus scroll で回復しなかったか: browser は active textarea までは scroll したが、同じ composer の send button 全体を viewport 内へ入れる位置までは移動しなかったため。
5. なぜ既存検証で検出しなかったか: 既存 cross-screen / reflow E2E は主に幅と通常端末高を検証し、textbox focus 中に viewport 高を 720px から 360px へ動的変更する journey を含まなかったため。

### 根本原因（confirmed）

mobile 幅向け CSS に、virtual keyboard 等で viewport 高が短時間に大きく減る状態の高さ制約がなく、さらに `ResourceStateBoundary` wrapper が chat content の縮小可能な高さ配分を引き継いでいなかった。このため、通常高を前提とした内在高と app shell の clipping が組み合わさっていた。

### 未確定・境界

- Playwright の viewport resize は OS virtual keyboard / IME / safe area / browser chrome / VisualViewport event sequence を完全再現しない。
- 実端末での keyboard overlay / resize 差異は本 task で confirmed とせず、Issue #345 の manual evidence task に残す。

### 修正方針と有効性確認

- 既存の幅 responsive rules と分離した短高 viewport 用 stylesheetを追加し、chat 専用の `ResourceStateBoundary` class を通じて app shell の残り領域内で message list / composer /補助情報を縮められるようにする。
- focused textbox、send button、composer 全体の viewport 内配置、Enter 送信、回答表示、focus 維持、水平 overflow、viewport 復元を同一 E2E journey で回帰検証する。
- smoke / full E2E と静的検証で通常高・既存 journey への退行を確認する。

## 実装計画

1. 320×720px で local admin として sign-in し、chat textbox に focus する。
2. viewport を 320×360px へ縮小し、`innerHeight` / `visualViewport.height` と composer controls の bounding rect を検査する。
3. textbox focus を維持したまま Enter 送信し、deterministic answer を確認する。
4. compact state の root/chat horizontal overflow と操作要素の viewport 内配置を検査する。
5. 短高 viewport 用 CSS を追加し、320×360px でも chat card と composer を app shell 内へ収める。
6. 320×720px へ復元し、composer が操作可能なままであることを確認して JSON evidence を添付する。

## ドキュメント保守計画

- 既存の responsive / reflow 要件を満たすための CSS 修正で API、要件意味、運用コマンドを変更しないため、README / `docs/` / generated inventory は更新不要と判断する。
- `task docs:check` で正本、trace、generated freshness を確認する。

## 受け入れ条件

- [x] AC1: 320×720px で sign-in 後、chat textbox に focus できる。
- [x] AC2: focus 中に 320×360px へ縮小し、`innerHeight` と利用可能な `visualViewport.height` が compact height を反映する。
- [x] AC3: compact state で composer、textbox、send button が viewport 内にあり、textbox focus を維持する。
- [x] AC4: compact state の Enter 送信で回答を表示し、primary chat journey を完了できる。
- [x] AC5: compact state で root/chat region の水平 overflow がなく、720px 復元後も composer が操作可能である。
- [x] AC6: initial/compact/restored viewport、active element、control rect、overflow、URL を JSON evidence に添付する。
- [x] AC7: 対象 E2E、required smoke、full E2E、Web typecheck、repository lint、docs check、diff check、pre-commit が pass する。
- [ ] AC8: PR #410 branch 向け Draft stacked PR の implementation/final head required CI と semver validation を確認する。

## 検証計画

- `npm ci`
- `npx playwright test apps/web/e2e/viewport-keyboard.spec.ts --config apps/web/playwright.config.ts`
- `npm run test:e2e:smoke -w @memorag-mvp/web`
- `npm run test:e2e:all -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run lint`
- `task docs:check`
- `git diff --check`
- `pre-commit run --files <changed-files>`

## PR レビュー観点

- viewport height shrink を実 mobile keyboard 合格証跡に読み替えていないか。
- focus、controls の bounding rect、submit、answer、overflow を単一 journey で実質検証しているか。
- fixture が E2E 内に隔離され、production fallback を追加していないか。
- #361/#381/#385/#396/#400/#404/#408/#410 と責務・ファイルが重複していないか。
- RAG 根拠性、認可境界、benchmark/QA/dataset 固有分岐を変更していないか。

## リスク

- Playwright の `setViewportSize` は OS virtual keyboard / IME / safe area / browser chrome / VisualViewport event sequence の完全再現ではない。
- 320×360px Chromium の代表 proxy であり、全 device/orientation/keyboard locale を網羅しない。
- 実 browser zoom、representative screen reader、real-device、scheduled Firefox/WebKit の実施済み証跡にはしない。
- PR #410 が先に変更された場合、stacked base の再確認が必要になる。

## 検証結果

- 初回対象 E2E: failed（composer 下端 `452.796875px` > viewport `360px`）し、production defect を再現した。
- 修正途中の対象 E2E: failed（composer 下端 `405.796875px`、send button 下端 `396.796875px`）し、`ResourceStateBoundary` wrapper の高さ配分欠落を追加特定した。
- 対象 E2E: 1/1 passed。
- `ChatView.test.tsx`: 3/3 passed。
- required smoke E2E: 20/20 passed。
- full E2E 初回: 28 passed / 4 visual baseline failed。差分を目視し、desktop full-page overflow 解消と mobile composer 全体表示の意図した変更であることを確認した。
- 対象 visual baseline 更新: 4/4 passed。
- full E2E 再実行: 32/32 passed。
- Web typecheck / repository lint / Web build / `task docs:check` / `git diff --check`: passed。
- production / E2E / visual snapshot / task / report files の pre-commit: passed。
- README / `docs/` は、既存 responsive/reflow 要件の意味や API・運用手順を変更しないため更新不要と判断した。
