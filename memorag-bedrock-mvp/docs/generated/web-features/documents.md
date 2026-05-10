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
| DocumentWorkspace | DocumentWorkspace は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/DocumentWorkspace.tsx | DocumentWorkspace | ConfirmDialog, DetailRow, DocumentDetailDrawer, FileIcon, Icon, LoadingSpinner, LoadingStatus, UploadProgressPanel, article, aside, button, code, dd, div, dl, dt, footer, form, h2, h3, header, input, label, li, nav, ol, option, p, section, select, small, span, strong, textarea, ul |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | button | 管理者設定へ戻る | 「管理者設定へ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:214 | confirmed |
| DocumentWorkspace | button | フォルダ検索をクリア | 「フォルダ検索をクリア」を実行するボタン。 | 状態: disabled=!folderSearch | onClick=() => setFolderSearch("") | apps/web/src/features/documents/components/DocumentWorkspace.tsx:243 | confirmed |
| DocumentWorkspace | button | すべてのドキュメント | 「すべてのドキュメント」を実行するボタン。 | 状態: aria-current=selectedFolderId === "all" ? "true" : undefined | onClick=() => { setSelectedFolderId("all") onUploadGroupChange("") } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:248 | confirmed |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=selectedFolder?.id === folder.id ? "true" : undefined | onClick=() => { setSelectedFolderId(folder.id) if (folder.group) onUploadGroupChange(folder.group… | apps/web/src/features/documents/components/DocumentWorkspace.tsx:268 | unknown |
| DocumentWorkspace | button | このフォルダにアップロード / 保存先を選択してアップロード | 「このフォルダにアップロード / 保存先を選択してアップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/DocumentWorkspace.tsx:300 | confirmed |
| DocumentWorkspace | button | 共有設定を編集 | 「共有設定を編集」を実行するボタン。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onClick=() => shareSelectRef.current?.focus() | apps/web/src/features/documents/components/DocumentWorkspace.tsx:309 | confirmed |
| DocumentWorkspace | button | ファイルをアップロード | 「ファイルをアップロード」を実行するボタン。 | 状態: disabled=!canWrite \|\| !uploadGroupId | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/DocumentWorkspace.tsx:379 | confirmed |
| DocumentWorkspace | button | `${document.fileName}の再インデックスをステージング` | 「`${document.fileName}の再インデックスをステージング`」を実行するボタン。 | 状態: disabled=!canReindex \|\| operationState.stagingReindexDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() setConfirmAction({ kind: "stage", document }) } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:413 | confirmed |
| DocumentWorkspace | button | `${document.fileName}を削除` | 「`${document.fileName}を削除`」を実行するボタン。 | 状態: disabled=!canDelete \|\| operationState.deletingDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() setConfirmAction({ kind: "delete", document }) } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:425 | confirmed |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.cutoverMigrationId === migration.migrationId \|\| migration.status !== "stag… | onClick=() => setConfirmAction({ kind: "cutover", migration }) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:454 | unknown |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.rollbackMigrationId === migration.migrationId \|\| migration.status !== "cut… | onClick=() => setConfirmAction({ kind: "rollback", migration }) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:457 | unknown |
| DocumentWorkspace | button | 共有更新 | 「共有更新」を実行するボタン。 | 状態: disabled=!canWrite \|\| !shareTargetGroupId \|\| shareHasValidationError \|\| operationState.sharingGrou… | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:516 | confirmed |
| DocumentWorkspace | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| !uploadFile \|\| operationState.isUploading | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:558 | confirmed |
| DocumentWorkspace | button | 新規フォルダ | 「新規フォルダ」を実行するボタン。 | 状態: disabled=!canWrite \|\| !groupName.trim() \|\| createHasValidationError \|\| operationState.creatingGroup | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:618 | confirmed |
| ConfirmDialog | button | キャンセル | 「キャンセル」を実行するボタン。 | - | onClick=onCancel | apps/web/src/features/documents/components/DocumentWorkspace.tsx:757 | confirmed |
| ConfirmDialog | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | onClick=onConfirm | apps/web/src/features/documents/components/DocumentWorkspace.tsx:758 | unknown |
| DocumentDetailDrawer | button | 文書詳細を閉じる | 「文書詳細を閉じる」を実行するボタン。 | - | onClick=onClose | apps/web/src/features/documents/components/DocumentWorkspace.tsx:804 | confirmed |
| DocumentDetailDrawer | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | onClick=onCopyDocumentId | apps/web/src/features/documents/components/DocumentWorkspace.tsx:829 | unknown |
| DocumentDetailDrawer | button | 再インデックス | 「再インデックス」を実行するボタン。 | 状態: disabled=!canReindex | onClick=onStageReindex | apps/web/src/features/documents/components/DocumentWorkspace.tsx:833 | confirmed |
| DocumentDetailDrawer | button | 削除 | 「削除」を実行するボタン。 | 状態: disabled=!canDelete | onClick=onDelete | apps/web/src/features/documents/components/DocumentWorkspace.tsx:837 | confirmed |

## フォーム

| コンポーネント | ラベル | フォーム説明 | 状態・補足 | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | 共有フォルダ / 選択してください / 共有 Cognito group / 追加: / 削除: / 変更なし: / 共有更新 | 「共有フォルダ / 選択してください / 共有 Cognito group / 追加: / 削除: / 変更なし: / 共有更新」を入力・送信するフォーム。 | - | onSubmit=onShareSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:492 | confirmed |
| DocumentWorkspace | 保存先フォルダ / 保存先を選択 / アップロード | 「保存先フォルダ / 保存先を選択 / アップロード」を入力・送信するフォーム。 | - | onSubmit=onSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:542 | confirmed |
| DocumentWorkspace | 新規フォルダ名 / 説明 / 親フォルダ / 親フォルダなし / 公開範囲 / 非公開 / 指定 group 共有 / 組織全体 / 初期 shared groups / 管理者 user IDs … | 「新規フォルダ名 / 説明 / 親フォルダ / 親フォルダなし / 公開範囲 / 非公開 / 指定 group 共有 / 組織全体 / 初期 shared groups / 管理者 user IDs …」を入力・送信するフォーム。 | - | onSubmit=onCreateGroupSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:566 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | input | フォルダを検索 | 「フォルダを検索」を入力または選択する項目。 | - | onChange=(event) => setFolderSearch(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:235 | confirmed |
| DocumentWorkspace | input | ファイル名 | 「ファイル名」を入力または選択する項目。 | - | onChange=(event) => setDocumentQuery(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:324 | confirmed |
| DocumentWorkspace | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => setDocumentTypeFilter(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:328 | confirmed |
| DocumentWorkspace | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => setDocumentStatusFilter(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:337 | confirmed |
| DocumentWorkspace | select | すべて / 未設定 | 「すべて / 未設定」を選ぶ選択項目。 | - | onChange=(event) => setDocumentGroupFilter(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:346 | confirmed |
| DocumentWorkspace | select | 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順 | 「更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順」を選ぶ選択項目。 | - | onChange=(event) => setDocumentSort(event.target.value as DocumentSortKey) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:356 | confirmed |
| DocumentWorkspace | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => setShareGroupId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:495 | confirmed |
| DocumentWorkspace | input | Cognito group をカンマ区切りで入力 | 「Cognito group をカンマ区切りで入力」を入力または選択する項目。 | 説明参照: share-groups-validation share-groups-diff<br>状態: aria-invalid=shareHasValidationError \|\| undefined, disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => setShareGroups(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:504 | confirmed |
| DocumentWorkspace | select | 保存先を選択 | 「保存先を選択」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.isUploading | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:545 | confirmed |
| DocumentWorkspace | input | アップロードする文書を選択 | 「アップロードする文書を選択」を入力または選択する項目。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onChange=(event) => setUploadFile(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:555 | confirmed |
| DocumentWorkspace | input | フォルダ名 | 「フォルダ名」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => setGroupName(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:569 | confirmed |
| DocumentWorkspace | textarea | フォルダの用途や対象資料 | 「フォルダの用途や対象資料」を複数行で入力する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => setGroupDescription(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:573 | confirmed |
| DocumentWorkspace | select | 親フォルダなし | 「親フォルダなし」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => setGroupParentId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:577 | confirmed |
| DocumentWorkspace | select | 非公開 / 指定 group 共有 / 組織全体 | 「非公開 / 指定 group 共有 / 組織全体」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => setGroupVisibility(event.target.value as "private" \| "shared" \| "org") | apps/web/src/features/documents/components/DocumentWorkspace.tsx:586 | confirmed |
| DocumentWorkspace | input | Cognito group をカンマ区切りで入力 | 「Cognito group をカンマ区切りで入力」を入力または選択する項目。 | 説明参照: create-group-validation create-group-preview<br>状態: aria-invalid=(validatesCreateSharedGroups && (createSharedDraft.hasEmptyToken \|\| createSharedDraft.dup…, disabled=!canWrite \|\| operationState.creatingGroup \|\| groupVisibility !== "shared" | onChange=(event) => setGroupSharedGroups(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:594 | confirmed |
| DocumentWorkspace | input | User ID をカンマ区切りで入力 | 「User ID をカンマ区切りで入力」を入力または選択する項目。 | 説明参照: create-group-validation create-group-preview<br>状態: aria-invalid=(createManagerDraft.hasEmptyToken \|\| createManagerDraft.duplicates.length > 0) \|\| undefin…, disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => setGroupManagerUserIds(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:598 | confirmed |
| DocumentWorkspace | input | 作成後にこのフォルダへ移動 | 「作成後にこのフォルダへ移動」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => setMoveToCreatedGroup(event.target.checked) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:601 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | button | 管理者設定へ戻る | 「管理者設定へ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:214 | confirmed |
| DocumentWorkspace | label | フォルダを検索 | 「フォルダを検索」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:234 | confirmed |
| DocumentWorkspace | input | フォルダを検索 | 「フォルダを検索」を入力または選択する項目。 | - | onChange=(event) => setFolderSearch(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:235 | confirmed |
| DocumentWorkspace | button | フォルダ検索をクリア | 「フォルダ検索をクリア」を実行するボタン。 | 状態: disabled=!folderSearch | onClick=() => setFolderSearch("") | apps/web/src/features/documents/components/DocumentWorkspace.tsx:243 | confirmed |
| DocumentWorkspace | button | すべてのドキュメント | 「すべてのドキュメント」を実行するボタン。 | 状態: aria-current=selectedFolderId === "all" ? "true" : undefined | onClick=() => { setSelectedFolderId("all") onUploadGroupChange("") } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:248 | confirmed |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=selectedFolder?.id === folder.id ? "true" : undefined | onClick=() => { setSelectedFolderId(folder.id) if (folder.group) onUploadGroupChange(folder.group… | apps/web/src/features/documents/components/DocumentWorkspace.tsx:268 | unknown |
| DocumentWorkspace | button | このフォルダにアップロード / 保存先を選択してアップロード | 「このフォルダにアップロード / 保存先を選択してアップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/DocumentWorkspace.tsx:300 | confirmed |
| DocumentWorkspace | button | 共有設定を編集 | 「共有設定を編集」を実行するボタン。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onClick=() => shareSelectRef.current?.focus() | apps/web/src/features/documents/components/DocumentWorkspace.tsx:309 | confirmed |
| DocumentWorkspace | label | ファイル名検索 | 「ファイル名検索」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:322 | confirmed |
| DocumentWorkspace | input | ファイル名 | 「ファイル名」を入力または選択する項目。 | - | onChange=(event) => setDocumentQuery(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:324 | confirmed |
| DocumentWorkspace | label | 種別 / すべて | 「種別 / すべて」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:326 | confirmed |
| DocumentWorkspace | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => setDocumentTypeFilter(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:328 | confirmed |
| DocumentWorkspace | option | すべて | 「すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:329 | confirmed |
| DocumentWorkspace | option | 種別 / すべて | 「種別 / すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:331 | confirmed |
| DocumentWorkspace | label | 状態 / すべて | 「状態 / すべて」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:335 | confirmed |
| DocumentWorkspace | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => setDocumentStatusFilter(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:337 | confirmed |
| DocumentWorkspace | option | すべて | 「すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:338 | confirmed |
| DocumentWorkspace | option | 状態 / すべて | 「状態 / すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:340 | confirmed |
| DocumentWorkspace | label | 所属フォルダ / すべて / 未設定 | 「所属フォルダ / すべて / 未設定」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:344 | confirmed |
| DocumentWorkspace | select | すべて / 未設定 | 「すべて / 未設定」を選ぶ選択項目。 | - | onChange=(event) => setDocumentGroupFilter(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:346 | confirmed |
| DocumentWorkspace | option | すべて | 「すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:347 | confirmed |
| DocumentWorkspace | option | 未設定 | 「未設定」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:348 | confirmed |
| DocumentWorkspace | option | 所属フォルダ / すべて / 未設定 | 「所属フォルダ / すべて / 未設定」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:350 | confirmed |
| DocumentWorkspace | label | 並び替え / 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順 | 「並び替え / 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:354 | confirmed |
| DocumentWorkspace | select | 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順 | 「更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順」を選ぶ選択項目。 | - | onChange=(event) => setDocumentSort(event.target.value as DocumentSortKey) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:356 | confirmed |
| DocumentWorkspace | option | 更新日 新しい順 | 「更新日 新しい順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:357 | confirmed |
| DocumentWorkspace | option | 更新日 古い順 | 「更新日 古い順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:358 | confirmed |
| DocumentWorkspace | option | ファイル名順 | 「ファイル名順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:359 | confirmed |
| DocumentWorkspace | option | チャンク数順 | 「チャンク数順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:360 | confirmed |
| DocumentWorkspace | option | 種別順 | 「種別順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:361 | confirmed |
| DocumentWorkspace | button | ファイルをアップロード | 「ファイルをアップロード」を実行するボタン。 | 状態: disabled=!canWrite \|\| !uploadGroupId | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/DocumentWorkspace.tsx:379 | confirmed |
| DocumentWorkspace | button | `${document.fileName}の再インデックスをステージング` | 「`${document.fileName}の再インデックスをステージング`」を実行するボタン。 | 状態: disabled=!canReindex \|\| operationState.stagingReindexDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() setConfirmAction({ kind: "stage", document }) } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:413 | confirmed |
| DocumentWorkspace | button | `${document.fileName}を削除` | 「`${document.fileName}を削除`」を実行するボタン。 | 状態: disabled=!canDelete \|\| operationState.deletingDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() setConfirmAction({ kind: "delete", document }) } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:425 | confirmed |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.cutoverMigrationId === migration.migrationId \|\| migration.status !== "stag… | onClick=() => setConfirmAction({ kind: "cutover", migration }) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:454 | unknown |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.rollbackMigrationId === migration.migrationId \|\| migration.status !== "cut… | onClick=() => setConfirmAction({ kind: "rollback", migration }) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:457 | unknown |
| DocumentWorkspace | form | 共有フォルダ / 選択してください / 共有 Cognito group / 追加: / 削除: / 変更なし: / 共有更新 | 「共有フォルダ / 選択してください / 共有 Cognito group / 追加: / 削除: / 変更なし: / 共有更新」を入力・送信するフォーム。 | - | onSubmit=onShareSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:492 | confirmed |
| DocumentWorkspace | label | 共有フォルダ / 選択してください | 「共有フォルダ / 選択してください」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:493 | confirmed |
| DocumentWorkspace | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => setShareGroupId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:495 | confirmed |
| DocumentWorkspace | option | 選択してください | 「選択してください」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:496 | confirmed |
| DocumentWorkspace | option | 共有フォルダ / 選択してください | 「共有フォルダ / 選択してください」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:498 | confirmed |
| DocumentWorkspace | label | 共有 Cognito group | 「共有 Cognito group」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:502 | confirmed |
| DocumentWorkspace | input | Cognito group をカンマ区切りで入力 | 「Cognito group をカンマ区切りで入力」を入力または選択する項目。 | 説明参照: share-groups-validation share-groups-diff<br>状態: aria-invalid=shareHasValidationError \|\| undefined, disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => setShareGroups(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:504 | confirmed |
| DocumentWorkspace | button | 共有更新 | 「共有更新」を実行するボタン。 | 状態: disabled=!canWrite \|\| !shareTargetGroupId \|\| shareHasValidationError \|\| operationState.sharingGrou… | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:516 | confirmed |
| DocumentWorkspace | form | 保存先フォルダ / 保存先を選択 / アップロード | 「保存先フォルダ / 保存先を選択 / アップロード」を入力・送信するフォーム。 | - | onSubmit=onSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:542 | confirmed |
| DocumentWorkspace | label | 保存先フォルダ / 保存先を選択 | 「保存先フォルダ / 保存先を選択」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:543 | confirmed |
| DocumentWorkspace | select | 保存先を選択 | 「保存先を選択」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.isUploading | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:545 | confirmed |
| DocumentWorkspace | option | 保存先を選択 | 「保存先を選択」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:546 | confirmed |
| DocumentWorkspace | option | 保存先フォルダ / 保存先を選択 | 「保存先フォルダ / 保存先を選択」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:548 | confirmed |
| DocumentWorkspace | label | 文書アップロード | 「文書アップロード」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:552 | confirmed |
| DocumentWorkspace | input | アップロードする文書を選択 | 「アップロードする文書を選択」を入力または選択する項目。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | onChange=(event) => setUploadFile(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:555 | confirmed |
| DocumentWorkspace | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| !uploadFile \|\| operationState.isUploading | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:558 | confirmed |
| DocumentWorkspace | form | 新規フォルダ名 / 説明 / 親フォルダ / 親フォルダなし / 公開範囲 / 非公開 / 指定 group 共有 / 組織全体 / 初期 shared groups / 管理者 user IDs … | 「新規フォルダ名 / 説明 / 親フォルダ / 親フォルダなし / 公開範囲 / 非公開 / 指定 group 共有 / 組織全体 / 初期 shared groups / 管理者 user IDs …」を入力・送信するフォーム。 | - | onSubmit=onCreateGroupSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:566 | confirmed |
| DocumentWorkspace | label | 新規フォルダ名 | 「新規フォルダ名」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:567 | confirmed |
| DocumentWorkspace | input | フォルダ名 | 「フォルダ名」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => setGroupName(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:569 | confirmed |
| DocumentWorkspace | label | 説明 | 「説明」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:571 | confirmed |
| DocumentWorkspace | textarea | フォルダの用途や対象資料 | 「フォルダの用途や対象資料」を複数行で入力する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => setGroupDescription(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:573 | confirmed |
| DocumentWorkspace | label | 親フォルダ / 親フォルダなし | 「親フォルダ / 親フォルダなし」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:575 | confirmed |
| DocumentWorkspace | select | 親フォルダなし | 「親フォルダなし」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => setGroupParentId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:577 | confirmed |
| DocumentWorkspace | option | 親フォルダなし | 「親フォルダなし」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:578 | confirmed |
| DocumentWorkspace | option | 親フォルダ / 親フォルダなし | 「親フォルダ / 親フォルダなし」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:580 | confirmed |
| DocumentWorkspace | label | 公開範囲 / 非公開 / 指定 group 共有 / 組織全体 | 「公開範囲 / 非公開 / 指定 group 共有 / 組織全体」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:584 | confirmed |
| DocumentWorkspace | select | 非公開 / 指定 group 共有 / 組織全体 | 「非公開 / 指定 group 共有 / 組織全体」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => setGroupVisibility(event.target.value as "private" \| "shared" \| "org") | apps/web/src/features/documents/components/DocumentWorkspace.tsx:586 | confirmed |
| DocumentWorkspace | option | 非公開 | 「非公開」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:587 | confirmed |
| DocumentWorkspace | option | 指定 group 共有 | 「指定 group 共有」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:588 | confirmed |
| DocumentWorkspace | option | 組織全体 | 「組織全体」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:589 | confirmed |
| DocumentWorkspace | label | 初期 shared groups | 「初期 shared groups」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:592 | confirmed |
| DocumentWorkspace | input | Cognito group をカンマ区切りで入力 | 「Cognito group をカンマ区切りで入力」を入力または選択する項目。 | 説明参照: create-group-validation create-group-preview<br>状態: aria-invalid=(validatesCreateSharedGroups && (createSharedDraft.hasEmptyToken \|\| createSharedDraft.dup…, disabled=!canWrite \|\| operationState.creatingGroup \|\| groupVisibility !== "shared" | onChange=(event) => setGroupSharedGroups(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:594 | confirmed |
| DocumentWorkspace | label | 管理者 user IDs | 「管理者 user IDs」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:596 | confirmed |
| DocumentWorkspace | input | User ID をカンマ区切りで入力 | 「User ID をカンマ区切りで入力」を入力または選択する項目。 | 説明参照: create-group-validation create-group-preview<br>状態: aria-invalid=(createManagerDraft.hasEmptyToken \|\| createManagerDraft.duplicates.length > 0) \|\| undefin…, disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => setGroupManagerUserIds(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:598 | confirmed |
| DocumentWorkspace | label | 作成後にこのフォルダへ移動 | 「作成後にこのフォルダへ移動」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:600 | confirmed |
| DocumentWorkspace | input | 作成後にこのフォルダへ移動 | 「作成後にこのフォルダへ移動」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | onChange=(event) => setMoveToCreatedGroup(event.target.checked) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:601 | confirmed |
| DocumentWorkspace | button | 新規フォルダ | 「新規フォルダ」を実行するボタン。 | 状態: disabled=!canWrite \|\| !groupName.trim() \|\| createHasValidationError \|\| operationState.creatingGroup | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:618 | confirmed |
| ConfirmDialog | button | キャンセル | 「キャンセル」を実行するボタン。 | - | onClick=onCancel | apps/web/src/features/documents/components/DocumentWorkspace.tsx:757 | confirmed |
| ConfirmDialog | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | onClick=onConfirm | apps/web/src/features/documents/components/DocumentWorkspace.tsx:758 | unknown |
| DocumentDetailDrawer | button | 文書詳細を閉じる | 「文書詳細を閉じる」を実行するボタン。 | - | onClick=onClose | apps/web/src/features/documents/components/DocumentWorkspace.tsx:804 | confirmed |
| DocumentDetailDrawer | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | onClick=onCopyDocumentId | apps/web/src/features/documents/components/DocumentWorkspace.tsx:829 | unknown |
| DocumentDetailDrawer | button | 再インデックス | 「再インデックス」を実行するボタン。 | 状態: disabled=!canReindex | onClick=onStageReindex | apps/web/src/features/documents/components/DocumentWorkspace.tsx:833 | confirmed |
| DocumentDetailDrawer | button | 削除 | 「削除」を実行するボタン。 | 状態: disabled=!canDelete | onClick=onDelete | apps/web/src/features/documents/components/DocumentWorkspace.tsx:837 | confirmed |
