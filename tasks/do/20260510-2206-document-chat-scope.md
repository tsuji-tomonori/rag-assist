# 文書詳細からこの資料に質問する導線

状態: doing
タスク種別: 機能追加
作成日: 2026-05-10

## 背景

ドキュメント管理 UI はアップロード進捗、詳細 drawer、URL 状態同期、pagination まで改善済み。一方、アップロード完了後や文書詳細確認後に「この資料を対象にチャットで質問する」導線がまだ弱く、運用者が documentId を見ながらチャットへ移動しても対象文書スコープが維持されない。

## 目的

- 文書詳細 drawer からチャットへ移動し、次の質問を対象 documentId に限定できるようにする。
- チャット composer に対象文書スコープを明示し、解除できるようにする。
- 既存の group scope / temporary attachment scope と矛盾しない searchScope を送る。
- 本番 UI に架空文書や fake scope を表示しない。

## スコープ

- 対象: `DocumentWorkspace`、`DocumentDetailDrawer`、`useAppShellState`、`useChatSession`、`ChatView`、`ChatComposer`、関連 tests / generated web inventory。
- API 変更は行わず、既存 `SearchScope.documentIds` を利用する。
- 文書対象 scope は次回以降の質問にも残る明示状態とし、ユーザーが composer から解除できるようにする。

## 実装計画

1. 既存の chat searchScope 生成と document detail drawer の操作を確認する。
2. shell state に選択文書 scope を追加し、document drawer の CTA から `activeView=chat` へ移動する。
3. `useChatSession` で document scope を searchScope に含める。
4. `ChatComposer` に対象文書名の chip と解除ボタンを追加する。
5. 関連テストを追加・更新し、generated web inventory を更新する。
6. 最小十分な検証を実行し、PR 作成、受け入れ条件コメント、セルフレビューまで進める。

## ドキュメント保守計画

- UI controls が増えるため `npm --prefix memorag-bedrock-mvp run docs:web-inventory` を実行する。
- API / 運用 docs は挙動変更が既存 API 型の利用に閉じるため、恒久 docs 更新は不要と判断する場合は作業レポートに記録する。

## 受け入れ条件

- [ ] 文書詳細 drawer に「この資料に質問する」ボタンが表示される。
- [ ] ボタン押下でチャット画面へ移動し、対象文書名が composer に表示される。
- [ ] 対象文書 scope がある状態で質問すると `searchScope.mode=documents` と `documentIds=[documentId]` が送信される。
- [ ] composer から対象文書 scope を解除できる。
- [ ] 対象文書が一覧から消えた場合、fake 文書名を表示せず scope を解除する。
- [ ] group scope / attachment scope の既存動作を壊さない。
- [ ] 対象テスト、web typecheck、web inventory check、`git diff --check` が通る。

## 検証計画

- `npm --prefix memorag-bedrock-mvp/apps/web test -- DocumentWorkspace ChatComposer useChatSession useAppShellState`
- `npm --prefix memorag-bedrock-mvp/apps/web run typecheck`
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`
- `git diff --check`

## 完了時の検証

- `npm --prefix memorag-bedrock-mvp/apps/web test -- DocumentWorkspace ChatView useChatSession`: fail（依存未展開で `vitest` が見つからず） -> `npm ci` 後 pass
- `npm --prefix memorag-bedrock-mvp/apps/web run typecheck`: fail（依存未展開で `tsc` が見つからず） -> `npm ci` 後 pass
- `npm ci`: pass
- `npm --prefix memorag-bedrock-mvp/apps/web test -- DocumentWorkspace ChatView useChatSession useAppShellState`: pass
- `npm --prefix memorag-bedrock-mvp/apps/web run typecheck`: pass
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`: pass
- `npm exec --prefix memorag-bedrock-mvp -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: pass
- `git diff --check`: pass

## PR レビュー観点

- documentId scope が実在する `documents` 配列からのみ表示されること。
- searchScope の優先順位が document > group > temporary attachment で明確なこと。
- 対象文書解除ボタンに accessible name があること。
- API / 認可 / RAG backend の境界を変更していないこと。

## リスク

- backend が `SearchScope.documentIds` を既存仕様どおり扱う前提。Web 側では既存型に従う。
- document scope は URL query には含めない。チャット中の一時スコープとして扱う。
