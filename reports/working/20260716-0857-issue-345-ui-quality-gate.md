# 作業レポート（partially complete）

保存先: `reports/working/20260716-0857-issue-345-ui-quality-gate.md`

## 受けた指示

Issue #345 の draft PR #361 を latest `main` へ収束し、残る安全な自動検証、必要修正、PR更新まで進める。未検証のrequired criteriaを完了扱いにせず、taskを `tasks/do/` に維持する。

## 判断

- Issue #345 は closed だったが、3件の todo、NFR-018、SQ-016、PR #357 の記載が未完了を示すため再オープンした。
- #348〜#357 は main へ収束済みのため、次の owner task である UI 自動品質 gate に着手した。
- PR-required は Chromium、Firefox / WebKit は週次・手動 scheduled scope とし、CIコストと未承認 browser scopeを分離した。
- automation は screen reader、実 browser 400% zoom、real-device evidenceを代替しない。
- task の主目的は merge gate の新設であるため、許容分類を `機能追加` とし、既知事実・推定・未決事項・根本原因・全体対策をRCAとして補完した。
- published branchの履歴を書き換えず、`origin/main@e12abb07` はmergeで非破壊に取り込んだ。

## 実施内容

- task を `tasks/todo/` から `tasks/do/` へ移動
- representative login/chat/documents/questions/admin の serious / critical axe gateを追加
- 320 / 375px mobile navigation と deterministic visual testをPR required scopeへ設定
- Firefox / WebKit の週次・手動 scheduled scopeを追加
- failure artifactとして Playwright report / test-results / trace / screenshot / videoを保持
- NFR-018、DES_UI_UX_001、Taskfile、package scriptsを同期
- Issue #345を再オープンし、完了判定矛盾を記録
- 初回 Chromium gate が composer note の contrast 3.02:1 と最大219 pixelsのvisual描画差を検出
- composer note を `#68758f`（white背景で4.64:1）へ修正し、visual anti-aliasing toleranceを最大300 pixelsに限定
- latest `main` を競合なしで取り込み、`package-lock.json` が `npm ci` 後も無変更であることを確認
- task の分類・RCA・受け入れ条件実績を補完し、既存3ファイルのEOF余分空行を除去
- Chromium 9件、Firefox / WebKit各1件をlocal fixtureで実行
- PR #361 final headから専用検証branchを作り、spec-onlyの不透明overlayで300 pixels超のfailure pathを実証
- failure後もPlaywright HTML report、初回・retryのactual / expected / diff / screenshot / video、retry traceをartifactへ保持できることを実査

## 検証状況

### 実行済み

- `npm ci`: pass。sandbox初回は`esbuild`起動が`EPERM`、承認付き再実行でpass。`package-lock.json`は無変更。
- `npm run lint`: pass。
- `npm run typecheck -w @memorag-mvp/web`: pass。
- `npm test -w @memorag-mvp/web`: 初回並列実行は2件失敗、単独再実行で61 files / 442 tests pass。
- `npm test -w @memorag-mvp/api -- src/rag/requirements-coverage.test.ts`: package scriptのglobにより全API suiteとなり、801 tests pass。
- `task docs:check`: pass。
- `npm run test:e2e:ui-quality -w @memorag-mvp/web`: Chromium 9 / 9 pass。sandbox初回は`tsx` socketが`EPERM`、承認付き再実行でpass。
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-issue345 npm run test:e2e:cross-browser -w @memorag-mvp/web`: Firefox / WebKit 2 / 2 pass。browser binariesはworkspace外の`/tmp`へ取得。
- `git diff --check`: pass。

### 300 pixels超 visual failure artifact検証

- 検証branch `codex/issue-345-ui-quality-visual-failure-validation` はPR #361 head `a1f0b254926d6d81fe922cb47a495535f7e103d9` から作成した。
- probe commit `86645496d4ad89ccd8b013c0df95173549f04065` は `apps/web/e2e/visual-regression.spec.ts` だけを変更し、login screenshot直前に全画面不透明overlayを12行追加した。比較はahead 1 / behind 0、1 file changed、12 additions / 0 deletionsで、product、CSS、snapshot、config差分はない。
- Web UI Quality run `29507669849`、Required Chromium job `87652582717` は `878072 pixels (ratio 0.96 of all image pixels) are different` を初回・retryとも検出し、1 failed / 8 passed、process exit code 1で期待どおりfailureした。
- failure後の `Upload required UI evidence` stepはsuccessし、artifact `web-ui-quality-chromium-1`（ID `8379228289`、2,945,081 bytes、SHA-256 `5d41a8c86a2601fb9d85412fcae0cae3f7a8df187ad34509d32fcb4c1c23df6d`、created `2026-07-16T14:42:10Z`、expires `2026-07-30T14:42:10Z`）を生成した。
- artifactを取得・展開し、`playwright-report/index.html`、初回・retry双方の `login-actual.png` / `login-diff.png` / `login-expected.png` / `test-failed-1.png` / `video.webm`、retryの `trace.zip` が存在することを確認した。
- run: https://github.com/tsuji-tomonori/rag-assist/actions/runs/29507669849
- artifact: https://github.com/tsuji-tomonori/rag-assist/actions/runs/29507669849/artifacts/8379228289
- 検証branchは証跡URLの再現性のため残し、PR作成、merge、削除、force pushは行っていない。PR #361本体にはprobe fixtureを混ぜていない。

### CI初回結果

- Web UI Quality run `29460420911`: failure（2 passed / 7 failed）。axe がchat composer noteの serious contrast違反を検出し、visualはstable capture後も85〜219 pixels差でfailureした。artifact `8360958884` を保存済み。
- 上記2点の修正後 run `29460656200` は visualを含む8 testsに成功し、文書追加不可理由の contrast 4.44:1を追加検出した。`.field-hint` を `#68758f`（4.64:1）へ統一した。
- 2回目修正後 run `29460804777` は login / chat / documentsを通過し、担当者対応のtoolbar labelとactive card補助文字がlight background上で4.35〜4.36:1だったため、`--color-text-muted-strong`へ変更した。
- 3回目修正後 Web UI Quality run `29460961127`: Chromium 9 / 9 success。
- MemoRAG CI run `29460961162`: API要件トレーステストが移動前の `tasks/todo/` pathを固定参照しfailure。test、NFR-018、DES_UI_UX_001を `tasks/do/`へ同期し、再実行待ち。
- Validate Semver Label run `29460478710`: success。

### 未実施・pending

- browser matrixのowner最終判断: `OQ-UI-001` が未決。
- screen reader、実 browser 200% / 400% zoom、touch / real-device: manual evidence taskで未完了。
- 証跡更新commit後のlatest GitHub CI: push前のため未確認。

## Fit評価

総合fit: 4.6 / 5.0（92%）

主要な自動品質gate、正本文書同期、latest main収束、Chromium / Firefox / WebKitの自動検証、300 pixels超のvisual failureとfailure artifactの実証まで対応した。owner判断、manual a11y / zoom / real-device証跡が未確認のため、taskとPRはpartially completeとして維持する。
