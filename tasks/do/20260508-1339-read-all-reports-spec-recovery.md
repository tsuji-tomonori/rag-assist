# 全作業レポート本文精読による仕様復元

状態: do

## 背景

PR #189 の追加対応では、作業/障害レポートをファイル単位で全量分類したが、391 件すべての本文精読までは未実施だった。ユーザーから、本文精読から分類まで一気通貫で行うよう指示があった。

## 目的

`reports/working/*.md` と `reports/bugs/*.md` の本文を全件確認し、個別 `RPT-*` ID、本文ベース分類、仕様化対象/対象外理由、抽出先 task/fact/requirement まで trace できるようにする。

## スコープ

- 既存作業/障害レポート 391 件の本文精読
- 作業中に追加済みの直近レポート 1 件も process evidence として分類
- 個別 `RPT-*` ID 採番
- `docs/spec-recovery/12_report_reading_inventory.md` の作成
- `docs/spec-recovery/` 既存成果物への反映
- validator、Markdown/pre-commit 検証
- 作業レポート、commit、push、PR コメント、task done 更新

## Done 条件

- [ ] 本文確認対象の report 件数と対象範囲が明記されている。
- [ ] 各 report に `RPT-*` ID、分類、仕様化対象/対象外、対象外理由、関連 task が記録されている。
- [ ] commit/PR/merge 操作のみの report は task 化せず、理由を残している。
- [ ] 本文精読後の分類結果を `00_input_inventory.md`、`11_report_coverage.md`、`12_report_reading_inventory.md` に反映している。
- [ ] 本文精読により見つかった追加事実、task、AC、E2E/非 UI 検証、REQ/SPEC、gap/open question を更新している。
- [ ] `GAP-012` / `GAP-013` を本文精読後の状態へ更新している。
- [ ] `scripts/validate_spec_recovery.py docs/spec-recovery`、`git diff --check`、対象ファイル pre-commit が通る。
- [ ] 作業完了レポートを `reports/working/` に保存する。
- [ ] PR に日本語で本文精読完了コメントとセルフレビューを投稿する。

## 検証計画

- `python3 scripts/validate_spec_recovery.py docs/spec-recovery`
- `git diff --check`
- `pre-commit run --files <changed-files>`
