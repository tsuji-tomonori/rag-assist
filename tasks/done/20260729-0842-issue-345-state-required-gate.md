# Issue #345 共通状態 E2E を required UI gate に含める

状態: done

タスク種別: 修正

## 背景

`E2E-UI-STATE-001` は history の loading / 500 / confirmed empty / retry / HTTP 403 と、admin の partial / stale / retry を実装済みだが、4シナリオの test title は `@smoke` のみである。pull request の required `Web UI Quality` は `@ui-quality` 等だけを実行するため、状態契約の回帰が merge 前 gate から漏れている。

## 目的・対象範囲

- `E2E-UI-STATE-001` の4シナリオを required Chromium UI quality gate へ含める。
- 実行証拠がある history / admin の `AC-SQ016-007` automated status だけを `pass` へ更新する。
- manual screen reader、実 browser zoom、real-device、および未検証の6画面を `blocked` のまま維持する。

## 原因分析（RCA）

### 問題文

2026-07-29時点の Draft PR #462 では、共通状態契約の4 E2Eが実装・正本トレース済みである一方、required `Web UI Quality` の最終 head 実行対象19件に含まれていない。

### confirmed

- `apps/web/playwright.config.ts` の `ui-quality` scenario は `@ui-quality|@mobile-required|@visual` を対象にする。
- `E2E-UI-STATE-001` の4 title は `@smoke` のみである。
- `tools/web-inventory/ui-traceability.json` は `E2E-UI-STATE-001` を implemented とする。
- state E2E が対象にする view は history と admin であり、他6 view の状態matrixを証明しない。

### inferred

- state contract は初期の smoke suite で検証され、その後 required UI quality gate が tag-based selection として追加された際に明示的な登録が行われなかった。

### open_question

- 8画面すべての feature state matrix は後続作業であり、本タスクでは history / admin 以外を推測で pass にしない。

### 根本原因

正本上の implemented verification と required CI の実行集合を結ぶ登録が test tag に依存している一方、状態契約を追加した時点の tag が `@smoke` のまま残り、validator は「証拠ファイルの存在」までは確認しても「required scenario で実走されること」までは確認していない。

### 対策

- 直接対策: 4シナリオへ `@ui-quality` を付与し、required gate の同一 fail-closed 実行へ追加する。
- 証拠同期: history / admin のみ matrix note と automated status を更新し、生成文書を正規 generator から再生成する。
- 境界維持: 他 view と manual required scope は blocked を維持し、PR / Issue コメントで未完了を明記する。

## 実行計画

1. state E2E 4件へ required tag を追加する。
2. `SQ-016`、`DES_UI_UX_001`、UI quality matrix を実行範囲に同期する。
3. 生成 Web quality matrix を正規 generator から更新する。
4. lint / typecheck / unit / trace / semantic / docs / E2E list と final-head CI を確認する。
5. Draft PR #462 の本文、受け入れ条件コメント、セルフレビューと Issue #345 を更新する。

## ドキュメントメンテナンス計画

- 正本: `REQ_SERVICE_QUALITY_016.md` と `DES_UI_UX_001.md` に required gate の実行範囲を追記する。
- machine-readable canonical evidence: `tools/web-inventory/ui-quality-matrix.json` の history / admin のみ更新する。
- 生成物: `npm run docs:web-quality-matrix` で `docs/generated/web-ui-quality-matrix.md` を更新する。
- OpenAPI / API / infra の契約は変更しない。

## 受け入れ条件

- [x] `E2E-UI-STATE-001` の4シナリオが `ui-quality` scenario で列挙・実行される。
- [x] history / admin の loading / error / permission / partial / stale / retry 証拠が required gate の failure を遮断する。
- [x] history / admin の `AC-SQ016-007` automated status と正本・生成物が一致する。
- [x] 他6 view、manual screen reader、実 browser 200% / 400% zoom、real-device、Firefox / WebKit の未完了状態を pass にしない。
- [x] lint、Web typecheck / unit、trace / semantic / docs checks と final-head GitHub Actions が成功する。
- [x] Draft PR #462 と Issue #345 に結果と残余 gap を記録する。

## 検証計画

- `npm run lint`
- `npm run typecheck -w @memorag-mvp/web`
- `TZ=UTC npm test -w @memorag-mvp/web`
- `npm run docs:web-trace:test`
- `npm run test:web-semantic-ui`
- `npm run docs:web-inventory:check`
- `python3 scripts/validate_docs.py`
- `npm exec -w @memorag-mvp/web -- playwright test --config playwright.config.ts --list`
- `git diff --check`
- final-head `Web UI Quality`、`MemoRAG CI`、semver

## PR レビュー観点

- tag追加だけで state assertions 自体を弱めていないか。
- matrix の pass を history / admin より広く誤拡張していないか。
- automation evidence を manual evidence へ読み替えていないか。
- API authorization、RAG grounding、dataset 固有分岐へ差分がないか。

## リスク

- required Chromium の実行時間は4 test分増える。
- local browser binary がない場合は列挙までとし、実走は final-head GitHub Actions を必須証拠とする。
- owner 未決定の cross-browser / manual matrix は本タスクでは解消しない。

## 実施状況

- `E2E-UI-STATE-001` 4シナリオへ `@ui-quality` を付与した。
- required selector は既存19件から23件へ増え、4状態シナリオを列挙した。
- history / admin の `AC-SQ016-007` automated statusだけを `pass` とし、overall / manual は `blocked` を維持した。
- lint、Web typecheck、Web unit 443件、trace 13件、semantic 5件、manual evidence contract 7件、canonical docs / Web・infra generated docs / hidden Unicode checks は成功した。
- local Chromium executable は未導入のためローカル E2E 実走は未実施。代替せず、final-head GitHub Actionsで23件を実走して成功した。
- manual baseline は `pass: 0`、`blocked: 3`、`not_run: 1`、`ready: false` を維持した。
- [Web UI Quality 30409382853](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30409382853) は23/23成功、1.2分。artifact `8707828895`、digest `sha256:b8632180cb6a4cb042eaddc0cead25fb53a059317a4354f2a83e13553dc5ce79`。
- [MemoRAG CI 30409382852](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30409382852) と [semver 30409382881](https://github.com/tsuji-tomonori/rag-assist/actions/runs/30409382881) は成功した。
- PR #462 の受け入れ条件コメントとセルフレビューを head `c941e4fb` に同期した。
