# 管理 UI governance を latest main の CI gate へ収束する

状態: do

タスク種別: CI 修復 / stacked PR 収束

## 背景

PR #355 の旧 CI run `29378658521` は Web trace/inventory の task path 不整合と Web branch coverage 82.84%（閾値85%未達）で失敗した。その後、stacked base PR #354 は main へマージされたため、latest main へ収束して失敗を再評価する必要がある。

## なぜなぜ分析

- trace の直接原因: task lifecycle で `tasks/do/20260714-1011-admin-ui-governance-quality.md` を `tasks/done/` へ移した後も、`tools/web-inventory/ui-traceability.json` が do path を参照した。view は後続 task により `partial` のため、completed task は done path へ置換せず pending trace から除外する必要があった。
- trace の流出原因: lifecycle commit 後に `docs:web-inventory:check` を最終 head で再実行せず、生成済み inventory も stale path を保持した。
- coverage の直接原因: admin governance の分岐追加量に対して branch test が不足し、global 85% gate を下回った。
- coverage の根本原因候補: URL/runtime decoder/operation state の failure・boundary 分岐を実装した一方、受け入れ test が主要 journey 中心で、分岐網羅を最終 CI gate で確認できていなかった。latest main 収束後の coverage report で対象を確定する。

## 受け入れ条件

- [x] latest `origin/main` を競合解消して統合する。PR base の `main` 変更は push 後に実施する。
- [x] traceability source から lifecycle 完了 task を除外し、generated Web inventory と check が同期する。
- [x] Web full coverage が全 test 成功かつ branch 85%以上になる。
- [x] API full coverage、lint、typecheck、build、docs check、変更範囲の Chromium E2E/visual が成功する。
- [x] admin route permission、tenant/actor/CAS/audit、RAG 根拠性、no-mock、benchmark/dataset 固有分岐なしを再確認する。
- [ ] PR 本文・受け入れコメント・セルフレビュー・CI 証跡を更新し、task を done 化する。

## ドキュメントメンテナンス計画

`tools/web-inventory/ui-traceability.json` を正本として修正し、提供済み generator で generated Web inventory を更新する。製品要件が変わらない場合、canonical REQ/DES の追加変更は行わない。

## 未決事項・リスク

- 実 screen reader、実機、200%/400% zoom、Firefox/WebKit は既存横断 task の対象であり、この CI 修復で実施済み扱いにしない。

## 実施結果

- PR #354 の final main を統合し、visual spec は main の flexible benchmark locator、mobile snapshot は main の検証済み baseline を採用した。
- trace source の lifecycle 完了 task 参照を除外し、generated Web inventory を再生成した。
- admin の未提供・permission/failed・zero・空・実データ・filter/pagination と section 正規化を追加 test で網羅し、Web branch coverage を 82.84% から 85.15% へ回復した。
- 管理 visual の初回差分は、権限付き「用語展開」タブを旧 baseline が欠いていたことを目視確認した。baseline 1枚を更新し、更新なし再実行で Chromium 16/16 が成功した。
- 検証詳細は `reports/working/20260715-2108-admin-governance-ci-convergence.md` に記録した。
