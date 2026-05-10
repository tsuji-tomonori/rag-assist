# DebugPanel の権限制御

## 背景

`DebugPanel` は RAG 実行 trace、検索根拠、support verification、step detail を扱うため、権限を持つ利用者のみ表示できる必要がある。権限を持たない利用者には非表示にし、内部 debug 情報を UI 上に出さない。

## 目的

Web UI で `DebugPanel` を権限付き表示にし、権限なしユーザーでは DOM 上にも表示されないようにする。

## スコープ

- Web UI の permission model と `DebugPanel` 表示制御
- 関連テスト
- 必要な生成 UI docs 更新
- 作業完了レポート

## スコープ外

- API route / RBAC policy の変更
- debug trace API の返却 schema 変更
- 権限体系そのものの新設

## 作業計画

1. 既存 permission model と `ChatView` / `DebugPanel` の呼び出し経路を確認する。
2. debug panel を表示できる既存 permission を選定する。
3. 権限ありの場合のみ `DebugPanel` を render する。
4. 権限あり/なしのテストを追加または更新する。
5. 変更範囲に見合う検証を実行する。
6. 作業レポート、commit、push、PR、PR コメントまで進める。

## ドキュメント保守方針

ユーザー可視 UI の権限表示が変わるため、生成済み Web UI インベントリが差分を出す場合は更新する。API や手書き要求・運用 docs は変更が必要か確認し、不要な場合は作業レポートと PR 本文に理由を記録する。

## 受け入れ条件

- [x] debug 表示権限を持つユーザーでは `DebugPanel` が表示される。
- [x] debug 表示権限を持たないユーザーでは `DebugPanel` が表示されない。
- [x] 権限なしユーザーに debug trace、retrieved full text、内部 metadata を UI 表示しない。
- [x] 権限制御に fake user / fake role / hard-coded fallback を追加しない。
- [x] 対象挙動をテストまたは同等の検証で確認する。
- [x] API route や server-side RBAC を変更しない場合、その理由を記録する。

## 検証計画

- 対象 Web UI テスト
- Web typecheck
- 必要に応じて Web UI インベントリ生成・check
- `git diff --check`

## PR レビュー観点

- 権限なしユーザーに debug panel が DOM 上も表示されないこと。
- 既存 permission 名の意味が debug 情報表示に合っていること。
- API の認可境界を弱めていないこと。
- no-mock product UI ルールに反していないこと。

## リスク

- 既存テストが debug panel 常時表示を前提にしている場合、権限付き fixture への更新が必要になる。
- 既存 permission 名の選択を誤ると過剰表示または過小表示になる。

## 状態

in_progress
