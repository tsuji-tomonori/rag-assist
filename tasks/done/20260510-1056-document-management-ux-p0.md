# ドキュメント管理 UI/UX P0 改善

状態: done

## 背景

ドキュメント管理画面では、アップロード、document group、共有、blue-green reindex 操作が 1 画面に集約されている。特に、保存先フォルダの誤認、長時間 ingest の進捗不透明さ、削除や reindex 操作の安全性、グローバル loading による操作対象の分かりにくさが P0 課題として挙げられている。

## 目的

`DocumentWorkspace` と関連 hook を中心に、運用者が安全に文書登録・削除・reindex 操作を行える UI に改善する。

## スコープ

- アップロード先フォルダの明示と `すべてのドキュメント` 選択時の誤アップロード防止
- 操作単位 loading の導入
- アップロード・取り込み進捗の段階表示
- 削除、reindex stage、cutover、rollback の確認ダイアログ導入
- 空状態 CTA の改善
- 関連テストと必要な docs / レポート更新

## 実装計画

1. `DocumentWorkspace` と `useDocuments` の props/state/API 呼び出しを確認する。
2. task / acceptance criteria を維持しながら、保存先・loading・confirm・進捗表示を実装する。
3. 既存テストを更新し、P0 挙動の回帰テストを追加する。
4. 変更範囲に応じた web test/typecheck と `git diff --check` を実行する。
5. 作業レポート、commit、PR、受け入れ条件コメント、セルフレビューコメントを作成する。

## ドキュメント保守計画

- 画面操作や UI 方針を説明する既存 docs があるか `rg` で確認する。
- durable docs に該当する記載があれば、保存先明示・進捗表示・確認ダイアログの挙動を同期する。
- 該当 docs がなければ、作業レポートと PR 本文に更新不要理由を記載する。

## 受け入れ条件

- [x] `すべてのドキュメント` 表示へ戻ると、アップロード先フォルダが未選択になり、以前のフォルダへ無自覚にアップロードできない。
- [x] アップロード UI に保存先フォルダが明示され、未選択時は保存先選択を促す表示になる。
- [x] アップロード中に準備、ファイル転送、ingest run 作成、ingest polling、完了または失敗が段階表示される。
- [x] 削除、reindex stage、cutover、rollback の前に対象と影響範囲を示す専用確認ダイアログが表示される。
- [x] 行単位操作では対象行または対象 migration のみ loading / disabled になり、画面全体が不要に停止しない。
- [x] ドキュメントなし、グループなし、保存先未選択の空状態で次の操作が分かる CTA が表示される。
- [x] 本番 UI に架空フォルダ、架空文書、固定ユーザー、固定件数などの mock fallback を追加しない。

## 完了メモ

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/231
- 受け入れ条件確認コメント: 投稿済み
- 作業レポート: `reports/working/20260510-1107-document-management-ux-p0.md`
- 検証:
  - `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- DocumentWorkspace useDocuments`: pass
  - `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
  - `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`: pass
  - `git diff --check`: pass

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- DocumentWorkspace useDocuments`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `git diff --check`

## PR レビュー観点

- docs と実装の同期要否
- 変更範囲に見合う web テスト
- RAG の根拠性・認可境界を弱めていないこと
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐を実装へ入れていないこと
- 本番 UI に mock fallback を入れていないこと

## リスク

- API から詳細 ingest stage が得られない場合、UI の stage は client flow と run status に基づく表示になる。
- 長時間 polling の実時間完了までは unit test で疑似的に検証する。
