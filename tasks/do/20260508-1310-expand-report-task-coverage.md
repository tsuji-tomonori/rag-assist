# 作業レポート全量棚卸しによる task coverage 拡張

状態: do

## 背景

PR #189 の初版仕様復元では、代表的な作業レポートと既存 docs/tests から task 10 件を抽出した。ユーザー指摘どおり、`reports/working/` と `reports/bugs/` の件数に対して task 数が少なく、全量棚卸しとの差分が不明瞭だった。

## 目的

作業レポート全量をファイル単位で棚卸しし、commit/PR/merge 操作のみのレポートを無理に task 化しない前提で、仕様化対象の report category と追加 task family を `docs/spec-recovery/` に反映する。

## スコープ

- `reports/working/*.md` と `reports/bugs/*.md` の全量ファイル分類
- 仕様化対象カテゴリと対象外カテゴリの明示
- `docs/spec-recovery/` の facts/tasks/AC/E2E/REQ/SPEC/trace/gap/open question 更新
- validator と Markdown/pre-commit 検証
- PR コメント、作業レポート、commit/push

## 受け入れ条件

- [ ] `00_input_inventory.md` に全量レポート棚卸し件数と分類方針が記録されている。
- [ ] commit/PR/merge 操作のみのレポートを task 化対象外として明示している。
- [ ] 機能・挙動・品質・運用に関係するレポートカテゴリから追加 task family が抽出されている。
- [ ] 追加 task に対応する受け入れ条件、E2E または非 UI 検証、要件/仕様、trace が追加されている。
- [ ] `GAP-001` と `Q-010` が初版代表抽出のまま放置されず、全量棚卸し後の残課題へ更新されている。
- [ ] `scripts/validate_spec_recovery.py docs/spec-recovery`、`git diff --check`、対象ファイル pre-commit が通る。
- [ ] 作業完了レポートを `reports/working/` に保存する。
- [ ] PR に日本語で追加セルフレビュー/補足コメントを投稿する。

## 検証計画

- `python3 scripts/validate_spec_recovery.py docs/spec-recovery`
- `git diff --check`
- `pre-commit run --files <changed-files>`
