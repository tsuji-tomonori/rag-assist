# フォルダ共有継承ポリシー

状態: todo
タスク種別: 機能追加

## 背景

現行の document group ACL は各 group の `visibility`、`sharedUserIds`、`sharedGroups`、`managerUserIds` を直接見る形が中心で、親フォルダの共有設定を子に継承するモデルや、明示的に継承を止める policy が未整理である。階層フォルダを利用するには、共有範囲の継承ルールがないと運用ミスが起きやすい。

## 目的

フォルダ階層における共有継承、明示 override、継承停止、manager 継承のルールを定義し、API / RAG scope / Web 表示に反映する。

## 対象範囲

- `DocumentGroup` ACL model
- `canAccessDocumentGroup` / `canManageDocumentGroup` 相当の権限判定
- document list / RAG retrieval scope
- folder create / update schema
- Web folder tree / sharing UI
- API / Web tests、OpenAPI docs、Web inventory

## 含まない

- cross-tenant sharing。
- 外部 IdP group の実在検証。

## 昇華メタ情報

- 優先度: P1.5。認可境界に直結するため、delete / audit 以降に慎重に入れる。
- 依存関係: folder tree canonical path、現行 ACL、RAG retrieval scope、document list ACL。
- 推奨 PR 分割:
  - PR 1: inheritance model の型 / schema / legacy compatibility。
  - PR 2: effective ACL 計算と API tests。
  - PR 3: Web 表示と sharing UI。
- 成功指標: stored ACL と effective ACL が区別され、RAG scope が effective ACL を使う。

## 実装設計メモ

- legacy group は現行挙動を維持する default にする。
- `inherit` / `override` / `private override` など、状態を明示する field を検討する。
- effective ACL は parent chain を辿るため cycle guard と depth guard を持つ。
- UI では inherited value と explicit value をラベルで区別する。

## 追加確認観点

- 親共有を追加したときに子 document の検索可否が期待通り変わる。
- 子で private override した場合、親共有が漏れない。
- manager 権限の継承有無がテストで固定されている。

## 未確定点

- manager 権限も継承するか、read sharing だけ継承するか。
- legacy group の default を inherit にするか explicit にするか。

## 実行計画

1. 仕様上の共有継承要件を確認する。
2. 継承 model を `inherit` / `override` / `private override` などの明示状態で設計する。
3. legacy group の後方互換補完ルールを定義する。
4. access check と RAG scope が effective ACL を使うようにする。
5. Web UI で effective sharing と explicit override を区別して表示する。
6. ACL と検索範囲の回帰テストを追加する。

## ドキュメント保守計画

- ACL model 変更に伴い durable docs を更新する。
- API schema 変更がある場合は OpenAPI docs を更新する。
- Web inventory を更新する。

## 受け入れ条件

- 子 folder が親 folder の共有設定を継承するかどうかを明示できる。
- effective ACL と stored ACL の違いが service 層で定義されている。
- RAG 検索範囲は effective ACL を使い、親共有を過不足なく反映する。
- 継承停止または override による private 化ができる。
- manager 権限の継承有無が仕様化され、テストで固定される。
- legacy group の既存 ACL が意図せず広がらない。

## 検証計画

- `npm run test -w @memorag-mvp/api -- access-control document-group`
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace DocumentFolderTree`
- `npm run typecheck --workspaces --if-present`
- `npm run docs:openapi:check`
- `git diff --check`

## PR レビュー観点

- 親共有の継承により、従来 private だった document が意図せず検索可能にならないこと。
- effective ACL の計算が folder tree の深さや cycle guard と整合すること。
- UI が inherited / explicit を混同しないこと。

## リスク

- 共有継承は認可境界に直結するため、実装前に仕様と migration 方針を明確にする必要がある。
