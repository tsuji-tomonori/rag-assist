# DocumentGroup canonical path backfill apply

状態: todo
タスク種別: 機能追加

## 背景

PR #321 では既存データ向けに canonical fields と path lock item の dry-run / duplicate detection script が追加された。ただし、本番 DynamoDB table に実適用する apply migration は未実装であり、production deploy 前には duplicate report、lock item 作成、既存 item 更新を安全に実行する手順が必要になる。

## 目的

DocumentGroup の canonical path backfill を DynamoDB に適用する apply script / operation を用意し、duplicate 検出、dry-run、apply、検証、rollback 方針を整える。

## 対象範囲

- `scripts/document-group-canonical-path-backfill.mjs`
- 必要に応じた新規 migration script
- DynamoDB DocumentGroupsTable
- path lock item 作成
- reports / operations docs
- migration tests

## 含まない

- production への実行。
- duplicate の自動リネーム修正。

## 昇華メタ情報

- 優先度: P0 for production rollout。既存 table に canonical path を適用する前提 task。
- 依存関係: PR #321 dry-run script、DynamoDB table backup 方針、duplicate 解消運用。
- 推奨 PR 分割:
  - PR 1: dry-run report schema と duplicate report の固定。
  - PR 2: local fixture apply と idempotency tests。
  - PR 3: DynamoDB apply / verify command と operations docs。
- 成功指標: duplicate がない環境で group item と path lock item を再実行安全に作成できる。

## 実装設計メモ

- CLI は `--dry-run` default、`--apply` 明示必須にする。
- table name、region、profile、tenant scope は引数または env で受け、固定しない。
- apply 前に duplicate が 1 件でもあれば fail closed にする。
- apply 後は `AdminCanonicalPathIndex` query と lock item scan / query で verify する。

## 追加確認観点

- 途中失敗後の再実行で二重 lock item を作らない。
- schemaVersion 1 / 2 混在を扱える。
- report に skipped reason、duplicate group IDs、planned lock item IDs が出る。

## 未確定点

- rollback は backup restore 前提にするか、inverse patch を出力するか。
- GSI backfill 中の verify をどの状態まで許容するか。

## 実行計画

1. 既存 dry-run script の input / output / duplicate report を確認する。
2. apply mode の CLI option、対象 table、region、profile、tenant scope を設計する。
3. apply 前に duplicate が存在する場合は fail closed にする。
4. group item update と lock item create を transaction または idempotent batch で実装する。
5. apply 後の verification query を追加する。
6. rollback 方針を docs または script output に明記する。
7. local fixture と unit test を追加する。

## ドキュメント保守計画

- operation docs または script header に dry-run / apply / verify 手順を記載する。
- production 実行前に確認すべき IAM、backup、duplicate report、GSI backfill 状態を明記する。

## 受け入れ条件

- dry-run mode は既存どおり item を変更しない。
- apply mode は canonical fields がない既存 group item を更新できる。
- apply mode は対応する path lock item を作成できる。
- duplicate がある場合、自動修正せず apply を中断する。
- apply は再実行しても安全な idempotent behavior を持つ。
- apply 後に group item と lock item の整合を検証できる。
- 本番実行手順と未実行リスクが docs または report に残る。

## 検証計画

- `npm run test -w @memorag-mvp/api -- document-group`
- migration script fixture test
- dry-run sample command
- apply local fixture command
- `git diff --check`

## PR レビュー観点

- duplicate を自動 rename して仕様外 path を作らないこと。
- apply が途中失敗した場合の再実行安全性があること。
- AWS credentials / profile / table name を script 内に固定していないこと。

## リスク

- 既存 production data に duplicate がある場合、運用判断なしには apply できない。
- GSI 追加直後は DynamoDB 側の backfill 状態により query 検証タイミングを調整する必要がある。
