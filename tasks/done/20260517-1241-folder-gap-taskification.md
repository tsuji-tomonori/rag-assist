# フォルダ残課題の task 化

状態: done
タスク種別: ドキュメント更新

## 背景

`folder canonical path / GSI 一意性` は PR #321 で merge 済みになった。一方で、フォルダ機能全体としては rename / move UI、削除、共有継承、backfill apply、tenant 実装などの残課題がある。

## 目的

マージ済みの canonical path 実装を前提に、残っているフォルダ周辺の実装漏れを独立した後続 task として `tasks/todo/` に登録する。

## スコープ

- フォルダ rename / move UI
- root への移動
- フォルダ削除または archive
- 既存文書のフォルダ移動
- 共有継承ポリシー
- group 管理者 root folder 作成 UI
- canonical path backfill apply
- 大規模 subtree move の非同期化
- GSI query 活用
- ParentFolderIndex
- フォルダ操作 audit
- tenantId の実 tenant 化

## 含まない

- 上記 task の実装。
- API / Web / infra の挙動変更。
- PR #321 の再修正。

## 計画

1. merge 済みの folder canonical path task と現行 task 書式を確認する。
2. 残課題を独立して実装・検証できる粒度に分割する。
3. 各 task に背景、目的、対象範囲、受け入れ条件、検証計画、PR レビュー観点、リスクを記載する。
4. `git diff --check` で Markdown 差分の基本チェックを行う。
5. 作業完了レポートを残す。

## ドキュメント保守計画

- 今回は実装計画の task 化のみで、README、OpenAPI、infra docs、Web inventory は変更しない。
- 後続 task の実装時に、それぞれ API schema / Web inventory / infra inventory / docs の更新要否を判断する。

## 受け入れ条件

- [x] 残っているフォルダ周辺の実装漏れが `tasks/todo/` に task 化されている。
- [x] 各 task に受け入れ条件と検証計画が明記されている。
- [x] canonical path 実装済み範囲と重複しないよう、後続 task の境界が明記されている。
- [x] 作業完了レポートが `reports/working/` に作成されている。
- [x] `git diff --check` が通る。

## 検証計画

- `git diff --check`
- 追加した task file の目視確認

## PR レビュー観点

- task が大きすぎず、後続 PR に分割できる粒度になっていること。
- 実装済みの canonical path / path lock / AdminCanonicalPathIndex を未実装扱いしていないこと。
- 未実装・一部実装・スケール改善を混同していないこと。

## リスク

- 静的確認ベースの task 化であり、後続実装時に追加の gap が見つかる可能性がある。
- 既存仕様には folder / document / audit / tenant が横断しているため、後続 task 間の依存関係を実装時に再確認する必要がある。
