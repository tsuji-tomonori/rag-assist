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

| コンポーネント | 説明 | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | DocumentWorkspace は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/DocumentWorkspace.tsx | DocumentWorkspace | DocumentConfirmDialog, DocumentDetailPanel, DocumentFilePanel, DocumentFolderTree, Icon, LoadingStatus, button, div, h2, header, nav, section, span, strong |
| DocumentConfirmDialog | DocumentConfirmDialog は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/workspace/DocumentConfirmDialog.tsx | DocumentConfirmDialog | ConfirmDialog |
| DocumentDetailPanel | DocumentDetailPanel は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx | DocumentDetailPanel | Icon, LoadingSpinner, UploadProgressPanel, aside, button, code, dd, div, dl, dt, form, h3, input, label, li, ol, option, p, section, select, small, span, strong, ul |
| DocumentFilePanel | DocumentFilePanel は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx | DocumentFilePanel | EmptyState, FileIcon, Icon, LoadingSpinner, ReindexMigrationStrip, article, button, div, footer, h3, section, span, strong |
| DocumentFolderTree | DocumentFolderTree は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx | DocumentFolderTree | Icon, aside, button, div, input, label, p, span, strong |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | button | 管理者設定へ戻る | 「管理者設定へ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:138 | confirmed |
| DocumentDetailPanel | button | 共有更新 | 「共有更新」を実行するボタン。 | 状態: disabled=!canWrite \|\| (!shareGroupId && !selectedGroupId) \|\| operationState.sharingGroupId !== null | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:107 | confirmed |
| DocumentDetailPanel | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| !uploadFile \|\| operationState.isUploading | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:149 | confirmed |
| DocumentDetailPanel | button | 新規フォルダ | 「新規フォルダ」を実行するボタン。 | 状態: disabled=!canWrite \|\| !groupName.trim() \|\| operationState.creatingGroup | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:162 | confirmed |
| DocumentFilePanel | button | このフォルダにアップロード / 保存先を選択してアップロード | 「このフォルダにアップロード / 保存先を選択してアップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:52 | confirmed |
| DocumentFilePanel | button | 共有設定を編集 | 「共有設定を編集」を実行するボタン。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onClick=() => shareSelectRef.current?.focus() | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:61 | confirmed |
| DocumentFilePanel | button | ファイルをアップロード | 「ファイルをアップロード」を実行するボタン。 | 状態: disabled=!canWrite \|\| !uploadGroupId | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:86 | confirmed |
| DocumentFilePanel | button | `${document.fileName}の再インデックスをステージング` | 「`${document.fileName}の再インデックスをステージング`」を実行するボタン。 | 状態: disabled=!canReindex \|\| operationState.stagingReindexDocumentId === document.documentId | onClick=() => onConfirmAction({ kind: "stage", document }) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:100 | confirmed |
| DocumentFilePanel | button | `${document.fileName}を削除` | 「`${document.fileName}を削除`」を実行するボタン。 | 状態: disabled=!canDelete \|\| operationState.deletingDocumentId === document.documentId | onClick=() => onConfirmAction({ kind: "delete", document }) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:109 | confirmed |
| ReindexMigrationStrip | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.cutoverMigrationId === migration.migrationId \|\| migration.status !== "stag… | onClick=() => onConfirmAction({ kind: "cutover", migration }) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:163 | unknown |
| ReindexMigrationStrip | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.rollbackMigrationId === migration.migrationId \|\| migration.status !== "cut… | onClick=() => onConfirmAction({ kind: "rollback", migration }) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:166 | unknown |
| DocumentFolderTree | button | フォルダ検索をクリア | 「フォルダ検索をクリア」を実行するボタン。 | 状態: disabled=!folderSearch | onClick=() => onFolderSearchChange("") | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:36 | confirmed |
| DocumentFolderTree | button | すべてのドキュメント | 「すべてのドキュメント」を実行するボタン。 | 状態: aria-current=selectedFolderId === "all" ? "true" : undefined | onClick=() => onSelectFolder("all", "") | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:41 | confirmed |
| DocumentFolderTree | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=selectedFolder.id === folder.id ? "true" : undefined | onClick=() => onSelectFolder(folder.id, folder.group?.groupId ?? "") | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:58 | unknown |

## フォーム

| コンポーネント | ラベル | フォーム説明 | 状態・補足 | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| DocumentDetailPanel | 共有フォルダ / 選択してください / 共有 Cognito group / 共有更新 | 「共有フォルダ / 選択してください / 共有 Cognito group / 共有更新」を入力・送信するフォーム。 | - | onSubmit=onShareSubmit | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:93 | confirmed |
| DocumentDetailPanel | 保存先フォルダ / 保存先を選択 / アップロード | 「保存先フォルダ / 保存先を選択 / アップロード」を入力・送信するフォーム。 | - | onSubmit=onUploadSubmit | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:133 | confirmed |
| DocumentDetailPanel | 新規フォルダ / 新規フォルダ | 「新規フォルダ / 新規フォルダ」を入力・送信するフォーム。 | - | onSubmit=onCreateGroupSubmit | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:157 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentDetailPanel | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => onShareGroupIdChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:96 | confirmed |
| DocumentDetailPanel | input | Cognito group をカンマ区切りで入力 | 「Cognito group をカンマ区切りで入力」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => onShareGroupsChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:105 | confirmed |
| DocumentDetailPanel | select | 保存先を選択 | 「保存先を選択」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.isUploading | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:136 | confirmed |
| DocumentDetailPanel | input | アップロードする文書を選択 | 「アップロードする文書を選択」を入力または選択する項目。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onChange=(event) => onUploadFileChange(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:146 | confirmed |
| DocumentDetailPanel | input | フォルダ名 | 「フォルダ名」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => onGroupNameChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:160 | confirmed |
| DocumentFolderTree | input | フォルダを検索 | 「フォルダを検索」を入力または選択する項目。 | - | onChange=(event) => onFolderSearchChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:28 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | button | 管理者設定へ戻る | 「管理者設定へ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:138 | confirmed |
| DocumentDetailPanel | form | 共有フォルダ / 選択してください / 共有 Cognito group / 共有更新 | 「共有フォルダ / 選択してください / 共有 Cognito group / 共有更新」を入力・送信するフォーム。 | - | onSubmit=onShareSubmit | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:93 | confirmed |
| DocumentDetailPanel | label | 共有フォルダ / 選択してください | 「共有フォルダ / 選択してください」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:94 | confirmed |
| DocumentDetailPanel | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => onShareGroupIdChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:96 | confirmed |
| DocumentDetailPanel | option | 選択してください | 「選択してください」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:97 | confirmed |
| DocumentDetailPanel | option | 共有フォルダ / 選択してください | 「共有フォルダ / 選択してください」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:99 | confirmed |
| DocumentDetailPanel | label | 共有 Cognito group | 「共有 Cognito group」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:103 | confirmed |
| DocumentDetailPanel | input | Cognito group をカンマ区切りで入力 | 「Cognito group をカンマ区切りで入力」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => onShareGroupsChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:105 | confirmed |
| DocumentDetailPanel | button | 共有更新 | 「共有更新」を実行するボタン。 | 状態: disabled=!canWrite \|\| (!shareGroupId && !selectedGroupId) \|\| operationState.sharingGroupId !== null | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:107 | confirmed |
| DocumentDetailPanel | form | 保存先フォルダ / 保存先を選択 / アップロード | 「保存先フォルダ / 保存先を選択 / アップロード」を入力・送信するフォーム。 | - | onSubmit=onUploadSubmit | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:133 | confirmed |
| DocumentDetailPanel | label | 保存先フォルダ / 保存先を選択 | 「保存先フォルダ / 保存先を選択」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:134 | confirmed |
| DocumentDetailPanel | select | 保存先を選択 | 「保存先を選択」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.isUploading | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:136 | confirmed |
| DocumentDetailPanel | option | 保存先を選択 | 「保存先を選択」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:137 | confirmed |
| DocumentDetailPanel | option | 保存先フォルダ / 保存先を選択 | 「保存先フォルダ / 保存先を選択」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:139 | confirmed |
| DocumentDetailPanel | label | 文書アップロード | 「文書アップロード」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:143 | confirmed |
| DocumentDetailPanel | input | アップロードする文書を選択 | 「アップロードする文書を選択」を入力または選択する項目。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onChange=(event) => onUploadFileChange(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:146 | confirmed |
| DocumentDetailPanel | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| !uploadFile \|\| operationState.isUploading | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:149 | confirmed |
| DocumentDetailPanel | form | 新規フォルダ / 新規フォルダ | 「新規フォルダ / 新規フォルダ」を入力・送信するフォーム。 | - | onSubmit=onCreateGroupSubmit | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:157 | confirmed |
| DocumentDetailPanel | label | 新規フォルダ | 「新規フォルダ」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:158 | confirmed |
| DocumentDetailPanel | input | フォルダ名 | 「フォルダ名」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => onGroupNameChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:160 | confirmed |
| DocumentDetailPanel | button | 新規フォルダ | 「新規フォルダ」を実行するボタン。 | 状態: disabled=!canWrite \|\| !groupName.trim() \|\| operationState.creatingGroup | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:162 | confirmed |
| DocumentFilePanel | button | このフォルダにアップロード / 保存先を選択してアップロード | 「このフォルダにアップロード / 保存先を選択してアップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:52 | confirmed |
| DocumentFilePanel | button | 共有設定を編集 | 「共有設定を編集」を実行するボタン。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onClick=() => shareSelectRef.current?.focus() | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:61 | confirmed |
| DocumentFilePanel | button | ファイルをアップロード | 「ファイルをアップロード」を実行するボタン。 | 状態: disabled=!canWrite \|\| !uploadGroupId | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:86 | confirmed |
| DocumentFilePanel | button | `${document.fileName}の再インデックスをステージング` | 「`${document.fileName}の再インデックスをステージング`」を実行するボタン。 | 状態: disabled=!canReindex \|\| operationState.stagingReindexDocumentId === document.documentId | onClick=() => onConfirmAction({ kind: "stage", document }) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:100 | confirmed |
| DocumentFilePanel | button | `${document.fileName}を削除` | 「`${document.fileName}を削除`」を実行するボタン。 | 状態: disabled=!canDelete \|\| operationState.deletingDocumentId === document.documentId | onClick=() => onConfirmAction({ kind: "delete", document }) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:109 | confirmed |
| ReindexMigrationStrip | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.cutoverMigrationId === migration.migrationId \|\| migration.status !== "stag… | onClick=() => onConfirmAction({ kind: "cutover", migration }) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:163 | unknown |
| ReindexMigrationStrip | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.rollbackMigrationId === migration.migrationId \|\| migration.status !== "cut… | onClick=() => onConfirmAction({ kind: "rollback", migration }) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:166 | unknown |
| DocumentFolderTree | label | フォルダを検索 | 「フォルダを検索」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:27 | confirmed |
| DocumentFolderTree | input | フォルダを検索 | 「フォルダを検索」を入力または選択する項目。 | - | onChange=(event) => onFolderSearchChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:28 | confirmed |
| DocumentFolderTree | button | フォルダ検索をクリア | 「フォルダ検索をクリア」を実行するボタン。 | 状態: disabled=!folderSearch | onClick=() => onFolderSearchChange("") | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:36 | confirmed |
| DocumentFolderTree | button | すべてのドキュメント | 「すべてのドキュメント」を実行するボタン。 | 状態: aria-current=selectedFolderId === "all" ? "true" : undefined | onClick=() => onSelectFolder("all", "") | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:41 | confirmed |
| DocumentFolderTree | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=selectedFolder.id === folder.id ? "true" : undefined | onClick=() => onSelectFolder(folder.id, folder.group?.groupId ?? "") | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:58 | unknown |
