# Issue #345 benchmark semantic required gate 作業記録

## 入力と判断

- current main: `0771521cbe505d3ffeddcbe34deff89f67de8702`
- 更新対象: Draft PR #462、Issue #345
- open PR / Issue、`tasks/todo/` / `tasks/do/`、`SQ-016`、UI正本、machine-readable trace / matrix、生成文書を確認した。
- benchmarkは`AC-SQ016-003`だけが画面固有の自動証跡待ちであり、production componentを変更中の#461 / #463と競合せずに閉じられるため、今回の最小改善に選定した。

## 変更

- `E2E-UI-SR-SEMANTICS-001`へbenchmarkのregion / heading、suite / dataset / model / concurrencyのname / role / value、実行履歴scroll region / tableを追加した。
- test dataはPlaywright routeに限定し、production component / API / permission / dataset contractを変更していない。
- `SQ-016`、`DES_UI_UX_001`、traceability、quality matrixを`AC-SQ016-003`と同じ証跡へ同期した。
- benchmarkのautomated statusだけを`pass`へ更新し、manual / overallは`blocked`を維持した。

## 検証

- pass: targeted ESLint、repository lint、Web typecheck、Web unit 62 files / 446 tests、Web build。
- pass: UI trace 13 tests、semantic UI 5 tests、generated inventory freshness、canonical docs、OpenAPI、API code docs、manual evidence structure、infra inventory、hidden Unicode、diff check。
- pass: targeted Playwright listing（Chromium 1件）。
- blocked: sandboxの`tsx` IPC `listen EPERM`によりAPI serverが起動せず、targeted Chromium E2Eのローカル実走は未完了。final-head GitHub Actionsで確認する。
- manual evidenceは3 blocked / 1 not_run、`ready: false`であり、合格へ昇格していない。

## 未完了・境界

- representative screen reader、実browser 200% / 400% zoom、touch / real device、Firefox / WebKitは未検証である。
- `FR-051`永続化・owner判断、API C1 85%目標は既存の未完了事項であり、本変更の完了根拠にしない。
- merge、deploy、release、force-pushは実施しない。
