# フォルダ作成モーダルと権限分離の修正

- 状態: in_progress
- タスク種別: 修正
- ブランチ: `codex/folder-modal-fix`
- 作業 worktree: `.worktrees/folder-modal-fix`

## 背景

ユーザー提供の改善パッチ `rag-assist-folder-modal-fix.patch` は、フォルダ作成と文書アップロードが UI と権限判定で混同されている問題を直す目的で作成された。ただし、パッチファイルは `git apply --check` で `corrupt patch at line 27` となり、そのまま適用できない。

## なぜなぜ分析の要約

- confirmed: 現行 UI の文書管理画面では、ファイル一覧側の `+` ボタンが `uploadInputRef.current?.click()` を呼び、文書アップロード操作になっている。
- confirmed: アップロード可能判定は `canWrite && Boolean(uploadGroupId)` に依存し、保存先未選択時は操作できない。
- confirmed: API 側のフォルダ作成権限は `rag:group:create`、グループ管理者割当は `rag:group:assign_manager` として型に存在するが、Web 側の文書管理操作では `canWriteDocuments` が広く使われている。
- inferred: フォルダ作成・共有設定・文書アップロードの操作モデルが UI 上で分離されていないため、フォルダ作成権限だけを持つユーザーの導線が閉じる。
- root cause: 文書アップロードの `rag:doc:write:group` とフォルダ管理の `rag:group:create` / `rag:group:assign_manager` が Web UI の権限モデルと操作導線で独立して扱われていない。
- remediation: `usePermissions` と `useDocuments` でフォルダ作成・共有権限を明示し、`DocumentWorkspace` でフォルダ作成とアップロード導線を分け、設定パネルを必要時だけ開くモーダルへ変更する。

## スコープ

- 対象: `apps/web/src/app/hooks/`, `apps/web/src/features/documents/`, `apps/web/src/styles/features/documents.css`, 関連テスト。
- 対象外: API 権限仕様の変更、永続データ構造の変更、GitHub Actions や infra の変更。

## 受け入れ条件

- [ ] `rag:group:create` が `canCreateDocumentGroups` として UI に伝播し、フォルダ作成のガードに使われる。
- [ ] `rag:group:assign_manager` が `canShareDocumentGroups` として UI に伝播し、共有・フォルダ設定更新のガードに使われる。
- [ ] 文書一覧の `+` はフォルダ作成モーダルを開き、アップロードは独立したボタンから実行できる。
- [ ] 選択中フォルダでフォルダ作成を開いた場合、そのフォルダが親候補として初期設定される。
- [ ] 右側の常設設定パネルをやめ、設定は必要時だけモーダルで開閉できる。
- [ ] 本番 UI に固定の架空データや未実装操作を追加しない。
- [ ] 変更範囲に見合う Web テスト・型チェック・差分チェックを実行し、未実施があれば理由を記録する。
- [ ] 作業完了レポートを `reports/working/` に作成する。

## 実装計画

1. パッチの意図と現行コードの差分を照合する。
2. 権限 hook と document hook にフォルダ作成・共有権限を追加する。
3. `DocumentWorkspace` と子コンポーネントでフォルダ作成、アップロード、設定モーダルを分離する。
4. CSS とテストを更新する。
5. `git diff --check`、Web の targeted test/typecheck を実行する。
6. 作業レポート、commit、push、PR 作成、受け入れ条件コメント、セルフレビューコメントを実施する。

## ドキュメント保守方針

ユーザー可視の UI 挙動が変わるため、関連する永続ドキュメントを検索する。該当する操作仕様ドキュメントがあれば更新し、見つからない場合は作業レポートと PR 本文で理由を記録する。

## 検証計画

- `git diff --check`
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace`
- `npm run test -w @memorag-mvp/web -- useDocuments`
- `npm run typecheck -w @memorag-mvp/web`

## PR レビュー観点

- docs と実装の同期。
- 変更範囲に見合うテスト。
- RAG の根拠性・認可境界を弱めていないこと。
- benchmark 期待語句・QA sample 固有値・dataset 固有分岐を実装へ入れていないこと。

## リスク

- 提供パッチが直接適用できないため、手動適用時に意図との差分が出る可能性がある。
- モーダル化で既存テストのアクセシブル名や DOM 構造が変わるため、テスト更新が必要になる。
