# Issue #345 履歴画面keyboard・semantic required gate 作業レポート

保存先: `reports/working/20260806-0815-issue-345-history-a11y-required-gate.md`

## 受けた指示

- current main、前回以後の変更、open PR / Issue、tasks、正本・生成物を確認する。
- Issue #345を既存作業と重複しない最優先の小改善1件で前進させる。
- task、実装、正本・生成物同期、最小十分な検証、Draft PR #462、Issue #345コメントまで行う。
- manual screen reader、実browser 400% zoom、実機、owner判断を未検証のまま完了扱いしない。
- merge、deploy、release、force-push、破壊的変更を行わない。

## Input inventory

| source | kind | date / revision | reliability |
| --- | --- | --- | --- |
| GitHub Issue #345 / latest comment | issue evidence | 2026-08-05 / comment 5185990105 | confirmed |
| Draft PR #462 | current integration | final implementation head `94ca7c77`, base `main@0771521c` | confirmed |
| current main | repository baseline | `0771521c` | confirmed |
| open PR #461 filenames | parallel change scope | 2026-08-06確認 | confirmed |
| `AGENTS.md` / repository skills | workflow policy | PR head | confirmed |
| `REQ_SERVICE_QUALITY_016.md` | canonical requirement | PR head | confirmed |
| `DES_UI_UX_001.md` | canonical UI design | PR head | confirmed |
| `ui-traceability.json` / `ui-quality-matrix.json` | machine-readable canonical trace | PR head | confirmed |
| generated Web docs | generated projection | PR head | confirmed |
| keyboard / AX E2E and `HistoryWorkspace` / CSS | implementation evidence | PR head | confirmed |

## 要件整理と判断

- mainと#462に前回以後の変更はなく、Issue #345にもowner判断の追加回答はなかった。
- #461は`HistoryWorkspace.tsx`を含むproduction componentsを変更するため、今回は同ファイルを変更しない。
- quality matrixではhistoryのresponsive、target、state evidenceはpassだが、`AC-SQ016-002` / `003` automatedだけが実行可能証跡待ちでblockedだった。
- profileの`FR-051`永続化やmanual matrixはowner / environment依存で、安全に仮定できない。
- したがって、履歴画面のkeyboard-only journeyとChromium AX tree契約を1件の小改善として選んだ。

## Report facts

- 履歴画面はsearch、sort、favorites checkbox、conversation buttonsをnative controlで提供する。
- 履歴固有controlには一貫した3px focus indicatorがなかった。
- required keyboard E2Eは履歴toolbar / conversation selectionを検査していなかった。
- AX E2Eはlogin / chat / documents / profileを検査するがhistoryを検査していなかった。
- manual evidence baselineは構造上validだが`ready: false`で、3 blocked / 1 not_runを維持する。

## 原因と対策

- 根本原因: 8画面matrixを一括でpassにせず、画面固有journeyを段階追加する運用のため、historyのkeyboard / AX実行証跡が未着手で残っていた。
- 対策: 履歴のfocus indicator、keyboard native key journey、AX name / role / value / checked stateを既存required 2 specへ追加した。
- 一意性: E2E IDは既存cross-view定義を正とし、historyへduplicate verification IDを作らない。generator初回検出後に修復した。

## 実施作業

- historyの戻る、toolbar、checkbox、会話操作へ3px `:focus-visible`と2px offsetを追加。
- keyboard E2Eへ履歴到達、search入力、sort変更、checkbox切替、conversation選択を追加。
- AX E2Eへhistory region / heading / searchbox / combobox value / checkbox checked state / buttonsを追加。
- fixtureはPlaywright routeだけに置き、productionに固定会話やfallbackを追加していない。
- `SQ-016`、UI設計、machine-readable trace / quality matrixを更新。
- generatorで`web-screens.md`、`web-traceability.md`、`web-ui-inventory.json`、`web-ui-quality-matrix.md`を同期。

## 成果物

- `apps/web/e2e/keyboard-navigation.spec.ts`
- `apps/web/e2e/screen-reader-semantics.spec.ts`
- `apps/web/src/styles/features/history.css`
- `apps/web/e2e/README.md`
- `docs/1_要求_REQ/**/REQ_SERVICE_QUALITY_016.md`
- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- `tools/web-inventory/ui-traceability.json`
- `tools/web-inventory/ui-quality-matrix.json`
- generated Web docs
- `tasks/do/20260806-0815-issue-345-history-a11y-required-gate.md`

## 実施した検証

- `npm run lint`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `TZ=Asia/Tokyo npm test -w @memorag-mvp/web`: pass（62 files / 446 tests）
- `npm run build -w @memorag-mvp/web`: pass（既存chunk-size advisoryのみ）
- targeted Playwright listing: pass（2 spec）
- UI trace: pass（13 tests）
- semantic UI: pass（5 tests）
- canonical / generated / manual evidence / infra / hidden Unicode / OpenAPI / API code docs / diff checks: pass
- final-head [Web UI Quality](https://github.com/tsuji-tomonori/rag-assist/actions/runs/31057076424): pass（37 / 37、artifact `8950690693`、digest `sha256:bd398380100d48dba832487eaba82a3eac39e7f2a350b43b3803a25e341b1c3d`）
- final-head [MemoRAG CI](https://github.com/tsuji-tomonori/rag-assist/actions/runs/31057076429): pass（API C0 90.65% / C1 80.48%、Web C0 90.86% / C1 85.77%）
- final-head [semver検査](https://github.com/tsuji-tomonori/rag-assist/actions/runs/31057076433): pass

## 未対応・制約・リスク

- targeted Chromium実走はsandboxが`tsx` IPC listenerを`EPERM`で拒否し、API server起動前にblocked。権限昇格せずfinal-head GitHub Actionsで確認する。
- `task` CLIがないため、内容を確認した`docs:check`の下位コマンドを直接実行した。
- Git push用HTTPS credentialはlocal cloneにないため、GitHub AppのGit data APIでblob SHAとlocal blob SHA、生成tree SHAとlocal tree SHAを一致確認し、forceなしでPR branchをfast-forwardした。
- final-head GitHub Actionsは成功した。PR本文・受け入れ条件・セルフレビュー、Issue #345コメントは最終記録commit後に反映する。
- representative screen reader、実browser 200% / 400% zoom、touch / real device、Firefox / WebKitは未実施。
- profileのFR-051永続化・保存失敗/retry/permission/N/A分類・owner判断は未完了。
- API C1 85%目標は既存coverage taskで追跡し、本変更では扱わない。
- #461がhistory DOMを変更した場合、required E2Eで回帰を検出して収束する必要がある。

## Fit評価

- 小改善1件: fit。history keyboard / semantic evidenceだけに限定した。
- 既存作業との非重複: fit。#461のproduction TSXを変更せず、既存cross-view E2Eを拡張した。
- 正本・生成物同期: fit。正本JSON / Markdownとgenerator出力を同期した。
- 未検証の扱い: fit。manual / overallはblocked、task / PRはDraftのまま維持する。
- 禁止操作: fit。merge、deploy、release、force-push、破壊的変更は行っていない。
