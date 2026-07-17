# Issue #345 zoom reflow proxy E2E 作業レポート

## 受けた指示

- PR #404 後の Issue #345 の自動化可能 gate を再確認し、既存 PR と競合しない次の最小単位を task から draft PR、CI、Issue 更新まで完遂する。
- scheduled Firefox / WebKit または zoom / reflow evidence を優先する。
- 自動化 proxy を手動検証の代替として扱わず、merge / deploy / release は行わない。

## 要件整理

- 1280px 基準の 200% / 400% zoom に対応する CSS viewport を 640px / 320px として明示する。
- 最大権限 persona が login→chat と mobile menu→documents / assignee / admin / profile へ到達できることを両幅で検証する。
- chat と各到達 view で document root の `scrollWidth <= clientWidth` を検証する。
- 倍率、viewport、到達 view、root client/scroll width を JSON evidence として Playwright report へ添付する。

## 検討・判断

- PR #381/#385 の複数幅 responsive/layout/axe/visual、#396 の keyboard-only、#400 の Chromium AX tree、#404 の touch activation と責務を分離した。
- 640px / 320px は CSS viewport reflow の自動 proxy と定義し、実 browser zoom、文字のみ拡大、browser chrome、OS scaling、DPR の合格証跡にはしない。
- 製品挙動や既存要件の意味は変更しない test-only 差分のため README / `docs/` / generated inventory の更新は不要と判断し、`task docs:check` で freshness を確認した。

## 実施作業

- `apps/web/e2e/zoom-reflow.spec.ts` を新規作成した。
- 1280px / CSS viewport の比率を test 内で算出し、200% / 400% 対応を固定した。
- 両ケースで主要 view の URL・landmark 到達と root overflow を検査した。
- ケースごとの証跡を `zoom-reflow-200-percent.json` / `zoom-reflow-400-percent.json` として添付するようにした。

## 検証

- `npm ci`: pass（548 packages、audit 8 件: low 2 / moderate 1 / high 5）
- 対象 Playwright: 2/2 pass
- required smoke: 17/17 pass
- full E2E: 29/29 pass
- Web typecheck: pass
- repository lint: pass
- `task docs:check`: pass
- `git diff --check`: pass
- pre-commit: pass

## 成果物

- `apps/web/e2e/zoom-reflow.spec.ts`
- `tasks/do/20260717-1318-issue-345-zoom-reflow-e2e.md`
- `reports/working/20260717-1331-issue-345-zoom-reflow-e2e.md`

## 指示への fit 評価

- test-only の独立ファイルに限定し、対象外 PR の差分や製品実装を取り込んでいない。
- 倍率との対応、主要許可画面の到達、root overflow 実測値を機械可読証跡として残した。
- 自動 proxy の限界を task、test attachment、report に明記した。
- merge / deploy / release は行っていない。

## 未対応・制約・リスク

- 実 browser zoom control、文字のみ拡大、browser chrome、OS scaling、DPR は未検証であり、手動確認を置き換えない。
- representative screen reader、real-device、scheduled Firefox / WebKit は未検証のまま残る。
- `npm ci` は既知の audit 8 件を報告した。本 task は test-only のため dependency 更新はスコープ外とした。
- Draft PR #408 を作成し、implementation head `be624b53` の required CI（run 29555161594）と semver validation（run 29555167718）が success した。
- 受け入れ条件コメントとセルフレビューコメントを日本語で記録した。task lifecycle final head の CI と Issue #345 の進捗コメントは、完了報告前に off-repo 証跡として記録する。
