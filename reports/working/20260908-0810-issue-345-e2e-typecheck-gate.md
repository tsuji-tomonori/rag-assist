# Issue #345 E2E TypeScript 必須gate 作業レポート

## 結果

E2E専用TypeScript検査をWeb workspace commandとして公開し、Web UI Qualityのbrowser install前に一度だけ実行する共通jobへ接続した。Chromium required、Firefox／WebKit required、scheduled Firefox／WebKitの3 jobは同じ検査成功へ依存する。production source、E2E scenario、required 60件、UI trace／quality statusは変更していない。

## 変更

- `apps/web/package.json`: `typecheck:e2e`を追加し、既存`e2e/tsconfig.json`を参照。
- `.github/workflows/web-ui-quality.yml`: `e2e-typecheck` jobを追加し、3 browser jobへ`needs`を設定。
- `apps/web/e2e/README.md`: ローカルcommand、CI順序、証跡境界を追加。
- `NFR-018`: `AC-NFR018-006`／`007`に対応する実装記録を同期。
- `DES_UI_UX_001`: E2E compiler設定の一意性とfail-fast順序を同期。
- task／spec analysis／本レポートを追加。

生成Web文書はUI挙動、E2E ID、trace metadata、quality statusを変更していないため生成差分なしであり、freshness check成功を同期根拠とした。

## 検証

| 検証 | 結果 |
| --- | --- |
| E2E TypeScript | pass |
| Web TypeScript | pass |
| E2E ESLint | pass |
| Web unit | pass、66 files／473 tests |
| Web build | pass、既存chunk-size advisoryのみ |
| required cross-browser discovery | pass、60 tests／6 files |
| workflow YAML／dependency構造 | pass |
| Web trace／semantic UI | pass、13／5 tests |
| manual evidence schema | pass、7 tests。baselineはblocked 3／not_run 1でrelease-readyではない |
| generated Web inventory freshness | pass、差分なし |
| canonical docs structure | pass |
| OpenAPI quality | pass |
| API code docs freshness | pass、99 APIs／594 documents |
| infra inventory freshness | pass |
| hidden Unicode／Taskfile alias／diff check | pass |

`task docs:check`はTask runner不在で起動できなかった。同Taskfileに列挙された検査を個別実行した。OpenAPI npm scriptは`tsx` CLIのIPC socketがsandboxで`EPERM`になったため、同じTypeScript entrypointを`node --import tsx`で実行して成功した。

## 受け入れ判断

ローカルで検証できるsliceの条件は満たした。final-head GitHub Actionsの新`Required E2E TypeScript` jobと後続browser jobは未確認であり、CI成功までは未完了とする。新jobをbranch protectionのrequired statusへ追加する要否はrepository owner判断が必要である。

## 未完了

- final-head Web UI Quality／MemoRAG CI／semver。
- branch protection required statusのowner確認。
- representative screen reader、Firefox／WebKit native AX tree、実browser 200%／400% zoom、text-only zoom、OS scaling、touch／実機、manual keyboard／contrast。
- 実API／AWS認可、#461統合後の再検証。
- FR-050／FR-051、TC-003、OQ-UI-002、API既存typecheck／test／buildとC1 85%。

merge、deploy、release、force-pushは実施しない。
