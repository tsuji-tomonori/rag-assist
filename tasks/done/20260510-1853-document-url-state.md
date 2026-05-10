# ドキュメント管理 URL 状態同期

状態: done
タスク種別: 機能追加
作成日: 2026-05-10

## 背景

ドキュメント管理画面は client-state で表示状態を保持しており、特定フォルダ、検索条件、文書詳細を URL で共有できない。運用者同士で documentId やフォルダ単位の確認依頼を行う場合、画面状態を再現しにくい。

## 実施範囲

- ドキュメント管理画面を `?view=documents` で直接開けるようにする。
- フォルダ、文書詳細、文書検索、種別、状態、所属フォルダ、並び順を query parameter と同期する。
- ブラウザの戻る/進むで URL 由来の状態へ戻れるようにする。
- 既存の画面構成と権限境界を維持し、API 由来ではない架空データを表示しない。

## 受け入れ条件

- `?view=documents&group=<groupId>` でドキュメント管理が開き、対象フォルダが選択状態になる。
- `?view=documents&document=<documentId>` で対象文書が存在する場合に詳細 drawer が開く。
- 文書検索・フィルタ・ソート・選択文書の変更が URL query に反映される。
- ブラウザ戻る/進むで URL query のドキュメント管理状態が UI に反映される。
- ドキュメント管理権限がないユーザーでは従来どおり chat に戻される。
- 関連する React hook / UI テストが通る。

## 検証予定

- `npm --prefix memorag-bedrock-mvp/apps/web test -- DocumentWorkspace useAppShellState`
- 必要に応じて追加の targeted test を実行する。

## 完了時の検証

- `npm ci`: pass
- `npm --prefix memorag-bedrock-mvp/apps/web test -- App`: pass
- `npm --prefix memorag-bedrock-mvp/apps/web test -- DocumentWorkspace useAppShellState App`: pass
- `npm --prefix memorag-bedrock-mvp/apps/web test -- DocumentWorkspace useAppShellState`: pass
- `npm --prefix memorag-bedrock-mvp/apps/web run typecheck`: pass
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- `git diff --check`: pass

## 競合解消

- PR mergeability 回復のため `origin/main` を merge。
- `DocumentWorkspace` は main 側の小コンポーネント分割構造を採用し、URL 状態同期 props / effects / selectedDocumentId 管理を再適用。
- `useAppShellState` は main 側の `buildDocumentRouteProps` 構成を採用し、`urlState` / `onUrlStateChange` を追加。

## PR コメント

- 受け入れ条件確認コメントを PR #253 に追加済み。
- セルフレビューコメントを PR #253 に追加済み。

## リスク

- 現行アプリは full router を持たないため、今回の deep link は query parameter ベースに限定する。
- URL に存在しない groupId / documentId が指定された場合は、実データが存在しないため既定表示または drawer 非表示に留める。
