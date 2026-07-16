# Issue #345 UI 自動品質 gate を PR CI に導入する

状態: do

タスク種別: 機能追加

## 背景

Playwright は desktop Chromium 中心で、E2E workflow は手動 dispatch である。axe、mobile Chromium、代表 visual、browser scope を merge 前に保証できない。

## 目的・対象範囲

`NFR-018` に基づき representative login/chat/documents/questions/admin journey の a11y、mobile、visual と承認 browser scope を deterministic fixture で PR required gate にする。

## 必要情報

- gap: `GAP-UI-008`
- `OQ-UI-001`: Firefox/WebKit required/scheduled scope
- CI runtime、artifact、failure triage policy

## 原因分析（RCA）

### 問題文

2026-07-16 時点の Web UI 検証は desktop Chromium 中心かつ既存 E2E workflow が手動起動であり、UI 関連 pull request に serious / critical accessibility violation、320 / 375px の主要導線崩れ、代表画面の visual mismatch が入っても merge 前に自動検出する required check がなかった。

### 確認済み事実

- `apps/web/playwright.config.ts` の既存 project は Desktop Chrome だけだった。
- 既存 E2E workflow は UI 関連 path の pull request を自動 gate する構成ではなかった。
- 初回 Chromium gate は chat、documents、questions の補助文字コントラスト違反を実際に検出した。
- Firefox / WebKit、screen reader、実 browser 200% / 400% zoom、touch / real-device は Chromium 自動検証で代替できない。

### 推定原因と未決事項

- 推定: E2E が機能 smoke を主目的として追加され、browser / viewport / axe / visual の品質軸と PR path filter が一つの運用契約として定義されていなかったため、自動検出範囲が desktop Chromium に留まった。
- 未決事項: Firefox / WebKit を将来 required に昇格するかは `OQ-UI-001` の owner 判断と、週次実行の安定性・所要時間の証跡が必要である。
- 未決事項: screen reader、実 browser zoom、real-device の代表環境と担当者は manual evidence task で決定する。

### 根本原因と全体対策

根本原因は、UI 変更 path、代表操作、品質軸、browser cadence、failure artifact、未実施表示を結ぶ継続的な merge gate 契約がなかったことである。対策として Chromium の axe / mobile / visual を UI 関連 PR の required scope にし、Firefox / WebKit は未実行を pass にせず週次・手動 scope として証跡を収集する。自動化できない検証は専用 task に残し、`NFR-018`、`DES_UI_UX_001`、Taskfile、Playwright config、PR 本文で境界を同期する。

## 今回の着手（2026-07-16）

- pull request の UI 関連 path 変更時に Chromium の axe / mobile / visual を required workflow として実行する。
- Firefox / WebKit は週次および手動 dispatch の scheduled scope とし、未実行を pass と表示しない。
- failure 時は Playwright report、test-results、trace、screenshot を artifact として保持する。
- manual screen reader、実 browser 200% / 400% zoom、real-device は本 task で代替せず、専用 manual evidence task に残す。

## 実行計画

1. change detection と representative matrix/cost budget を決定する。
2. axe serious/critical、320/375px Chromium、visual test を CI に統合する。
3. Firefox/WebKit の approved required/scheduled scope を実装する。
4. artifact、diagnostic、retry/flaky policy と PR summary を整える。

## 300 pixels 超 visual failure artifact 検証計画（2026-07-16）

- 検証 branch: `codex/issue-345-ui-quality-visual-failure-validation`
- 起点: PR #361 final head `a1f0b254926d6d81fe922cb47a495535f7e103d9`
- fixture: 検証 branch の `apps/web/e2e/visual-regression.spec.ts` だけに、login screenshot 直前の大きい不透明 overlay を一時追加する。PR #361 本体へ fixture / snapshot / tolerance 変更を入れない。
- 実行: `web-ui-quality.yml` を検証 branch で dispatch し、Required Chromium job の nonzero、300 pixels 超 mismatch、always-run artifact upload を確認する。
- evidence: run URL / head SHA / failed step、artifact name / ID / size / retention / expiry、artifact 内の Playwright report / `test-results` screenshot・diff・trace の存在を記録する。
- cleanup: 検証 branch は evidence URL の再現性のため残す。削除、force push、PR 作成、merge は行わない。

### Done 条件

- [x] 検証 branch が PR #361 final head を parent に持ち、fixture 以外の product / CSS / snapshot / config 差分を含まない。
- [x] Required Chromium job が意図した visual mismatch のため非0で終了し、失敗 pixel 数が `maxDiffPixels: 300` を超える。
- [x] `if: always()` の `web-ui-quality-chromium-*` artifact が生成され、Playwright HTML report と `test-results` の failure evidence を取得・確認できる。
- [x] run / artifact evidence を task、作業レポート、PR #361 top-level comment に記録する。
- [x] PR #361 本体へ fixture を混ぜず、owner判断と manual evidence の未達境界を維持する。

### 検証結果

- 検証 branch は `a1f0b254926d6d81fe922cb47a495535f7e103d9` を起点とし、commit `86645496d4ad89ccd8b013c0df95173549f04065` で `apps/web/e2e/visual-regression.spec.ts` のみに12行の不透明 overlay を追加した。比較結果は ahead 1 / behind 0、1 file changed、12 additions / 0 deletionsで、product、CSS、snapshot、config差分はない。
- Web UI Quality run `29507669849` の Required Chromium job `87652582717` は、login screenshotで `878072 pixels (ratio 0.96 of all image pixels) are different` を初回・retryとも検出し、1 failed / 8 passed、process exit code 1で期待どおりfailureした。
- `Upload required UI evidence` stepはfailure後もsuccessし、artifact `web-ui-quality-chromium-1`（ID `8379228289`、2,945,081 bytes、SHA-256 `5d41a8c86a2601fb9d85412fcae0cae3f7a8df187ad34509d32fcb4c1c23df6d`、expires `2026-07-30T14:42:10Z`）を生成した。
- artifactを取得・展開し、`playwright-report/index.html`、初回・retry双方の `login-actual.png` / `login-diff.png` / `login-expected.png` / `test-failed-1.png` / `video.webm`、retryの `trace.zip` が含まれることを確認した。
- 検証 branchは証跡再現性のため残し、PR作成、merge、削除、force pushは行っていない。PR #361 headにはfixtureを含めていない。

## ドキュメントメンテナンス計画

`NFR-018`, `SQ-016`, `DES_UI_UX_001`、CI/Taskfile/Playwright docs と PR template を同期する。skip を pass と表示しない。

## 受け入れ条件

- [x] representative views の serious/critical axe violation が required check を fail させる。
- [x] mobile Chromium 320/375px primary journeys が PR required scope で動く。
- [x] 300 pixelsを超える deterministic visual mismatch が非0となり artifact を取得できる。
- [ ] Firefox/WebKit の scope/owner/cadence/failure handling が実装・文書化される。
- [x] UI 非変更 PR の不要な高コスト実行を避けつつ shared Web/CI change を漏らさない。

## CI 初回検出（2026-07-16）

- Chromium gate は chat composer note の contrast 3.02:1（WCAG AA 4.5:1 未達）を検出したため、text color を `#68758f`（white背景で4.64:1）へ修正した。
- visual baseline は stable capture 後も最大219 pixelsの差が残ったため、最大300 pixelsだけを OS / browser anti-aliasing tolerance として明示した。超過差分は引き続き failure とする。
- 再実行は visual 8 testsを通過し、文書追加不可理由の contrast 4.44:1（4.5:1 未達）を追加検出した。`.field-hint` を canonical muted color `#68758f`（4.64:1）へ統一した。
- 2回目修正後 runは login / chat / documentsを通過し、担当者対応のtoolbar labelとactive card補助文字がlight background上で4.35〜4.36:1だったため、`--color-text-muted-strong`へ変更した。
- 3回目修正後 Web UI Quality run `29460961127` は Chromium 9 / 9 success。
- MemoRAG CI run `29460961162` は task lifecycle移動後の要件トレーステストが旧 `tasks/todo/` pathを固定参照してfailureした。test、NFR-018、DES_UI_UX_001を `tasks/do/`へ同期し、再実行待ちとする。

## latest main 収束後の検証（2026-07-16）

- `origin/main@e12abb07` を merge commit `21e3bae1` で非破壊に取り込み、内容競合なし。main 側の RAG policy / deploy / identity / contract 変更と本 task の13ファイルは重複しない。
- `npm ci` 後も `package-lock.json` は無変更。
- `npm run lint`: pass。
- `npm run typecheck -w @memorag-mvp/web`: pass。
- `npm test -w @memorag-mvp/web`: 初回並列実行は2件 timeout / login待機失敗、単独再実行で61 files / 442 tests pass。
- `npm test -w @memorag-mvp/api -- src/rag/requirements-coverage.test.ts`: package scriptのglobにより全API suiteを実行し、801 tests pass。
- `task docs:check`: pass。
- `npm run test:e2e:ui-quality -w @memorag-mvp/web`: Chromium 9 / 9 pass（representative axe、320 / 375px mobile、visual）。
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-issue345 npm run test:e2e:cross-browser -w @memorag-mvp/web`: Firefox / WebKit 2 / 2 pass（representative axe）。
- `git diff --check`: pass。
- 300 pixels超の意図的な visual failureは専用検証branchのrun `29507669849` で878,072 pixels差、非0終了、artifact `8379228289` のHTML report / screenshot / diff / traceを確認した。fixtureはPR #361へ混入していない。
- 未検証: browser matrixのowner最終判断、実 browser 200% / 400% zoom、representative screen reader、touch / real-device。
- 上記未検証の受け入れ条件が残るため、状態は `do` のままとする。

## 検証計画

- workflow syntax、Playwright list/target run、failure fixture
- local/CI artifact and summary inspection
- Taskfile resolved command、docs check

## PR レビュー観点

required status、continue-on-error 集約、flaky retry による false pass、secret/network 依存、fixture の本番混入を確認する。

## 未決事項・リスク

browser matrix の最終 required 範囲は `OQ-UI-001`。CI 時間増は測定し、未承認 scope を勝手に required 化しない。
