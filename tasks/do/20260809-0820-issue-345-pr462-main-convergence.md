# Issue #345 Draft PR #462 を current main へ再収束する

状態: do

タスク種別: 修正

## 背景

Draft PR #462 は UI/UX 品質証跡を継続追加しているが、最終更新後に main へ PR #467 と #469 が統合された。stale な base のまま次の UI 変更を積むと、current main の正本・生成文書との整合性確認が遅れ、差分と統合リスクが拡大する。

## 問題文

2026-08-09 時点の PR #462 head `13d142ee38d34a174d2797344e82aa570ab12a03` は `origin/main@8e542b31da137129927c1ea8d21650b0c0d483c8` に対して behind 8 / ahead 41 である。PR は Draft のまま mergeable だが、latest main を含まない head の CI と文書証跡だけでは current main との統合結果を判定できない。

## 確認済み事実

- main の追加8 commitsは FR-014 の fail-closed 修正、API test、`REQ_FUNCTIONAL_014.md`、API生成文書、open PR監査task/reportを変更した。
- PR #462 は Web UI実装・E2E、`REQ_SERVICE_QUALITY_016.md`、`REQ_NON_FUNCTIONAL_018.md`、`DES_UI_UX_001.md`、Web生成文書、UI task/reportを変更している。
- `origin/main` の追加差分と PR #462 固有差分に同一pathはなく、`git merge-tree` に conflict marker はない。
- main側は FR-014/API文書、PR #462側は SQ-016/UI文書を所有しており、正本の競合候補はない。
- representative screen reader、実browser 200%/400% zoom、touch/実機、Firefox/WebKit、FR-051永続化のowner判断、API C1 80.48%は未完了である。

## 推定・未確認

- 推定: path競合はないため2-parent mergeは機械的に安全だが、生成物freshnessと最終head CIを通すまで意味的統合は完了扱いにできない。
- 未確認: GitHub Actionsのfinal-head結果と、manual-only条件の実機結果。

## 根本原因と対策

根本原因は、長期Draft PRの更新中にも独立したmain統合が継続し、公開branchとcurrent mainが再び分岐したことである。新規UI改善は追加せず、published historyを書き換えない2-parent mergeでPR #462をcurrent mainへ収束する。mainのFR-014/API文書とPR側のSQ-016/UI文書をともに保持し、生成物は手編集せずgenerator/freshness checkで検証する。

## 対象範囲

- current main と PR #462 head の非破壊統合
- task/report、PR本文、受け入れ条件、セルフレビュー、Issue #345進捗の同期
- Web/UIと、main追加分に関係するAPI/docsの最小十分な回帰検証

## 対象外

- 新規UI機能・仕様変更
- manual screen reader、実browser zoom、touch/実機の代替判定
- FR-051永続化のowner判断、API C1改善
- merge、deploy、release、force-push

## 受け入れ条件

- [ ] `origin/main@8e542b31` と PR #462 head `13d142ee` をpublished historyの書き換えなしで統合し、behind 0にする。
- [ ] mainのFR-014/API正本・生成文書と、PR #462のSQ-016/UI正本・生成文書を一意に保持し、重複・競合・stale生成物がない。
- [ ] Web lint / typecheck / unit / build、UI trace / semantic、required Playwright解決、canonical/generated docs check、main追加分のtargeted API testが成功する。
- [ ] final headのWeb UI Quality、MemoRAG CI、semver検査を確認し、失敗・未実行を完了扱いにしない。
- [ ] Draft PR本文、日本語の受け入れ条件・セルフレビュー、Issue #345、作業レポートを最新結果へ同期する。
- [ ] representative screen reader、実browser 200%/400% zoom、touch/実機、Firefox/WebKit、FR-051 owner判断、API C1を未完了として維持する。

## 検証計画

- `git diff --check`
- `npm run lint`
- `npm run typecheck -w @memorag-mvp/web`
- `TZ=Asia/Tokyo npm test -w @memorag-mvp/web`
- `npm run build -w @memorag-mvp/web`
- UI trace / semantic test、Playwright `--list`
- canonical docs、OpenAPI、API code docs、Web inventory/freshness、hidden Unicode
- FR-014で変更されたAPI unit testのtargeted実行
- final headのGitHub Actions 3 workflow

## リスク

- 長期stackのため、path競合がなくても正本と生成物の意味的driftが残る可能性がある。
- final-head CIはAPI coverage thresholdを含み、既存C1不足が再発する可能性がある。
- automated AX/viewport evidenceはmanual screen reader・実browser zoom・実機証跡を代替しない。
