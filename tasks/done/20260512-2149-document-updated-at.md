# 文書更新日時表示とソート修正

## 状態

done

## 背景

直近レビューで、`DocumentFilePanel` の列名は「更新日」だが表示値が `createdAt` であり、`updatedDesc` / `updatedAsc` も `createdAt` を比較していると指摘された。運用者が文書の更新・共有変更・reindex の時系列を誤認するため、表示とソートの根拠を修正する。

## 目的

文書一覧の「更新日」表示と「更新日」ソートが、実データに存在する更新日時を優先して使うようにする。更新日時が存在しない文書では正直な fallback として作成日時を使い、UI とテストで挙動を固定する。

## タスク種別

修正

## 軽量なぜなぜ分析

### 問題文

文書一覧で「更新日」と表示される列と `updatedAsc` / `updatedDesc` ソートが、実際には `createdAt` を基準にしており、更新順の情報として誤解される。

### 確認済み事実

- レビュー指摘では `DocumentFilePanel` の「更新日」表示が `formatDateTime(document.createdAt)` とされている。
- `documentWorkspaceUtils.compareDocuments` の `updatedAsc` / `updatedDesc` が `createdAt` を比較している。
- 文書 manifest には `metadata.updatedAt` が使われている箇所があり、最近の操作イベントでは `metadataString(document, "updatedAt") ?? document.createdAt` を使っている。

### 推定原因

- 一覧表示とソートが作成日時を暫定的に使ったまま、列名・sort key だけが更新日として扱われている。
- 更新日時の抽出ロジックが共通化されておらず、箇所ごとに fallback 判断が分散している。

### 根本原因

- 文書 manifest の「一覧で使う更新日時」を表す単一の helper / contract がなく、UI 表示とソートが同じ根拠を参照していない。

### 対策方針

- 文書一覧用の更新日時 helper を追加する。
- 表示、ソート、最近の操作イベントを同じ helper に寄せる。
- `metadata.updatedAt` がある場合はそれを優先し、ない場合は `createdAt` に fallback する。
- テストで表示順と表示値を固定する。

## スコープ

- 対象: 文書管理 UI の一覧表示、ソート utility、関連テスト、必要な generated docs。
- 対象外: backend manifest schema 変更、server-side pagination/search/sort、実ブラウザ visual regression。

## 実装計画

1. `DocumentManifest` 型と現在の表示箇所を確認する。
2. 更新日時 helper を `documentWorkspaceUtils` に追加する。
3. `DocumentFilePanel` の更新日表示と `compareDocuments` を helper 利用へ変更する。
4. 関連テストを追加・更新する。
5. targeted test/typecheck/inventory check を実行する。

## ドキュメントメンテナンス計画

- UI 挙動が変わるため web inventory generated docs の差分有無を確認する。
- durable docs は、API/運用手順の変更がなければ更新不要とする。
- 作業レポートを `reports/working/` に残す。

## 受け入れ条件

- 「更新日」列が `metadata.updatedAt` を優先して表示する。
- `metadata.updatedAt` がない場合は `createdAt` へ fallback する。
- `updatedDesc` / `updatedAsc` が表示と同じ更新日時根拠で並び替える。
- 既存の文書一覧検索・ページング・共有安全化の挙動を壊さない。
- 関連 tests、web typecheck、web inventory check、`git diff --check` が pass する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- DocumentWorkspace documentWorkspaceUtils`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`
- `git diff --check`

## PR レビュー観点

- 表示とソートが同じ日時 helper を参照しているか。
- fallback が架空値ではなく実データ由来か。
- 既存の `updatedDesc` default sort の見え方が期待どおりか。

## リスク

- backend manifest に top-level `updatedAt` が追加済みの場合、型未反映の可能性がある。確認して必要なら helper 側で安全に扱う。
- generated docs の更新が必要になる可能性がある。
