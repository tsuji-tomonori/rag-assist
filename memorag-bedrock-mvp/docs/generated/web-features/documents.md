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
| DocumentWorkspace | DocumentWorkspace は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/DocumentWorkspace.tsx | DocumentWorkspace | ConfirmDialog, FileIcon, Icon, LoadingSpinner, LoadingStatus, UploadProgressPanel, article, aside, button, code, dd, div, dl, dt, footer, form, h2, h3, header, input, label, li, nav, ol, option, p, section, select, small, span, strong, ul |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | button | 管理者設定へ戻る | 「管理者設定へ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:146 | confirmed |
| DocumentWorkspace | button | フォルダ検索をクリア | 「フォルダ検索をクリア」を実行するボタン。 | 状態: disabled=!folderSearch | onClick=() => setFolderSearch("") | apps/web/src/features/documents/components/DocumentWorkspace.tsx:175 | confirmed |
| DocumentWorkspace | button | すべてのドキュメント | 「すべてのドキュメント」を実行するボタン。 | 状態: aria-current=selectedFolderId === "all" ? "true" : undefined | onClick=() => { setSelectedFolderId("all") onUploadGroupChange("") } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:180 | confirmed |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=selectedFolder?.id === folder.id ? "true" : undefined | onClick=() => { setSelectedFolderId(folder.id) if (folder.group) onUploadGroupChange(folder.group… | apps/web/src/features/documents/components/DocumentWorkspace.tsx:200 | unknown |
| DocumentWorkspace | button | このフォルダにアップロード / 保存先を選択してアップロード | 「このフォルダにアップロード / 保存先を選択してアップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/DocumentWorkspace.tsx:232 | confirmed |
| DocumentWorkspace | button | 共有設定を編集 | 「共有設定を編集」を実行するボタン。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onClick=() => shareSelectRef.current?.focus() | apps/web/src/features/documents/components/DocumentWorkspace.tsx:241 | confirmed |
| DocumentWorkspace | button | ファイルをアップロード | 「ファイルをアップロード」を実行するボタン。 | 状態: disabled=!canWrite \|\| !uploadGroupId | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/DocumentWorkspace.tsx:266 | confirmed |
| DocumentWorkspace | button | `${document.fileName}の再インデックスをステージング` | 「`${document.fileName}の再インデックスをステージング`」を実行するボタン。 | 状態: disabled=!canReindex \|\| operationState.stagingReindexDocumentId === document.documentId | onClick=() => setConfirmAction({ kind: "stage", document }) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:282 | confirmed |
| DocumentWorkspace | button | `${document.fileName}を削除` | 「`${document.fileName}を削除`」を実行するボタン。 | 状態: disabled=!canDelete \|\| operationState.deletingDocumentId === document.documentId | onClick=() => setConfirmAction({ kind: "delete", document }) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:291 | confirmed |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.cutoverMigrationId === migration.migrationId \|\| migration.status !== "stag… | onClick=() => setConfirmAction({ kind: "cutover", migration }) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:317 | unknown |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.rollbackMigrationId === migration.migrationId \|\| migration.status !== "cut… | onClick=() => setConfirmAction({ kind: "rollback", migration }) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:320 | unknown |
| DocumentWorkspace | button | 共有更新 | 「共有更新」を実行するボタン。 | 状態: disabled=!canWrite \|\| (!shareGroupId && !selectedGroupId) \|\| operationState.sharingGroupId !== null | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:369 | confirmed |
| DocumentWorkspace | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| !uploadFile \|\| operationState.isUploading | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:411 | confirmed |
| DocumentWorkspace | button | 新規フォルダ | 「新規フォルダ」を実行するボタン。 | 状態: disabled=!canWrite \|\| !groupName.trim() \|\| operationState.creatingGroup | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:424 | confirmed |
| ConfirmDialog | button | キャンセル | 「キャンセル」を実行するボタン。 | - | onClick=onCancel | apps/web/src/features/documents/components/DocumentWorkspace.tsx:544 | confirmed |
| ConfirmDialog | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | onClick=onConfirm | apps/web/src/features/documents/components/DocumentWorkspace.tsx:545 | unknown |

## フォーム

| コンポーネント | ラベル | フォーム説明 | 状態・補足 | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | 共有フォルダ / 選択してください / 共有 Cognito group / 共有更新 | 「共有フォルダ / 選択してください / 共有 Cognito group / 共有更新」を入力・送信するフォーム。 | - | onSubmit=onShareSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:355 | confirmed |
| DocumentWorkspace | 保存先フォルダ / 保存先を選択 / アップロード | 「保存先フォルダ / 保存先を選択 / アップロード」を入力・送信するフォーム。 | - | onSubmit=onSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:395 | confirmed |
| DocumentWorkspace | 新規フォルダ / 新規フォルダ | 「新規フォルダ / 新規フォルダ」を入力・送信するフォーム。 | - | onSubmit=onCreateGroupSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:419 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | input | フォルダを検索 | 「フォルダを検索」を入力または選択する項目。 | - | onChange=(event) => setFolderSearch(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:167 | confirmed |
| DocumentWorkspace | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => setShareGroupId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:358 | confirmed |
| DocumentWorkspace | input | Cognito group をカンマ区切りで入力 | 「Cognito group をカンマ区切りで入力」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => setShareGroups(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:367 | confirmed |
| DocumentWorkspace | select | 保存先を選択 | 「保存先を選択」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.isUploading | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:398 | confirmed |
| DocumentWorkspace | input | アップロードする文書を選択 | 「アップロードする文書を選択」を入力または選択する項目。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onChange=(event) => setUploadFile(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:408 | confirmed |
| DocumentWorkspace | input | フォルダ名 | 「フォルダ名」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => setGroupName(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:422 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | button | 管理者設定へ戻る | 「管理者設定へ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:146 | confirmed |
| DocumentWorkspace | label | フォルダを検索 | 「フォルダを検索」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:166 | confirmed |
| DocumentWorkspace | input | フォルダを検索 | 「フォルダを検索」を入力または選択する項目。 | - | onChange=(event) => setFolderSearch(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:167 | confirmed |
| DocumentWorkspace | button | フォルダ検索をクリア | 「フォルダ検索をクリア」を実行するボタン。 | 状態: disabled=!folderSearch | onClick=() => setFolderSearch("") | apps/web/src/features/documents/components/DocumentWorkspace.tsx:175 | confirmed |
| DocumentWorkspace | button | すべてのドキュメント | 「すべてのドキュメント」を実行するボタン。 | 状態: aria-current=selectedFolderId === "all" ? "true" : undefined | onClick=() => { setSelectedFolderId("all") onUploadGroupChange("") } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:180 | confirmed |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=selectedFolder?.id === folder.id ? "true" : undefined | onClick=() => { setSelectedFolderId(folder.id) if (folder.group) onUploadGroupChange(folder.group… | apps/web/src/features/documents/components/DocumentWorkspace.tsx:200 | unknown |
| DocumentWorkspace | button | このフォルダにアップロード / 保存先を選択してアップロード | 「このフォルダにアップロード / 保存先を選択してアップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/DocumentWorkspace.tsx:232 | confirmed |
| DocumentWorkspace | button | 共有設定を編集 | 「共有設定を編集」を実行するボタン。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onClick=() => shareSelectRef.current?.focus() | apps/web/src/features/documents/components/DocumentWorkspace.tsx:241 | confirmed |
| DocumentWorkspace | button | ファイルをアップロード | 「ファイルをアップロード」を実行するボタン。 | 状態: disabled=!canWrite \|\| !uploadGroupId | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/DocumentWorkspace.tsx:266 | confirmed |
| DocumentWorkspace | button | `${document.fileName}の再インデックスをステージング` | 「`${document.fileName}の再インデックスをステージング`」を実行するボタン。 | 状態: disabled=!canReindex \|\| operationState.stagingReindexDocumentId === document.documentId | onClick=() => setConfirmAction({ kind: "stage", document }) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:282 | confirmed |
| DocumentWorkspace | button | `${document.fileName}を削除` | 「`${document.fileName}を削除`」を実行するボタン。 | 状態: disabled=!canDelete \|\| operationState.deletingDocumentId === document.documentId | onClick=() => setConfirmAction({ kind: "delete", document }) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:291 | confirmed |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.cutoverMigrationId === migration.migrationId \|\| migration.status !== "stag… | onClick=() => setConfirmAction({ kind: "cutover", migration }) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:317 | unknown |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.rollbackMigrationId === migration.migrationId \|\| migration.status !== "cut… | onClick=() => setConfirmAction({ kind: "rollback", migration }) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:320 | unknown |
| DocumentWorkspace | form | 共有フォルダ / 選択してください / 共有 Cognito group / 共有更新 | 「共有フォルダ / 選択してください / 共有 Cognito group / 共有更新」を入力・送信するフォーム。 | - | onSubmit=onShareSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:355 | confirmed |
| DocumentWorkspace | label | 共有フォルダ / 選択してください | 「共有フォルダ / 選択してください」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:356 | confirmed |
| DocumentWorkspace | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => setShareGroupId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:358 | confirmed |
| DocumentWorkspace | option | 選択してください | 「選択してください」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:359 | confirmed |
| DocumentWorkspace | option | 共有フォルダ / 選択してください | 「共有フォルダ / 選択してください」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:361 | confirmed |
| DocumentWorkspace | label | 共有 Cognito group | 「共有 Cognito group」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:365 | confirmed |
| DocumentWorkspace | input | Cognito group をカンマ区切りで入力 | 「Cognito group をカンマ区切りで入力」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => setShareGroups(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:367 | confirmed |
| DocumentWorkspace | button | 共有更新 | 「共有更新」を実行するボタン。 | 状態: disabled=!canWrite \|\| (!shareGroupId && !selectedGroupId) \|\| operationState.sharingGroupId !== null | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:369 | confirmed |
| DocumentWorkspace | form | 保存先フォルダ / 保存先を選択 / アップロード | 「保存先フォルダ / 保存先を選択 / アップロード」を入力・送信するフォーム。 | - | onSubmit=onSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:395 | confirmed |
| DocumentWorkspace | label | 保存先フォルダ / 保存先を選択 | 「保存先フォルダ / 保存先を選択」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:396 | confirmed |
| DocumentWorkspace | select | 保存先を選択 | 「保存先を選択」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.isUploading | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:398 | confirmed |
| DocumentWorkspace | option | 保存先を選択 | 「保存先を選択」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:399 | confirmed |
| DocumentWorkspace | option | 保存先フォルダ / 保存先を選択 | 「保存先フォルダ / 保存先を選択」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:401 | confirmed |
| DocumentWorkspace | label | 文書アップロード | 「文書アップロード」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:405 | confirmed |
| DocumentWorkspace | input | アップロードする文書を選択 | 「アップロードする文書を選択」を入力または選択する項目。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onChange=(event) => setUploadFile(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:408 | confirmed |
| DocumentWorkspace | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| !uploadFile \|\| operationState.isUploading | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:411 | confirmed |
| DocumentWorkspace | form | 新規フォルダ / 新規フォルダ | 「新規フォルダ / 新規フォルダ」を入力・送信するフォーム。 | - | onSubmit=onCreateGroupSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:419 | confirmed |
| DocumentWorkspace | label | 新規フォルダ | 「新規フォルダ」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:420 | confirmed |
| DocumentWorkspace | input | フォルダ名 | 「フォルダ名」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => setGroupName(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:422 | confirmed |
| DocumentWorkspace | button | 新規フォルダ | 「新規フォルダ」を実行するボタン。 | 状態: disabled=!canWrite \|\| !groupName.trim() \|\| operationState.creatingGroup | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:424 | confirmed |
| ConfirmDialog | button | キャンセル | 「キャンセル」を実行するボタン。 | - | onClick=onCancel | apps/web/src/features/documents/components/DocumentWorkspace.tsx:544 | confirmed |
| ConfirmDialog | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | onClick=onConfirm | apps/web/src/features/documents/components/DocumentWorkspace.tsx:545 | unknown |
