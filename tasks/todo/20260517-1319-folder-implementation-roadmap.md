# フォルダ後続実装ロードマップ

状態: todo
タスク種別: ドキュメント更新

## 背景

フォルダ canonical path / GSI 一意性の土台は実装済みだが、UI 操作、削除、文書移動、共有継承、移行、スケール、監査、tenant 境界の task が並列に残っている。個別 task を実装する前に、依存関係と推奨順を整理して手戻りを減らす必要がある。

## 目的

フォルダ周辺 task の着手順、依存関係、リスク、PR 分割方針をまとめ、後続実装を段階的に進められるようにする。

## 推奨フェーズ

| Phase | 対象 task | 目的 | 主な依存 |
|---:|---|---|---|
| 1 | `folder-rename-move-ui`, `folder-move-to-root` | 既存 backend の rename / move 能力を UI から使えるようにする | PR #321 |
| 2 | `document-move-between-folders` | upload 後の分類変更を可能にする | Phase 1 の folder selector 整備 |
| 3 | `folder-delete-archive`, `folder-operation-audit` | 危険操作と証跡を安全に扱う | Phase 1、audit schema 方針 |
| 4 | `folder-sharing-inheritance-policy` | folder 階層の ACL 仕様を固める | Phase 1、audit 方針 |
| 5 | `group-admin-root-folder-ui`, `tenant-scoped-document-groups` | namespace と tenant 境界を本格化する | group / tenant source の確定 |
| 6 | `document-group-backfill-apply`, `document-group-gsi-query-adoption` | production migration と lookup scale を整える | PR #321 deploy 方針 |
| 7 | `parent-folder-index`, `large-subtree-move-async` | 大規模 folder tree に耐える query / mutation へ拡張する | Phase 6、運用要件 |

## 横断設計原則

- GSI は lookup / listing 用で、一意性保証は path lock item + transaction で維持する。
- UI は API が返す canonical path を表示し、client 側で架空 path を補完しない。
- folder mutation は ACL / RAG scope / upload destination / selected folder / audit の整合を同時に確認する。
- delete / move / sharing / tenant strict 化は fail closed を基本にする。
- production migration は dry-run、duplicate report、backup、apply、verify、rollback 方針を分ける。
- 大規模 subtree 操作は DynamoDB transaction 25 item 制限を前提に、同期処理と async job の境界を明確にする。

## 着手前チェックリスト

- 対象 task の `依存関係` が満たされている。
- API schema / Web type / OpenAPI / Web inventory / infra inventory の更新要否が判断されている。
- ACL / RAG scope / upload scope の退行テストが選定されている。
- migration / deploy / GSI 追加を伴う場合、production 実行ではなく PR 内の実装と検証に限定している。
- UI では本番経路に架空 group / user / folder 候補を出さない。

## 受け入れ条件

- 各 folder todo task の推奨着手順が分かる。
- 各 phase の目的と依存が明記されている。
- ACL / RAG scope / tenant / migration / GSI の横断原則が明記されている。
- 後続 task の PR 本文で参照できる。

## 検証計画

- `git diff --check`
- 後続 task でこのロードマップを参照し、実装順の前提が崩れた場合は更新する。

## 未確定点

- group / tenant source をどの API / claim から取得するか。
- folder delete は empty-only delete、archive、recursive delete のどれを初回仕様にするか。
- sharing inheritance の default を legacy preserving にするか、明示 migration を要求するか。
