# Issue #345 PR #462 を current main へ再収束する

- 状態: do
- タスク種別: 修正
- 関連 Issue: #345
- 対象 PR: #462

## 背景

Issue #345 の cross-screen Phase A/B は PR #448 として `main` へ統合済みである。
一方、zoom/reflow、layout stress、keyboard、text spacing、skip link、login keyboard、manual accessibility evidence をまとめた Draft PR #462 は、統合ブランチが旧 `main@8a427a24` を起点としたままで、current `main@0771521c` を祖先に含んでいない。

新しい UI 改善を積み増す前に、既存 evidence stack を current main へ非破壊統合し、正本・生成物・E2E・CI の競合を解消する。

## なぜなぜ分析

### 問題文

2026-07-27 時点で Draft PR #462 は current `main@0771521c` に対して 77 commits behind / 15 commits ahead で、GitHub 上 `mergeable: false` となっている。

### confirmed

- `integration/issue-345-ui-evidence@8e55fcc6` の親は `main@8a427a24` と evidence stack head `7c9e1953` である。
- current main との merge base は `8a427a24` であり、PR #448 の cross-screen remediation と PR #466 の FR-025 を祖先に含まない。
- current main との差分は 673 files に拡大しており、このままでは main 側の正本・生成物・UI修正を巻き戻す危険がある。
- current main 同期用の逆向き PR #455 は closed / unmerged である。

### inferred

- PR #462 本文の「#448を保持する」は統合意図を示すが、branch graph 上ではまだ実現されていない。
- GitHub の `mergeable: false` は、旧起点と current main の長い分岐および同一 UI/trace/generated files の競合による。

### open questions

- current main 統合時に競合する visual baseline が、main の描画と evidence stack の production fix のどちらを正とすべきかは、最終実装と Playwright 結果で判定する。
- representative screen reader、実 browser 200%/400% zoom、real device、Firefox/WebKit の実測は本タスク環境では未実施のままとする。

### 根本原因

evidence stack の統合ブランチ作成後、current main を同ブランチへ取り込む同期処理が完了しないまま、main 向け PR #462 が作成された。branch ancestry を必須 gate とする自動検査がなく、PR 本文の意図と実際の Git graph が乖離した。

### 対応方針

- published history を書き換えず current main を 2-parent merge する。
- main 側の production UI、cross-screen remediation、正本文書、生成物を正として保持する。
- evidence stack 固有の E2E、manual evidence contract、必要な production fix を current source へ加算統合する。
- 正規 generator と validators を最終 tree で再実行し、生成物を手編集しない。
- compare / CI / PR comments で behind 0 と残余リスクを確認する。

## スコープ

- PR #462 branch の current main への非破壊統合
- 競合する Web UI / E2E / canonical trace / generated inventory / workflow の解消
- 受け入れ証跡、completion status、作業レポート、PR / Issue コメントの同期

## 対象外

- representative screen reader、実 browser zoom、real-device の実測
- `OQ-UI-002` の owner / cadence 決定
- API C1 coverage recovery
- merge、deploy、release、published history の書き換え

## 実装計画

1. current main と PR #462 の差分・競合を確認する。
2. current main を非破壊 merge し、競合を正本優先かつ evidence 加算で解消する。
3. Web inventory / trace / manual evidence の生成・検査を実行する。
4. 変更範囲に応じた lint、typecheck、unit、E2E、docs check を実行する。
5. report / completion status を更新し、commit / push する。
6. Draft PR #462 本文、受け入れ条件、セルフレビュー、Issue #345 を更新する。
7. final-head CI を確認する。

## ドキュメント保守計画

- `SQ-016`、`NFR-018`、`DES_UI_UX_001`、`ui-traceability.json` を正本として扱う。
- `docs/generated/` は `docs:web-inventory` から再生成し、手編集しない。
- 実測していない manual evidence は `blocked` / `not_run` のまま維持する。

## 受け入れ条件

- [ ] current main が PR #462 head の祖先となり、GitHub compare が behind 0 になる。
- [ ] PR #448 の cross-screen remediation と PR #466 の FR-025 契約を巻き戻さない。
- [ ] evidence stack 固有の E2E / manual evidence contract / trace が current source に保持される。
- [ ] canonical docs と generated Web inventory / trace が最終実装と一致する。
- [ ] 選定した lint、typecheck、unit、E2E、docs check が成功する。
- [ ] Draft PR #462 の本文、受け入れ確認、セルフレビュー、Issue #345 に最終状態を記録する。
- [ ] manual screen reader、実 browser zoom、real-device、Firefox/WebKit を未完了として明記する。
- [ ] merge、deploy、release、force-push を行わない。

## 検証計画

- `git diff --check`
- `npm run lint`
- `npm run typecheck -w @memorag-mvp/web`
- `npm test -w @memorag-mvp/web`
- `npm run docs:web-trace:test`
- `npm run test:web-semantic-ui`
- `npm run docs:web-inventory:check`
- `npm run docs:manual-a11y-evidence:test`
- `npm run docs:manual-a11y-evidence:check`
- `python3 scripts/validate_docs.py`
- 対象 Playwright E2E の Chromium 実行または、実行不能時は `--list` と final-head Web UI Quality

## PR セルフレビュー観点

- main の UI/CSS/trace/正本を巻き戻していないか
- automation proxy を manual evidence の pass にしていないか
- docs と実装、E2E ID と canonical trace が一致するか
- RAG 根拠性、認可境界、dataset 固有 production branch を変更していないか
- 未検証事項を完了扱いにしていないか

## リスク

- 長期間分岐した UI / generated docs の競合を誤って片側採用するリスク
- visual baseline が current main 描画と不一致になるリスク
- local browser / sandbox 制約で Playwright 実行を final-head CI に委ねる可能性

## 実施結果（2026-07-27）

- current main `0771521c` を履歴改変なしでmergeし、PR #448 / #466の実装と正本を保持した。
- auth test evidenceをmainのfeature配置へ移し、rootの削除済みshimを復活させなかった。
- 生成時のfail-closed検査で孤立していた4 E2E IDと移設後のlogin unit evidence pathをcanonical traceへ登録した。
- Web inventory / trace / quality matrixを最終sourceから再生成した。
- lint、Web typecheck/build、Web unit 443件、trace 13件、semantic 5件、manual evidence schema 7件、docs / generated checksは成功した。
- Chromium E2E 9件は解決可能であることを`--list`で確認した。ローカル実走はChromium executable未導入かつdownload endpointが0 MiBを返す環境制約でblocked。final-head Web UI Qualityを必須確認とする。
- manual evidenceは`ready:false`を維持し、実browser zoom / screen reader / real deviceを完了扱いしていない。

## 受け入れ条件の現在値

- [ ] current main が PR #462 head の祖先となり、GitHub compare が behind 0 になる。（local merge済み、publish後確認）
- [x] PR #448 の cross-screen remediation と PR #466 の FR-025 契約を巻き戻さない。
- [x] evidence stack 固有の E2E / manual evidence contract / trace が current source に保持される。
- [x] canonical docs と generated Web inventory / trace が最終実装と一致する。
- [ ] 選定した lint、typecheck、unit、E2E、docs check が成功する。（E2Eはfinal-head CI待ち）
- [ ] Draft PR #462 の本文、受け入れ確認、セルフレビュー、Issue #345 に最終状態を記録する。
- [x] manual screen reader、実 browser zoom、real-device、Firefox/WebKit を未完了として明記する。
- [x] merge、deploy、release、force-push を行わない。

## 作業レポート

- `reports/working/20260727-0829-issue-345-pr462-main-convergence.md`
