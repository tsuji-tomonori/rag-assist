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
| DocumentWorkspace | DocumentWorkspace は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/DocumentWorkspace.tsx | DocumentWorkspace | DocumentConfirmDialog, DocumentDetailDrawer, DocumentDetailPanel, DocumentFilePanel, DocumentFolderTree, Icon, LoadingStatus, button, div, h2, header, nav, section, span, strong |
| DocumentConfirmDialog | DocumentConfirmDialog は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/workspace/DocumentConfirmDialog.tsx | DocumentConfirmDialog | ConfirmDialog |
| DocumentDetailDrawer | DocumentDetailDrawer は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx | DocumentDetailDrawer | DetailRow, Icon, aside, button, dd, div, dl, dt, h3, header, span |
| DocumentDetailPanel | DocumentDetailPanel は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx | DocumentDetailPanel | Icon, LoadingSpinner, UploadProgressPanel, aside, button, code, dd, div, dl, dt, form, h3, input, label, li, ol, option, p, section, select, small, span, strong, textarea, ul |
| DocumentFilePanel | DocumentFilePanel は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx | DocumentFilePanel | EmptyState, FileIcon, Icon, LoadingSpinner, ReindexMigrationStrip, article, button, div, footer, h3, input, label, option, section, select, span, strong |
| DocumentFolderTree | DocumentFolderTree は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx | DocumentFolderTree | Icon, aside, button, div, input, label, p, span, strong |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | button | 管理者設定へ戻る | 「管理者設定へ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:305 | confirmed |
| DocumentDetailDrawer | button | 文書詳細を閉じる | 「文書詳細を閉じる」を実行するボタン。 | - | onClick=onClose | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:53 | confirmed |
| DocumentDetailDrawer | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | onClick=onCopyDocumentId | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:78 | unknown |
| DocumentDetailDrawer | button | 再インデックス | 「再インデックス」を実行するボタン。 | 状態: disabled=!canReindex | onClick=onStageReindex | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:82 | confirmed |
| DocumentDetailDrawer | button | 削除 | 「削除」を実行するボタン。 | 状態: disabled=!canDelete | onClick=onDelete | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:86 | confirmed |
| DocumentDetailPanel | button | 共有更新 | 「共有更新」を実行するボタン。 | 状態: disabled=!canWrite \|\| !shareTargetGroupId \|\| shareHasValidationError \|\| operationState.sharingGrou… | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:173 | confirmed |
| DocumentDetailPanel | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| !uploadFile \|\| operationState.isUploading | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:215 | confirmed |
| DocumentDetailPanel | button | 新規フォルダ | 「新規フォルダ」を実行するボタン。 | 状態: disabled=!canWrite \|\| !groupName.trim() \|\| createHasValidationError \|\| operationState.creatingGroup | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:289 | confirmed |
| DocumentFilePanel | button | このフォルダにアップロード / 保存先を選択してアップロード | 「このフォルダにアップロード / 保存先を選択してアップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:92 | confirmed |
| DocumentFilePanel | button | 共有設定を編集 | 「共有設定を編集」を実行するボタン。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onClick=() => shareSelectRef.current?.focus() | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:101 | confirmed |
| DocumentFilePanel | button | ファイルをアップロード | 「ファイルをアップロード」を実行するボタン。 | 状態: disabled=!canWrite \|\| !uploadGroupId | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:172 | confirmed |
| DocumentFilePanel | button | `${document.fileName}の再インデックスをステージング` | 「`${document.fileName}の再インデックスをステージング`」を実行するボタン。 | 状態: disabled=!canReindex \|\| operationState.stagingReindexDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() onConfirmAction({ kind: "stage", document }) } | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:208 | confirmed |
| DocumentFilePanel | button | `${document.fileName}を削除` | 「`${document.fileName}を削除`」を実行するボタン。 | 状態: disabled=!canDelete \|\| operationState.deletingDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() onConfirmAction({ kind: "delete", document }) } | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:220 | confirmed |
| ReindexMigrationStrip | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.cutoverMigrationId === migration.migrationId \|\| migration.status !== "stag… | onClick=() => onConfirmAction({ kind: "cutover", migration }) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:282 | unknown |
| ReindexMigrationStrip | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.rollbackMigrationId === migration.migrationId \|\| migration.status !== "cut… | onClick=() => onConfirmAction({ kind: "rollback", migration }) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:285 | unknown |
| DocumentFolderTree | button | フォルダ検索をクリア | 「フォルダ検索をクリア」を実行するボタン。 | 状態: disabled=!folderSearch | onClick=() => onFolderSearchChange("") | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:36 | confirmed |
| DocumentFolderTree | button | すべてのドキュメント | 「すべてのドキュメント」を実行するボタン。 | 状態: aria-current=selectedFolderId === "all" ? "true" : undefined | onClick=() => onSelectFolder("all", "") | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:41 | confirmed |
| DocumentFolderTree | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=selectedFolder.id === folder.id ? "true" : undefined | onClick=() => onSelectFolder(folder.id, folder.group?.groupId ?? "") | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:58 | unknown |

## フォーム

| コンポーネント | ラベル | フォーム説明 | 状態・補足 | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| DocumentDetailPanel | 共有フォルダ / 選択してください / 共有 Cognito group / 追加: / 削除: / 変更なし: / 共有更新 | 「共有フォルダ / 選択してください / 共有 Cognito group / 追加: / 削除: / 変更なし: / 共有更新」を入力・送信するフォーム。 | - | onSubmit=onShareSubmit | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:142 | confirmed |
| DocumentDetailPanel | 保存先フォルダ / 保存先を選択 / アップロード | 「保存先フォルダ / 保存先を選択 / アップロード」を入力・送信するフォーム。 | - | onSubmit=onUploadSubmit | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:199 | confirmed |
| DocumentDetailPanel | 新規フォルダ名 / 説明 / 親フォルダ / 親フォルダなし / 公開範囲 / 非公開 / 指定 group 共有 / 組織全体 / 初期 shared groups / 管理者 user IDs … | 「新規フォルダ名 / 説明 / 親フォルダ / 親フォルダなし / 公開範囲 / 非公開 / 指定 group 共有 / 組織全体 / 初期 shared groups / 管理者 user IDs …」を入力・送信するフォーム。 | - | onSubmit=onCreateGroupSubmit | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:223 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentDetailPanel | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => onShareGroupIdChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:145 | confirmed |
| DocumentDetailPanel | input | Cognito group をカンマ区切りで入力 | 「Cognito group をカンマ区切りで入力」を入力または選択する項目。 | 説明参照: share-groups-validation share-groups-diff<br>状態: aria-invalid=shareHasValidationError \|\| undefined, disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => onShareGroupsChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:154 | confirmed |
| DocumentDetailPanel | select | 保存先を選択 | 「保存先を選択」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.isUploading | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:202 | confirmed |
| DocumentDetailPanel | input | アップロードする文書を選択 | 「アップロードする文書を選択」を入力または選択する項目。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onChange=(event) => onUploadFileChange(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:212 | confirmed |
| DocumentDetailPanel | input | フォルダ名 | 「フォルダ名」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => onGroupNameChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:226 | confirmed |
| DocumentDetailPanel | textarea | フォルダの用途や対象資料 | 「フォルダの用途や対象資料」を複数行で入力する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => onGroupDescriptionChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:230 | confirmed |
| DocumentDetailPanel | select | 親フォルダなし | 「親フォルダなし」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => onGroupParentIdChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:234 | confirmed |
| DocumentDetailPanel | select | 非公開 / 指定 group 共有 / 組織全体 | 「非公開 / 指定 group 共有 / 組織全体」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => onGroupVisibilityChange(event.target.value as "private" \| "shared" \| "org") | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:243 | confirmed |
| DocumentDetailPanel | input | Cognito group をカンマ区切りで入力 | 「Cognito group をカンマ区切りで入力」を入力または選択する項目。 | 説明参照: create-group-validation create-group-preview<br>状態: aria-invalid=(validatesCreateSharedGroups && (createSharedDraft.hasEmptyToken \|\| createSharedDraft.dup…, disabled=!canWrite \|\| operationState.creatingGroup \|\| groupVisibility !== "shared" | onChange=(event) => onGroupSharedGroupsChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:251 | confirmed |
| DocumentDetailPanel | input | User ID をカンマ区切りで入力 | 「User ID をカンマ区切りで入力」を入力または選択する項目。 | 説明参照: create-group-validation create-group-preview<br>状態: aria-invalid=(createManagerDraft.hasEmptyToken \|\| createManagerDraft.duplicates.length > 0) \|\| undefin…, disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => onGroupManagerUserIdsChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:262 | confirmed |
| DocumentDetailPanel | input | 作成後にこのフォルダへ移動 | 「作成後にこのフォルダへ移動」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => onMoveToCreatedGroupChange(event.target.checked) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:272 | confirmed |
| DocumentFilePanel | input | ファイル名 | 「ファイル名」を入力または選択する項目。 | - | onChange=(event) => onDocumentQueryChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:116 | confirmed |
| DocumentFilePanel | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => onDocumentTypeFilterChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:120 | confirmed |
| DocumentFilePanel | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => onDocumentStatusFilterChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:129 | confirmed |
| DocumentFilePanel | select | すべて / 未設定 | 「すべて / 未設定」を選ぶ選択項目。 | - | onChange=(event) => onDocumentGroupFilterChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:138 | confirmed |
| DocumentFilePanel | select | 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順 | 「更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順」を選ぶ選択項目。 | - | onChange=(event) => onDocumentSortChange(event.target.value as DocumentSortKey) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:148 | confirmed |
| DocumentFolderTree | input | フォルダを検索 | 「フォルダを検索」を入力または選択する項目。 | - | onChange=(event) => onFolderSearchChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:28 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | button | 管理者設定へ戻る | 「管理者設定へ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:305 | confirmed |
| DocumentDetailDrawer | button | 文書詳細を閉じる | 「文書詳細を閉じる」を実行するボタン。 | - | onClick=onClose | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:53 | confirmed |
| DocumentDetailDrawer | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | onClick=onCopyDocumentId | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:78 | unknown |
| DocumentDetailDrawer | button | 再インデックス | 「再インデックス」を実行するボタン。 | 状態: disabled=!canReindex | onClick=onStageReindex | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:82 | confirmed |
| DocumentDetailDrawer | button | 削除 | 「削除」を実行するボタン。 | 状態: disabled=!canDelete | onClick=onDelete | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:86 | confirmed |
| DocumentDetailPanel | form | 共有フォルダ / 選択してください / 共有 Cognito group / 追加: / 削除: / 変更なし: / 共有更新 | 「共有フォルダ / 選択してください / 共有 Cognito group / 追加: / 削除: / 変更なし: / 共有更新」を入力・送信するフォーム。 | - | onSubmit=onShareSubmit | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:142 | confirmed |
| DocumentDetailPanel | label | 共有フォルダ / 選択してください | 「共有フォルダ / 選択してください」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:143 | confirmed |
| DocumentDetailPanel | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => onShareGroupIdChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:145 | confirmed |
| DocumentDetailPanel | option | 選択してください | 「選択してください」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:146 | confirmed |
| DocumentDetailPanel | option | 共有フォルダ / 選択してください | 「共有フォルダ / 選択してください」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:148 | confirmed |
| DocumentDetailPanel | label | 共有 Cognito group | 「共有 Cognito group」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:152 | confirmed |
| DocumentDetailPanel | input | Cognito group をカンマ区切りで入力 | 「Cognito group をカンマ区切りで入力」を入力または選択する項目。 | 説明参照: share-groups-validation share-groups-diff<br>状態: aria-invalid=shareHasValidationError \|\| undefined, disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => onShareGroupsChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:154 | confirmed |
| DocumentDetailPanel | button | 共有更新 | 「共有更新」を実行するボタン。 | 状態: disabled=!canWrite \|\| !shareTargetGroupId \|\| shareHasValidationError \|\| operationState.sharingGrou… | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:173 | confirmed |
| DocumentDetailPanel | form | 保存先フォルダ / 保存先を選択 / アップロード | 「保存先フォルダ / 保存先を選択 / アップロード」を入力・送信するフォーム。 | - | onSubmit=onUploadSubmit | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:199 | confirmed |
| DocumentDetailPanel | label | 保存先フォルダ / 保存先を選択 | 「保存先フォルダ / 保存先を選択」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:200 | confirmed |
| DocumentDetailPanel | select | 保存先を選択 | 「保存先を選択」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.isUploading | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:202 | confirmed |
| DocumentDetailPanel | option | 保存先を選択 | 「保存先を選択」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:203 | confirmed |
| DocumentDetailPanel | option | 保存先フォルダ / 保存先を選択 | 「保存先フォルダ / 保存先を選択」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:205 | confirmed |
| DocumentDetailPanel | label | 文書アップロード | 「文書アップロード」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:209 | confirmed |
| DocumentDetailPanel | input | アップロードする文書を選択 | 「アップロードする文書を選択」を入力または選択する項目。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onChange=(event) => onUploadFileChange(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:212 | confirmed |
| DocumentDetailPanel | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| !uploadFile \|\| operationState.isUploading | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:215 | confirmed |
| DocumentDetailPanel | form | 新規フォルダ名 / 説明 / 親フォルダ / 親フォルダなし / 公開範囲 / 非公開 / 指定 group 共有 / 組織全体 / 初期 shared groups / 管理者 user IDs … | 「新規フォルダ名 / 説明 / 親フォルダ / 親フォルダなし / 公開範囲 / 非公開 / 指定 group 共有 / 組織全体 / 初期 shared groups / 管理者 user IDs …」を入力・送信するフォーム。 | - | onSubmit=onCreateGroupSubmit | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:223 | confirmed |
| DocumentDetailPanel | label | 新規フォルダ名 | 「新規フォルダ名」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:224 | confirmed |
| DocumentDetailPanel | input | フォルダ名 | 「フォルダ名」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => onGroupNameChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:226 | confirmed |
| DocumentDetailPanel | label | 説明 | 「説明」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:228 | confirmed |
| DocumentDetailPanel | textarea | フォルダの用途や対象資料 | 「フォルダの用途や対象資料」を複数行で入力する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => onGroupDescriptionChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:230 | confirmed |
| DocumentDetailPanel | label | 親フォルダ / 親フォルダなし | 「親フォルダ / 親フォルダなし」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:232 | confirmed |
| DocumentDetailPanel | select | 親フォルダなし | 「親フォルダなし」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => onGroupParentIdChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:234 | confirmed |
| DocumentDetailPanel | option | 親フォルダなし | 「親フォルダなし」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:235 | confirmed |
| DocumentDetailPanel | option | 親フォルダ / 親フォルダなし | 「親フォルダ / 親フォルダなし」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:237 | confirmed |
| DocumentDetailPanel | label | 公開範囲 / 非公開 / 指定 group 共有 / 組織全体 | 「公開範囲 / 非公開 / 指定 group 共有 / 組織全体」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:241 | confirmed |
| DocumentDetailPanel | select | 非公開 / 指定 group 共有 / 組織全体 | 「非公開 / 指定 group 共有 / 組織全体」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => onGroupVisibilityChange(event.target.value as "private" \| "shared" \| "org") | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:243 | confirmed |
| DocumentDetailPanel | option | 非公開 | 「非公開」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:244 | confirmed |
| DocumentDetailPanel | option | 指定 group 共有 | 「指定 group 共有」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:245 | confirmed |
| DocumentDetailPanel | option | 組織全体 | 「組織全体」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:246 | confirmed |
| DocumentDetailPanel | label | 初期 shared groups | 「初期 shared groups」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:249 | confirmed |
| DocumentDetailPanel | input | Cognito group をカンマ区切りで入力 | 「Cognito group をカンマ区切りで入力」を入力または選択する項目。 | 説明参照: create-group-validation create-group-preview<br>状態: aria-invalid=(validatesCreateSharedGroups && (createSharedDraft.hasEmptyToken \|\| createSharedDraft.dup…, disabled=!canWrite \|\| operationState.creatingGroup \|\| groupVisibility !== "shared" | onChange=(event) => onGroupSharedGroupsChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:251 | confirmed |
| DocumentDetailPanel | label | 管理者 user IDs | 「管理者 user IDs」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:260 | confirmed |
| DocumentDetailPanel | input | User ID をカンマ区切りで入力 | 「User ID をカンマ区切りで入力」を入力または選択する項目。 | 説明参照: create-group-validation create-group-preview<br>状態: aria-invalid=(createManagerDraft.hasEmptyToken \|\| createManagerDraft.duplicates.length > 0) \|\| undefin…, disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => onGroupManagerUserIdsChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:262 | confirmed |
| DocumentDetailPanel | label | 作成後にこのフォルダへ移動 | 「作成後にこのフォルダへ移動」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:271 | confirmed |
| DocumentDetailPanel | input | 作成後にこのフォルダへ移動 | 「作成後にこのフォルダへ移動」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => onMoveToCreatedGroupChange(event.target.checked) | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:272 | confirmed |
| DocumentDetailPanel | button | 新規フォルダ | 「新規フォルダ」を実行するボタン。 | 状態: disabled=!canWrite \|\| !groupName.trim() \|\| createHasValidationError \|\| operationState.creatingGroup | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:289 | confirmed |
| DocumentFilePanel | button | このフォルダにアップロード / 保存先を選択してアップロード | 「このフォルダにアップロード / 保存先を選択してアップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:92 | confirmed |
| DocumentFilePanel | button | 共有設定を編集 | 「共有設定を編集」を実行するボタン。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onClick=() => shareSelectRef.current?.focus() | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:101 | confirmed |
| DocumentFilePanel | label | ファイル名検索 | 「ファイル名検索」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:114 | confirmed |
| DocumentFilePanel | input | ファイル名 | 「ファイル名」を入力または選択する項目。 | - | onChange=(event) => onDocumentQueryChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:116 | confirmed |
| DocumentFilePanel | label | 種別 / すべて | 「種別 / すべて」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:118 | confirmed |
| DocumentFilePanel | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => onDocumentTypeFilterChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:120 | confirmed |
| DocumentFilePanel | option | すべて | 「すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:121 | confirmed |
| DocumentFilePanel | option | 種別 / すべて | 「種別 / すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:123 | confirmed |
| DocumentFilePanel | label | 状態 / すべて | 「状態 / すべて」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:127 | confirmed |
| DocumentFilePanel | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => onDocumentStatusFilterChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:129 | confirmed |
| DocumentFilePanel | option | すべて | 「すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:130 | confirmed |
| DocumentFilePanel | option | 状態 / すべて | 「状態 / すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:132 | confirmed |
| DocumentFilePanel | label | 所属フォルダ / すべて / 未設定 | 「所属フォルダ / すべて / 未設定」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:136 | confirmed |
| DocumentFilePanel | select | すべて / 未設定 | 「すべて / 未設定」を選ぶ選択項目。 | - | onChange=(event) => onDocumentGroupFilterChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:138 | confirmed |
| DocumentFilePanel | option | すべて | 「すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:139 | confirmed |
| DocumentFilePanel | option | 未設定 | 「未設定」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:140 | confirmed |
| DocumentFilePanel | option | 所属フォルダ / すべて / 未設定 | 「所属フォルダ / すべて / 未設定」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:142 | confirmed |
| DocumentFilePanel | label | 並び替え / 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順 | 「並び替え / 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:146 | confirmed |
| DocumentFilePanel | select | 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順 | 「更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順」を選ぶ選択項目。 | - | onChange=(event) => onDocumentSortChange(event.target.value as DocumentSortKey) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:148 | confirmed |
| DocumentFilePanel | option | 更新日 新しい順 | 「更新日 新しい順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:149 | confirmed |
| DocumentFilePanel | option | 更新日 古い順 | 「更新日 古い順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:150 | confirmed |
| DocumentFilePanel | option | ファイル名順 | 「ファイル名順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:151 | confirmed |
| DocumentFilePanel | option | チャンク数順 | 「チャンク数順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:152 | confirmed |
| DocumentFilePanel | option | 種別順 | 「種別順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:153 | confirmed |
| DocumentFilePanel | button | ファイルをアップロード | 「ファイルをアップロード」を実行するボタン。 | 状態: disabled=!canWrite \|\| !uploadGroupId | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:172 | confirmed |
| DocumentFilePanel | button | `${document.fileName}の再インデックスをステージング` | 「`${document.fileName}の再インデックスをステージング`」を実行するボタン。 | 状態: disabled=!canReindex \|\| operationState.stagingReindexDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() onConfirmAction({ kind: "stage", document }) } | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:208 | confirmed |
| DocumentFilePanel | button | `${document.fileName}を削除` | 「`${document.fileName}を削除`」を実行するボタン。 | 状態: disabled=!canDelete \|\| operationState.deletingDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() onConfirmAction({ kind: "delete", document }) } | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:220 | confirmed |
| ReindexMigrationStrip | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.cutoverMigrationId === migration.migrationId \|\| migration.status !== "stag… | onClick=() => onConfirmAction({ kind: "cutover", migration }) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:282 | unknown |
| ReindexMigrationStrip | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.rollbackMigrationId === migration.migrationId \|\| migration.status !== "cut… | onClick=() => onConfirmAction({ kind: "rollback", migration }) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:285 | unknown |
| DocumentFolderTree | label | フォルダを検索 | 「フォルダを検索」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:27 | confirmed |
| DocumentFolderTree | input | フォルダを検索 | 「フォルダを検索」を入力または選択する項目。 | - | onChange=(event) => onFolderSearchChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:28 | confirmed |
| DocumentFolderTree | button | フォルダ検索をクリア | 「フォルダ検索をクリア」を実行するボタン。 | 状態: disabled=!folderSearch | onClick=() => onFolderSearchChange("") | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:36 | confirmed |
| DocumentFolderTree | button | すべてのドキュメント | 「すべてのドキュメント」を実行するボタン。 | 状態: aria-current=selectedFolderId === "all" ? "true" : undefined | onClick=() => onSelectFolder("all", "") | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:41 | confirmed |
| DocumentFolderTree | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=selectedFolder.id === folder.id ? "true" : undefined | onClick=() => onSelectFolder(folder.id, folder.group?.groupId ?? "") | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:58 | unknown |
