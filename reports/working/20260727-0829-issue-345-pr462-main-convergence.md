# Issue #345 / PR #462 current main 再収束レポート

- 実施日: 2026-07-27
- 対象 Issue: #345
- 対象 Draft PR: #462
- 作業 branch: `integration/issue-345-ui-evidence`
- 取込先 main: `0771521cbe505d3ffeddcbe34deff89f67de8702`
- 状態: 実装・ローカル静的検証完了、publish / final-head CI待ち

## 結論

旧 `main@8a427a24` を起点に 77 commits behind となっていた Draft PR #462 へ、current main を履歴改変なしで2-parent mergeした。
PR #448 の cross-screen Phase A/B と PR #466 の auth/FR-025構成を正として保持し、その上へzoom/reflow proxy、layout stress、virtual keyboard proxy、text spacing、skip link、login keyboard、manual accessibility evidence contractを加算統合した。

## 調査結果

- PR #462 head `8e55fcc6` と current main の merge base は `8a427a24` だった。
- head は PR #448 / #466 を祖先に含まず、GitHub上 `mergeable: false` だった。
- 同期用 PR #455 は closed / unmerged であり、PR本文の「#448を保持する」という意図とGit graphが一致していなかった。
- current mainを取り込む前の差分は673 filesに拡大していた。

## 根本原因

evidence stack統合branchの作成後、current mainの取込が完了しないままmain向けPRが作成された。
branch ancestryを検査するgateがなく、本文上の依存関係だけでは未統合を検出できなかった。

## 競合解消

### production source

- `AppShell.tsx`: mainのfeature-based auth importを保持し、skip linkと`main#main-content`を加算した。
- `LoginPage`: mainの`features/auth/components`を正規配置とし、`required`、focus維持、retry可能性の検証を移植した。
- rootの旧`LoginPage.test.tsx`は復活させず、canonical traceもfeature側testへ更新した。
- current mainのvisual baselineを保持した。最終描画のvisual regressionはfinal-head CIで判定する。

### canonical / generated docs

- `SQ-016`、`NFR-018`、`DES_UI_UX_001`でcurrent mainのPhase A/B契約とevidence stack契約を併存させた。
- executable E2Eの孤立をfail-closed検査が検出したため、次のIDをcanonical `ui-traceability.json`へ登録した。
  - `E2E-UI-LAYOUT-STRESS-001`
  - `E2E-UI-TEXT-SPACING-001`
  - `E2E-UI-VIRTUAL-KEYBOARD-001`
  - `E2E-UI-ZOOM-REFLOW-001`
- `E2E-UI-LOGIN-KEYBOARD-001`のunit evidence pathをmainのfeature配置へ更新した。
- Web inventory / trace / quality matrixはgeneratorで再生成し、生成物を手編集していない。

## ローカル検証

| 検証 | 結果 | 証跡 |
| --- | --- | --- |
| `npm run lint` | pass | repository-wide、warning 0 |
| `npm run typecheck -w @memorag-mvp/web` | pass | TypeScript |
| `npm run build -w @memorag-mvp/web` | pass | Vite build。既存chunk size warningのみ |
| `TZ=UTC npm test -w @memorag-mvp/web` | pass | 61 files / 443 tests |
| `npm run docs:web-trace:test` | pass | 13 tests |
| `npm run test:web-semantic-ui` | pass | 5 tests |
| `npm run docs:web-inventory:check` | pass | generated Web docs latest |
| `npm run docs:manual-a11y-evidence:test` | pass | 7 tests |
| `npm run docs:manual-a11y-evidence:check` | pass | schema valid、`ready:false` |
| `python3 scripts/validate_docs.py` | pass | canonical docs |
| API code / infra inventory / hidden Unicode | pass | generated docs latest |
| OpenAPI quality | pass | sandboxでtsx CLI IPC不可のため同一sourceを`node --import tsx`で実行 |
| 対象E2E `--list` | pass | 6 files / 9 Chromium tests |
| 対象E2E実走 | blocked | server起動後、Chromium executable未導入を確認。download endpointは0 MiB応答で導入不能 |
| `git diff --check` | pass | whitespace / conflict markerなし |

## final-head CI 1回目

- Web UI Quality run `30226064611` は6 tests pass、4 visual mismatchでfailした。
- axe / mobile behavior failureではなく、chat empty、answer/citations、debug、mobile chatのcurrent main baselineとviewport-height / skip-link統合後の描画差だった。
- artifact `8638599781`（digest `sha256:06fc3a1566a1257b0bb38433f63c5d5208dd9202fb161360d79cbdf307decea2`）からexpected / actual / diffを取得した。
- 4枚ともinitial / retryのactual SHA-256が一致し、描画はdeterministicだった。
- 目視では、composer / run ID / noteの到達可能性をviewport内で改善し、mobileのoptional suggestionをscroll領域へ収める意図したreflowだった。欠落、permission漏えい、読めない重なりは確認しなかった。
- 他のvisual baselineは変更せず、この4枚だけをCI actualへ同期した。

## 未完了・blocker

- 4 visual baseline同期後のfinal-head Web UI Quality再実行は待ち。
- manual evidence baselineは、keyboard `not_run`、screen reader / browser zoom / real device `blocked`、matrix `open_question`、`ready:false`のまま。
- 200% / 400%はviewport proxyであり、実browser zoom passとは主張しない。
- representative screen reader、Firefox / WebKit、touch / real deviceは未検証。
- `OQ-UI-002`のowner / cadence / approved matrixはowner判断待ち。

## 適合性

- RAGの根拠利用、認可境界、dataset固有production分岐を変更していない。
- current mainのFR-025とcross-screen Phase A/Bを巻き戻していない。
- automation proxyとmanual evidenceを区別し、未実測をpassへ昇格していない。
- merge、deploy、release、force-pushは実施していない。

## 次の作業

1. 4 visual baselineだけを追加commitして既存Draft PR #462 branchへfast-forwardする。
2. final-head Web UI Quality、MemoRAG CI、semverを確認する。
3. PR / Issueコメントへ最終CIと未完了を追記する。
4. manual evidenceとowner判断は後続taskとして継続する。
