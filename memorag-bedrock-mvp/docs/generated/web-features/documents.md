# Web 機能詳細: ドキュメント

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## 概要

ドキュメント upload、document group、共有、blue-green reindex 操作を扱う領域です。

## 関連画面

| 表示名 | view | 画面コンポーネント | 権限条件 | 説明 |
| --- | --- | --- | --- | --- |
| ドキュメント | documents | DocumentWorkspace | canManageDocuments | ドキュメント。ファイル upload、フォルダ作成、共有、reindex 切替を行います。 |

## コンポーネント

| コンポーネント | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- |
| DocumentWorkspace | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/DocumentWorkspace.tsx | DocumentWorkspace | FileIcon, Icon, LoadingSpinner, LoadingStatus, article, aside, button, dd, details, div, dl, dt, footer, form, h2, h3, header, input, label, li, nav, option, progress, section, select, small, span, strong, summary, ul |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | button | 管理者設定へ戻る | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:128 | confirmed |
| DocumentWorkspace | button | フォルダを絞り込み | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:154 | confirmed |
| DocumentWorkspace | button | すべてのドキュメント | onClick=() => setSelectedFolderId("all") | apps/web/src/features/documents/components/DocumentWorkspace.tsx:159 | confirmed |
| DocumentWorkspace | button | 社内規定 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:165 | confirmed |
| DocumentWorkspace | button | 未推定 | onClick=() => { setSelectedFolderId(folder.id) if (folder.group) onUploadGroupChange(folder.group… | apps/web/src/features/documents/components/DocumentWorkspace.tsx:172 | unknown |
| DocumentWorkspace | button | 新規フォルダ | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:202 | confirmed |
| DocumentWorkspace | button | 共有設定 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:205 | confirmed |
| DocumentWorkspace | button | `${document.fileName}の再インデックスをステージング` | onClick=() => void onStageReindex(document.documentId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:250 | confirmed |
| DocumentWorkspace | button | 名前を変更 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:261 | confirmed |
| DocumentWorkspace | button | 移動 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:265 | confirmed |
| DocumentWorkspace | button | `${document.fileName}を削除` | onClick=() => onDelete(document.documentId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:269 | confirmed |
| DocumentWorkspace | button | 前のページ | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:290 | confirmed |
| DocumentWorkspace | button | 次のページ | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:294 | confirmed |
| DocumentWorkspace | button | 切替 | onClick=() => void onCutoverReindex(migration.migrationId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:310 | confirmed |
| DocumentWorkspace | button | 戻す | onClick=() => void onRollbackReindex(migration.migrationId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:311 | confirmed |
| DocumentWorkspace | button | 共有を編集 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:347 | confirmed |
| DocumentWorkspace | button | 共有更新 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:363 | confirmed |
| DocumentWorkspace | button | アップロード | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:393 | confirmed |
| DocumentWorkspace | button | 新規フォルダ | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:403 | confirmed |
| DocumentWorkspace | button | すべて表示 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:410 | confirmed |

## フォーム

| コンポーネント | ラベル | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- |
| DocumentWorkspace | 共有フォルダ / 選択してください / 共有 Cognito group / 共有更新 | onSubmit=onShareSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:349 | confirmed |
| DocumentWorkspace | 保存先フォルダ / フォルダなし / アップロード | onSubmit=onSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:378 | confirmed |
| DocumentWorkspace | 新規フォルダ / 新規フォルダ | onSubmit=onCreateGroupSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:398 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | input | フォルダを検索 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:152 | confirmed |
| DocumentWorkspace | input | `${document.fileName}を選択` | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:228 | confirmed |
| DocumentWorkspace | input | `${document.fileName}を再インデックス対象にする` | onChange=(event) => { if (event.target.checked) void onStageReindex(document.documentId) } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:239 | confirmed |
| DocumentWorkspace | select | 表示件数 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:298 | confirmed |
| DocumentWorkspace | select | shareGroupId \|\| selectedGroupId | onChange=(event) => setShareGroupId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:352 | confirmed |
| DocumentWorkspace | input | CHAT_USER,RAG_GROUP | onChange=(event) => setShareGroups(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:361 | confirmed |
| DocumentWorkspace | select | uploadGroupId | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:381 | confirmed |
| DocumentWorkspace | input | 未推定 | onChange=(event) => setUploadFile(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:391 | unknown |
| DocumentWorkspace | input | 2026 | onChange=(event) => setGroupName(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:401 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | button | 管理者設定へ戻る | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:128 | confirmed |
| DocumentWorkspace | label | フォルダを検索 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:150 | confirmed |
| DocumentWorkspace | input | フォルダを検索 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:152 | confirmed |
| DocumentWorkspace | button | フォルダを絞り込み | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:154 | confirmed |
| DocumentWorkspace | button | すべてのドキュメント | onClick=() => setSelectedFolderId("all") | apps/web/src/features/documents/components/DocumentWorkspace.tsx:159 | confirmed |
| DocumentWorkspace | button | 社内規定 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:165 | confirmed |
| DocumentWorkspace | button | 未推定 | onClick=() => { setSelectedFolderId(folder.id) if (folder.group) onUploadGroupChange(folder.group… | apps/web/src/features/documents/components/DocumentWorkspace.tsx:172 | unknown |
| DocumentWorkspace | button | 新規フォルダ | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:202 | confirmed |
| DocumentWorkspace | button | 共有設定 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:205 | confirmed |
| DocumentWorkspace | input | `${document.fileName}を選択` | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:228 | confirmed |
| DocumentWorkspace | input | `${document.fileName}を再インデックス対象にする` | onChange=(event) => { if (event.target.checked) void onStageReindex(document.documentId) } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:239 | confirmed |
| DocumentWorkspace | button | `${document.fileName}の再インデックスをステージング` | onClick=() => void onStageReindex(document.documentId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:250 | confirmed |
| DocumentWorkspace | button | 名前を変更 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:261 | confirmed |
| DocumentWorkspace | button | 移動 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:265 | confirmed |
| DocumentWorkspace | button | `${document.fileName}を削除` | onClick=() => onDelete(document.documentId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:269 | confirmed |
| DocumentWorkspace | button | 前のページ | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:290 | confirmed |
| DocumentWorkspace | button | 次のページ | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:294 | confirmed |
| DocumentWorkspace | select | 表示件数 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:298 | confirmed |
| DocumentWorkspace | option | 20 件/ページ | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:299 | confirmed |
| DocumentWorkspace | option | 50 件/ページ | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:300 | confirmed |
| DocumentWorkspace | button | 切替 | onClick=() => void onCutoverReindex(migration.migrationId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:310 | confirmed |
| DocumentWorkspace | button | 戻す | onClick=() => void onRollbackReindex(migration.migrationId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:311 | confirmed |
| DocumentWorkspace | button | 共有を編集 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:347 | confirmed |
| DocumentWorkspace | form | 共有フォルダ / 選択してください / 共有 Cognito group / 共有更新 | onSubmit=onShareSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:349 | confirmed |
| DocumentWorkspace | label | 共有フォルダ / 選択してください | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:350 | confirmed |
| DocumentWorkspace | select | shareGroupId \|\| selectedGroupId | onChange=(event) => setShareGroupId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:352 | confirmed |
| DocumentWorkspace | option | 選択してください | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:353 | confirmed |
| DocumentWorkspace | option | group.groupId | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:355 | confirmed |
| DocumentWorkspace | label | 共有 Cognito group | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:359 | confirmed |
| DocumentWorkspace | input | CHAT_USER,RAG_GROUP | onChange=(event) => setShareGroups(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:361 | confirmed |
| DocumentWorkspace | button | 共有更新 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:363 | confirmed |
| DocumentWorkspace | form | 保存先フォルダ / フォルダなし / アップロード | onSubmit=onSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:378 | confirmed |
| DocumentWorkspace | label | 保存先フォルダ / フォルダなし | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:379 | confirmed |
| DocumentWorkspace | select | uploadGroupId | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:381 | confirmed |
| DocumentWorkspace | option | フォルダなし | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:382 | confirmed |
| DocumentWorkspace | option | group.groupId | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:384 | confirmed |
| DocumentWorkspace | label | 文書アップロード | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:388 | confirmed |
| DocumentWorkspace | input | 未推定 | onChange=(event) => setUploadFile(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:391 | unknown |
| DocumentWorkspace | button | アップロード | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:393 | confirmed |
| DocumentWorkspace | form | 新規フォルダ / 新規フォルダ | onSubmit=onCreateGroupSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:398 | confirmed |
| DocumentWorkspace | label | 新規フォルダ | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:399 | confirmed |
| DocumentWorkspace | input | 2026 | onChange=(event) => setGroupName(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:401 | confirmed |
| DocumentWorkspace | button | 新規フォルダ | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:403 | confirmed |
| DocumentWorkspace | button | すべて表示 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:410 | confirmed |
