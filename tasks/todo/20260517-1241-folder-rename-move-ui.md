# フォルダ rename / move UI

状態: todo
タスク種別: 機能追加

## 背景

PR #321 で backend は `ShareDocumentGroupRequestSchema` を通じて `name` と `parentGroupId` を受け取り、rename / move 相当の更新と canonical path 再計算を行えるようになった。一方、Web UI の共有更新導線は `visibility` と `sharedGroups` が中心で、利用者がフォルダ名変更や移動を実行する画面操作が不足している。

## 目的

フォルダ一覧または詳細操作から、既存フォルダの名前変更、説明更新、親フォルダ変更を実行できる UI を追加し、backend の canonical path / 重複拒否 / 子孫再計算を製品導線から使えるようにする。

## 対象範囲

- `apps/web/src/features/documents/components/workspace/DocumentWorkspace.tsx`
- `apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx`
- `apps/web/src/features/documents/hooks/useDocuments.ts`
- `apps/web/src/features/documents/api/documentsApi.ts`
- 関連 Web tests と Web inventory
- 必要に応じて API route 名または update endpoint の整理

## 含まない

- canonical path / path lock の backend 再実装。
- root への移動。これは `20260517-1241-folder-move-to-root.md` で扱う。
- フォルダ削除。これは `20260517-1241-folder-delete-archive.md` で扱う。

## 実行計画

1. 既存 folder 操作 UI、共有 modal、folder tree の state 管理を確認する。
2. rename / description update / move を同一操作にするか、操作を分けるかを設計する。
3. `useDocuments` の update input type を API schema と同期し、`name`、`description`、`parentGroupId`、`managerUserIds`、`sharedUserIds` の扱いを明確化する。
4. フォルダ操作 UI に rename / move form を追加する。
5. 同名 path conflict や move 制約の API error を利用者に正直に表示する。
6. 本番 UI に架空 folder / user / group 候補を出さない。
7. Web tests と Web inventory を更新する。

## ドキュメント保守計画

- Web inventory を更新する。
- API endpoint の名前や schema を変更する場合は OpenAPI docs を更新する。
- route 名を `/share` のまま使う場合は、PR 本文で rename / move も同 endpoint に載せる理由と後続整理方針を明記する。

## 受け入れ条件

- 既存フォルダの名前を Web UI から変更できる。
- 既存フォルダの説明を Web UI から変更できる。
- 既存フォルダの親フォルダを Web UI から変更できる。
- move / rename 後に folder tree、selected folder、upload destination の表示が矛盾しない。
- canonical path 重複時の API error が UI 上で分かる形で表示される。
- 自分自身または子孫配下への移動を UI または API error 表示で防げる。
- 既存の共有設定、文書一覧、RAG 検索範囲、upload scope が退行しない。

## 検証計画

- `npm run test -w @memorag-mvp/web -- DocumentWorkspace useDocuments`
- `npm run typecheck -w @memorag-mvp/web`
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`
- `npm run docs:web-inventory:check`
- `git diff --check`

## PR レビュー観点

- rename / move payload が API schema と同期していること。
- API が返す補完済み canonical path を UI がそのまま表示し、架空 fallback path を作っていないこと。
- 操作後の selected folder と upload destination が stale ID / stale path にならないこと。

## リスク

- 現在の `/share` endpoint は共有更新以外の責務も持つため、UI 実装時に命名と責務の分離を再検討する必要がある。
