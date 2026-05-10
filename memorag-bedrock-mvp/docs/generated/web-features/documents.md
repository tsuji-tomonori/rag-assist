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
| DocumentWorkspace | DocumentWorkspace は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/DocumentWorkspace.tsx | DocumentWorkspace | ConfirmDialog, DetailRow, DocumentDetailDrawer, FileIcon, Icon, LoadingSpinner, LoadingStatus, UploadProgressPanel, article, aside, button, code, dd, div, dl, dt, footer, form, h2, h3, header, input, label, li, nav, ol, option, p, section, select, small, span, strong, ul |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | button | 管理者設定へ戻る | 「管理者設定へ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:185 | confirmed |
| DocumentWorkspace | button | フォルダ検索をクリア | 「フォルダ検索をクリア」を実行するボタン。 | 状態: disabled=!folderSearch | onClick=() => setFolderSearch("") | apps/web/src/features/documents/components/DocumentWorkspace.tsx:214 | confirmed |
| DocumentWorkspace | button | すべてのドキュメント | 「すべてのドキュメント」を実行するボタン。 | 状態: aria-current=selectedFolderId === "all" ? "true" : undefined | onClick=() => { setSelectedFolderId("all") onUploadGroupChange("") } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:219 | confirmed |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=selectedFolder?.id === folder.id ? "true" : undefined | onClick=() => { setSelectedFolderId(folder.id) if (folder.group) onUploadGroupChange(folder.group… | apps/web/src/features/documents/components/DocumentWorkspace.tsx:239 | unknown |
| DocumentWorkspace | button | このフォルダにアップロード / 保存先を選択してアップロード | 「このフォルダにアップロード / 保存先を選択してアップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/DocumentWorkspace.tsx:271 | confirmed |
| DocumentWorkspace | button | 共有設定を編集 | 「共有設定を編集」を実行するボタン。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onClick=() => shareSelectRef.current?.focus() | apps/web/src/features/documents/components/DocumentWorkspace.tsx:280 | confirmed |
| DocumentWorkspace | button | ファイルをアップロード | 「ファイルをアップロード」を実行するボタン。 | 状態: disabled=!canWrite \|\| !uploadGroupId | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/DocumentWorkspace.tsx:350 | confirmed |
| DocumentWorkspace | button | `${document.fileName}の再インデックスをステージング` | 「`${document.fileName}の再インデックスをステージング`」を実行するボタン。 | 状態: disabled=!canReindex \|\| operationState.stagingReindexDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() setConfirmAction({ kind: "stage", document }) } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:384 | confirmed |
| DocumentWorkspace | button | `${document.fileName}を削除` | 「`${document.fileName}を削除`」を実行するボタン。 | 状態: disabled=!canDelete \|\| operationState.deletingDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() setConfirmAction({ kind: "delete", document }) } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:396 | confirmed |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.cutoverMigrationId === migration.migrationId \|\| migration.status !== "stag… | onClick=() => setConfirmAction({ kind: "cutover", migration }) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:425 | unknown |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.rollbackMigrationId === migration.migrationId \|\| migration.status !== "cut… | onClick=() => setConfirmAction({ kind: "rollback", migration }) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:428 | unknown |
| DocumentWorkspace | button | 共有更新 | 「共有更新」を実行するボタン。 | 状態: disabled=!canWrite \|\| !shareTargetGroupId \|\| shareHasValidationError \|\| operationState.sharingGrou… | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:487 | confirmed |
| DocumentWorkspace | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| !uploadFile \|\| operationState.isUploading | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:529 | confirmed |
| DocumentWorkspace | button | 新規フォルダ | 「新規フォルダ」を実行するボタン。 | 状態: disabled=!canWrite \|\| !groupName.trim() \|\| operationState.creatingGroup | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:542 | confirmed |
| ConfirmDialog | button | キャンセル | 「キャンセル」を実行するボタン。 | - | onClick=onCancel | apps/web/src/features/documents/components/DocumentWorkspace.tsx:681 | confirmed |
| ConfirmDialog | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | onClick=onConfirm | apps/web/src/features/documents/components/DocumentWorkspace.tsx:682 | unknown |
| DocumentDetailDrawer | button | 文書詳細を閉じる | 「文書詳細を閉じる」を実行するボタン。 | - | onClick=onClose | apps/web/src/features/documents/components/DocumentWorkspace.tsx:728 | confirmed |
| DocumentDetailDrawer | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | onClick=onCopyDocumentId | apps/web/src/features/documents/components/DocumentWorkspace.tsx:753 | unknown |
| DocumentDetailDrawer | button | 再インデックス | 「再インデックス」を実行するボタン。 | 状態: disabled=!canReindex | onClick=onStageReindex | apps/web/src/features/documents/components/DocumentWorkspace.tsx:757 | confirmed |
| DocumentDetailDrawer | button | 削除 | 「削除」を実行するボタン。 | 状態: disabled=!canDelete | onClick=onDelete | apps/web/src/features/documents/components/DocumentWorkspace.tsx:761 | confirmed |

## フォーム

| コンポーネント | ラベル | フォーム説明 | 状態・補足 | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | 共有フォルダ / 選択してください / 共有 Cognito group / 追加: / 削除: / 変更なし: / 共有更新 | 「共有フォルダ / 選択してください / 共有 Cognito group / 追加: / 削除: / 変更なし: / 共有更新」を入力・送信するフォーム。 | - | onSubmit=onShareSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:463 | confirmed |
| DocumentWorkspace | 保存先フォルダ / 保存先を選択 / アップロード | 「保存先フォルダ / 保存先を選択 / アップロード」を入力・送信するフォーム。 | - | onSubmit=onSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:513 | confirmed |
| DocumentWorkspace | 新規フォルダ / 新規フォルダ | 「新規フォルダ / 新規フォルダ」を入力・送信するフォーム。 | - | onSubmit=onCreateGroupSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:537 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | input | フォルダを検索 | 「フォルダを検索」を入力または選択する項目。 | - | onChange=(event) => setFolderSearch(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:206 | confirmed |
| DocumentWorkspace | input | ファイル名 | 「ファイル名」を入力または選択する項目。 | - | onChange=(event) => setDocumentQuery(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:295 | confirmed |
| DocumentWorkspace | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => setDocumentTypeFilter(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:299 | confirmed |
| DocumentWorkspace | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => setDocumentStatusFilter(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:308 | confirmed |
| DocumentWorkspace | select | すべて / 未設定 | 「すべて / 未設定」を選ぶ選択項目。 | - | onChange=(event) => setDocumentGroupFilter(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:317 | confirmed |
| DocumentWorkspace | select | 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順 | 「更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順」を選ぶ選択項目。 | - | onChange=(event) => setDocumentSort(event.target.value as DocumentSortKey) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:327 | confirmed |
| DocumentWorkspace | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => setShareGroupId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:466 | confirmed |
| DocumentWorkspace | input | Cognito group をカンマ区切りで入力 | 「Cognito group をカンマ区切りで入力」を入力または選択する項目。 | 説明参照: share-groups-validation share-groups-diff<br>状態: aria-invalid=shareHasValidationError \|\| undefined, disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => setShareGroups(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:475 | confirmed |
| DocumentWorkspace | select | 保存先を選択 | 「保存先を選択」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.isUploading | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:516 | confirmed |
| DocumentWorkspace | input | アップロードする文書を選択 | 「アップロードする文書を選択」を入力または選択する項目。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onChange=(event) => setUploadFile(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:526 | confirmed |
| DocumentWorkspace | input | フォルダ名 | 「フォルダ名」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => setGroupName(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:540 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | button | 管理者設定へ戻る | 「管理者設定へ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:185 | confirmed |
| DocumentWorkspace | label | フォルダを検索 | 「フォルダを検索」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:205 | confirmed |
| DocumentWorkspace | input | フォルダを検索 | 「フォルダを検索」を入力または選択する項目。 | - | onChange=(event) => setFolderSearch(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:206 | confirmed |
| DocumentWorkspace | button | フォルダ検索をクリア | 「フォルダ検索をクリア」を実行するボタン。 | 状態: disabled=!folderSearch | onClick=() => setFolderSearch("") | apps/web/src/features/documents/components/DocumentWorkspace.tsx:214 | confirmed |
| DocumentWorkspace | button | すべてのドキュメント | 「すべてのドキュメント」を実行するボタン。 | 状態: aria-current=selectedFolderId === "all" ? "true" : undefined | onClick=() => { setSelectedFolderId("all") onUploadGroupChange("") } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:219 | confirmed |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=selectedFolder?.id === folder.id ? "true" : undefined | onClick=() => { setSelectedFolderId(folder.id) if (folder.group) onUploadGroupChange(folder.group… | apps/web/src/features/documents/components/DocumentWorkspace.tsx:239 | unknown |
| DocumentWorkspace | button | このフォルダにアップロード / 保存先を選択してアップロード | 「このフォルダにアップロード / 保存先を選択してアップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/DocumentWorkspace.tsx:271 | confirmed |
| DocumentWorkspace | button | 共有設定を編集 | 「共有設定を編集」を実行するボタン。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onClick=() => shareSelectRef.current?.focus() | apps/web/src/features/documents/components/DocumentWorkspace.tsx:280 | confirmed |
| DocumentWorkspace | label | ファイル名検索 | 「ファイル名検索」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:293 | confirmed |
| DocumentWorkspace | input | ファイル名 | 「ファイル名」を入力または選択する項目。 | - | onChange=(event) => setDocumentQuery(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:295 | confirmed |
| DocumentWorkspace | label | 種別 / すべて | 「種別 / すべて」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:297 | confirmed |
| DocumentWorkspace | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => setDocumentTypeFilter(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:299 | confirmed |
| DocumentWorkspace | option | すべて | 「すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:300 | confirmed |
| DocumentWorkspace | option | 種別 / すべて | 「種別 / すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:302 | confirmed |
| DocumentWorkspace | label | 状態 / すべて | 「状態 / すべて」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:306 | confirmed |
| DocumentWorkspace | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => setDocumentStatusFilter(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:308 | confirmed |
| DocumentWorkspace | option | すべて | 「すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:309 | confirmed |
| DocumentWorkspace | option | 状態 / すべて | 「状態 / すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:311 | confirmed |
| DocumentWorkspace | label | 所属フォルダ / すべて / 未設定 | 「所属フォルダ / すべて / 未設定」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:315 | confirmed |
| DocumentWorkspace | select | すべて / 未設定 | 「すべて / 未設定」を選ぶ選択項目。 | - | onChange=(event) => setDocumentGroupFilter(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:317 | confirmed |
| DocumentWorkspace | option | すべて | 「すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:318 | confirmed |
| DocumentWorkspace | option | 未設定 | 「未設定」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:319 | confirmed |
| DocumentWorkspace | option | 所属フォルダ / すべて / 未設定 | 「所属フォルダ / すべて / 未設定」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:321 | confirmed |
| DocumentWorkspace | label | 並び替え / 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順 | 「並び替え / 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:325 | confirmed |
| DocumentWorkspace | select | 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順 | 「更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順」を選ぶ選択項目。 | - | onChange=(event) => setDocumentSort(event.target.value as DocumentSortKey) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:327 | confirmed |
| DocumentWorkspace | option | 更新日 新しい順 | 「更新日 新しい順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:328 | confirmed |
| DocumentWorkspace | option | 更新日 古い順 | 「更新日 古い順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:329 | confirmed |
| DocumentWorkspace | option | ファイル名順 | 「ファイル名順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:330 | confirmed |
| DocumentWorkspace | option | チャンク数順 | 「チャンク数順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:331 | confirmed |
| DocumentWorkspace | option | 種別順 | 「種別順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:332 | confirmed |
| DocumentWorkspace | button | ファイルをアップロード | 「ファイルをアップロード」を実行するボタン。 | 状態: disabled=!canWrite \|\| !uploadGroupId | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/DocumentWorkspace.tsx:350 | confirmed |
| DocumentWorkspace | button | `${document.fileName}の再インデックスをステージング` | 「`${document.fileName}の再インデックスをステージング`」を実行するボタン。 | 状態: disabled=!canReindex \|\| operationState.stagingReindexDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() setConfirmAction({ kind: "stage", document }) } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:384 | confirmed |
| DocumentWorkspace | button | `${document.fileName}を削除` | 「`${document.fileName}を削除`」を実行するボタン。 | 状態: disabled=!canDelete \|\| operationState.deletingDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() setConfirmAction({ kind: "delete", document }) } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:396 | confirmed |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.cutoverMigrationId === migration.migrationId \|\| migration.status !== "stag… | onClick=() => setConfirmAction({ kind: "cutover", migration }) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:425 | unknown |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.rollbackMigrationId === migration.migrationId \|\| migration.status !== "cut… | onClick=() => setConfirmAction({ kind: "rollback", migration }) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:428 | unknown |
| DocumentWorkspace | form | 共有フォルダ / 選択してください / 共有 Cognito group / 追加: / 削除: / 変更なし: / 共有更新 | 「共有フォルダ / 選択してください / 共有 Cognito group / 追加: / 削除: / 変更なし: / 共有更新」を入力・送信するフォーム。 | - | onSubmit=onShareSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:463 | confirmed |
| DocumentWorkspace | label | 共有フォルダ / 選択してください | 「共有フォルダ / 選択してください」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:464 | confirmed |
| DocumentWorkspace | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => setShareGroupId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:466 | confirmed |
| DocumentWorkspace | option | 選択してください | 「選択してください」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:467 | confirmed |
| DocumentWorkspace | option | 共有フォルダ / 選択してください | 「共有フォルダ / 選択してください」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:469 | confirmed |
| DocumentWorkspace | label | 共有 Cognito group | 「共有 Cognito group」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:473 | confirmed |
| DocumentWorkspace | input | Cognito group をカンマ区切りで入力 | 「Cognito group をカンマ区切りで入力」を入力または選択する項目。 | 説明参照: share-groups-validation share-groups-diff<br>状態: aria-invalid=shareHasValidationError \|\| undefined, disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => setShareGroups(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:475 | confirmed |
| DocumentWorkspace | button | 共有更新 | 「共有更新」を実行するボタン。 | 状態: disabled=!canWrite \|\| !shareTargetGroupId \|\| shareHasValidationError \|\| operationState.sharingGrou… | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:487 | confirmed |
| DocumentWorkspace | form | 保存先フォルダ / 保存先を選択 / アップロード | 「保存先フォルダ / 保存先を選択 / アップロード」を入力・送信するフォーム。 | - | onSubmit=onSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:513 | confirmed |
| DocumentWorkspace | label | 保存先フォルダ / 保存先を選択 | 「保存先フォルダ / 保存先を選択」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:514 | confirmed |
| DocumentWorkspace | select | 保存先を選択 | 「保存先を選択」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.isUploading | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:516 | confirmed |
| DocumentWorkspace | option | 保存先を選択 | 「保存先を選択」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:517 | confirmed |
| DocumentWorkspace | option | 保存先フォルダ / 保存先を選択 | 「保存先フォルダ / 保存先を選択」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:519 | confirmed |
| DocumentWorkspace | label | 文書アップロード | 「文書アップロード」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:523 | confirmed |
| DocumentWorkspace | input | アップロードする文書を選択 | 「アップロードする文書を選択」を入力または選択する項目。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onChange=(event) => setUploadFile(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:526 | confirmed |
| DocumentWorkspace | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| !uploadFile \|\| operationState.isUploading | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:529 | confirmed |
| DocumentWorkspace | form | 新規フォルダ / 新規フォルダ | 「新規フォルダ / 新規フォルダ」を入力・送信するフォーム。 | - | onSubmit=onCreateGroupSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:537 | confirmed |
| DocumentWorkspace | label | 新規フォルダ | 「新規フォルダ」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:538 | confirmed |
| DocumentWorkspace | input | フォルダ名 | 「フォルダ名」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => setGroupName(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:540 | confirmed |
| DocumentWorkspace | button | 新規フォルダ | 「新規フォルダ」を実行するボタン。 | 状態: disabled=!canWrite \|\| !groupName.trim() \|\| operationState.creatingGroup | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:542 | confirmed |
| ConfirmDialog | button | キャンセル | 「キャンセル」を実行するボタン。 | - | onClick=onCancel | apps/web/src/features/documents/components/DocumentWorkspace.tsx:681 | confirmed |
| ConfirmDialog | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | onClick=onConfirm | apps/web/src/features/documents/components/DocumentWorkspace.tsx:682 | unknown |
| DocumentDetailDrawer | button | 文書詳細を閉じる | 「文書詳細を閉じる」を実行するボタン。 | - | onClick=onClose | apps/web/src/features/documents/components/DocumentWorkspace.tsx:728 | confirmed |
| DocumentDetailDrawer | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | onClick=onCopyDocumentId | apps/web/src/features/documents/components/DocumentWorkspace.tsx:753 | unknown |
| DocumentDetailDrawer | button | 再インデックス | 「再インデックス」を実行するボタン。 | 状態: disabled=!canReindex | onClick=onStageReindex | apps/web/src/features/documents/components/DocumentWorkspace.tsx:757 | confirmed |
| DocumentDetailDrawer | button | 削除 | 「削除」を実行するボタン。 | 状態: disabled=!canDelete | onClick=onDelete | apps/web/src/features/documents/components/DocumentWorkspace.tsx:761 | confirmed |
