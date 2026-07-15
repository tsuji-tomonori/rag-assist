# PR #355 latest main / CI 収束レポート

## 受けた指示

CI 成功済みの PR #353 以降を順次確認し、安全に main へマージする。

## 要件整理と判断

- stacked PR #355 を PR #354 マージ後の latest main へ収束する。
- 旧 CI failure をログから分解し、trace/inventory 不整合と Web branch coverage 82.84% を未解決のまま扱う。
- test threshold を下げず、admin governance の boundary behavior を追加 test で検証する。
- visual 差分は自動更新せず、expected/actual/diff の目視で正当性を判断する。

## 実施作業・成果物

- `origin/main` を統合し、visual spec の benchmark locator と mobile snapshot は main 版を採用した。
- `tools/web-inventory/ui-traceability.json` から lifecycle 完了済み admin governance task を pending trace として除外し、generated Web inventory を更新した。
- `AdminPanels.test.tsx` を追加し、未提供、permission/failed、empty、zero、実データ、filter、pagination の分岐を検証した。
- `AdminWorkspace.test.tsx` に権限外 section 正規化、part failure data hide、domain filter 除去を追加した。
- admin visual baseline は、権限付き「用語展開」タブが実装と E2E fixture に正しく由来することを目視確認後、1枚だけ更新した。
- RCA/受け入れ条件は `tasks/do/20260715-2049-admin-governance-ci-convergence.md` に記録した。

## 検証結果

- Web full coverage: 53 files / 396 tests success。statements 90.73%、branches 85.15%、functions 90.86%、lines 93.60%。
- API full coverage: 779 tests success。statements/lines 90.34%、functions 92.82%、branches 80.38%（既存改善 task 管理値）。
- target admin tests: 2 files / 20 tests success。
- 全 workspace typecheck/build、root lint、semantic UI、Web trace/inventory、infra inventory、OpenAPI/API code freshness、canonical docs/hidden Unicode: success。
- Chromium 初回: smoke 15/15 success、admin visual 1件 failure。旧 baseline の用語展開タブ欠落を目視確認。
- baseline 更新後、更新なし再実行: admin visual + 全 smoke 16/16 success。
- `git diff --check`: success。
- build は既存 Vite chunk / infra bundle size warning のみ。

## Security / RAG / no-mock review

- admin route permission と static access-control policy、verified actor tenant、alias version/CAS/reason/audit contract を維持した。
- permission/failed part は旧成功 data を隠し、未提供・zero・利用不可を区別する test fixture のみを追加した。production demo fallback は追加していない。
- RAG 根拠生成は変更せず、benchmark 期待語句、QA sample 固有値、dataset 固有分岐を追加していない。

## 指示への fit 評価

総合 fit: 5.0 / 5.0。旧 CI failure を再現し、threshold 緩和ではなく boundary test と trace 正本修正で解消し、latest main の E2E/visual まで再検証した。

## 未対応・制約・リスク

- 実 screen reader、実機、200%/400% zoom、Firefox/WebKit は Issue #345 の横断 task に残る。
- alias multi-object atomicity、共通 audit/outbox、usage/cost evidence integrity は PR #356/#357 の後続 scope であり、本 PR で完了扱いにしない。
- GitHub Actions latest head は commit/push 後に確認する。
