# Issue #345 cross-screen Phase B 作業レポート

- 日時: 2026-07-17 01:07 JST
- 状態: in progress（draft PR final-head CI evidence待ち）
- 対象branch: `codex/issue-345-cross-screen-phase-b`
- base: PR #381 final head `b6acb24ff81acd08981ada8ebb3df63810f6d57b`

## 受けた指示

Phase A evidence / fail matrixを確認し、AppShell / RailNav / target / focus / reflow、assignee 768px overflow、history / favorites / benchmark / admin contrast、benchmark focusabilityを修正する。target-size / nested overflowは根拠なくpassへ変えず、Login / authはPR #382との競合を避ける。matrix、Playwright artifact、task、report、日本語draft PR、final-head CIまで実施し、manual screen reader / real-deviceは未検証とする。merge / deploy / releaseは行わない。

## 要件整理と判断

- Phase A artifact `8380727694`（workflow run `29511170528`）の32 baseline entryを再解析した。
- target-size 4件はassignee checkboxの18×18px、確定overflowはassignee 768px root、確定axe blockerは4画面のcontrastとbenchmark scroll region focusabilityだった。
- candidate overflowは実害のあるreflow / truncationを修正し、visually-hidden label、装飾、native input text viewport、keyboard操作可能なscroll containerだけを要素・意図・owner・代替操作付きの例外として記録する。未分類candidateはPlaywright failureとする。
- automated passだけでSQ-016適合を宣言せず、manual screen reader、実browser zoom、touch / real-deviceをblockedのまま残す。

## 実施作業

- AppShellのprimary `main` landmarkからRailNavを分離した。
- RailNav primary controlsを44px classの明示的なcomputed audit対象にし、home focus indicatorを追加した。
- assigneeを4 / 2 / 1 columnへreflowし、checkboxを24px、back controlを44pxへ変更した。
- muted foreground tokenをAA small-text contrast contractへ合わせ、benchmark hard-coded label colorをtoken化した。
- benchmark / documents horizontal scroll regionをaccessible name付きでfocus可能にし、focus indicatorを追加した。
- documents mobile manager rowのspecificity conflictとchat file-name truncationを修正した。
- computed audit schemaをversion 2へ更新し、根拠付きexceptionとunresolved candidate failure assertionを追加した。
- component / semantic contract testを更新した。Login / auth、API、permission、RAG、benchmark dataset固有分岐は変更していない。

## 検証結果

- `npm ci`: pass。504 packages。npm auditは既存の8 vulnerabilities（low 2 / moderate 1 / high 5）を報告し、自動fixは実施していない。
- changed TypeScript / TSX targeted ESLint: pass。
- `npm run test:web-semantic-ui`: pass。
- targeted Vitest: 3 files / 87 tests pass。
- `npm run typecheck -w @memorag-mvp/web`: pass。
- `npm test -w @memorag-mvp/web`: 61 files / 443 tests pass。
- `npm run build -w @memorag-mvp/web`: pass。既存の500kB超chunk warningあり。
- `npm run docs:web-trace:test`: pass。
- `git diff --check`: pass。
- targeted Playwright cross-screen audit: local sandboxが`tsx` IPC listenを`EPERM`で拒否し、browser実行前にblocked。権限昇格せず、draft PR CI artifactを正式証跡にする。

## 成果物

- production / audit / test差分: `apps/web/`、`tools/web-inventory/semantic-ui-contract.test.mjs`
- canonical docs: `REQ_SERVICE_QUALITY_016.md`、`DES_UI_UX_001.md`
- task: `tasks/do/20260717-0054-issue-345-cross-screen-phase-b.md`
- matrix: final-head CI artifact確認後に`tools/web-inventory/ui-quality-matrix.json`とgenerated projectionを更新する。

## 指示へのfit評価

実装・local static/unit/build検証は指示範囲にfitしている。Login / auth競合を避け、例外を自動passへ昇格させていない。Playwright browser evidence、matrix確定、日本語draft PR comment、final-head CIは未完了のため、本レポートとtaskを完了扱いしない。

## 未対応・制約・リスク

- manual screen reader、200% / 400% browser zoom、touch / real-deviceは未検証であり、Issue #345全体のmanual evidence taskへ残す。
- Firefox / WebKitはscheduled scopeで未実行。
- local Playwrightはsandbox listen制約でblocked。CIがfailureの場合はartifactを再解析して修正する。
- merge / deploy / releaseは実施しない。
