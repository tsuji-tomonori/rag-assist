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
| DocumentWorkspace | DocumentWorkspace は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/DocumentWorkspace.tsx | DocumentWorkspace | DocumentConfirmDialog, DocumentDetailDrawer, DocumentFilePanel, DocumentFolderTree, Icon, LoadingStatus, WorkspaceModal, button, dd, div, dl, dt, form, h2, h3, header, input, label, li, nav, option, p, section, select, span, strong, textarea, ul |
| DocumentConfirmDialog | DocumentConfirmDialog は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/workspace/DocumentConfirmDialog.tsx | DocumentConfirmDialog | ConfirmDialog |
| DocumentDetailDrawer | DocumentDetailDrawer は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx | DocumentDetailDrawer | CounterList, DetailRow, Icon, InlineList, ParsedDocumentSummary, WarningList, aside, button, dd, div, dl, dt, h3, header, li, span, ul |
| DocumentFilePanel | DocumentFilePanel は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx | DocumentFilePanel | EmptyState, FileIcon, Icon, LoadingSpinner, ReindexMigrationStrip, article, button, div, footer, h3, input, label, option, section, select, span, strong |
| DocumentFolderTree | DocumentFolderTree は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx | DocumentFolderTree | Icon, aside, button, div, input, label, p, small, span, strong |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | button | 管理者設定へ戻る | 「管理者設定へ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:425 | confirmed |
| DocumentWorkspace | button | 保存 | 「保存」を実行するボタン。 | 状態: disabled=!canSubmitShare | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:529 | confirmed |
| DocumentWorkspace | button | 保存 | 「保存」を実行するボタン。 | 状態: disabled=!editCanSubmit | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:539 | confirmed |
| DocumentWorkspace | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!uploadFile \|\| !canUploadToDestination \|\| operationState.isUploading | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:560 | confirmed |
| DocumentWorkspace | button | 削除 | 「削除」を実行するボタン。 | - | onClick=() => setDocumentShareDraftGrants((current) => current.filter((item) => !(item.principalT… | apps/web/src/features/documents/components/DocumentWorkspace.tsx:577 | confirmed |
| DocumentWorkspace | button | 保存 | 「保存」を実行するボタン。 | 状態: disabled=!documentShareReason.trim() \|\| operationState.sharingDocumentId === documentShareTarget.d… | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:590 | confirmed |
| DocumentWorkspace | button | 移動 | 「移動」を実行するボタン。 | 状態: disabled=!documentMoveDestinationId \|\| documentMoveNameConflict \|\| !documentMoveReason.trim() \|\| o… | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:603 | confirmed |
| WorkspaceModal | button | `${title}を閉じる` | 「`${title}を閉じる`」を実行するボタン。 | - | onClick=onClose | apps/web/src/features/documents/components/DocumentWorkspace.tsx:661 | confirmed |
| DocumentDetailDrawer | button | 文書詳細を閉じる | 「文書詳細を閉じる」を実行するボタン。 | - | onClick=onClose | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:61 | confirmed |
| DocumentDetailDrawer | button | この資料に質問する | 「この資料に質問する」を実行するボタン。 | 状態: disabled=!onAskDocument | onClick=() => onAskDocument?.() | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:88 | confirmed |
| DocumentDetailDrawer | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | onClick=onCopyDocumentId | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:92 | unknown |
| DocumentDetailDrawer | button | 再インデックス | 「再インデックス」を実行するボタン。 | 状態: disabled=!canReindex | onClick=onStageReindex | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:96 | confirmed |
| DocumentDetailDrawer | button | 削除 | 「削除」を実行するボタン。 | 状態: disabled=!canDelete | onClick=onDelete | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:100 | confirmed |
| DocumentFilePanel | button | フォルダ情報 | 「フォルダ情報」を実行するボタン。 | - | onClick=onOpenFolderInfo | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:129 | confirmed |
| DocumentFilePanel | button | フォルダ共有 | 「フォルダ共有」を実行するボタン。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onClick=onOpenFolderShare | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:130 | confirmed |
| DocumentFilePanel | button | フォルダ名変更 | 「フォルダ名変更」を実行するボタン。 | 状態: disabled=!canWrite | onClick=onOpenFolderRename | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:131 | confirmed |
| DocumentFilePanel | button | フォルダ移動 | 「フォルダ移動」を実行するボタン。 | 状態: disabled=!canWrite | onClick=onOpenFolderMove | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:132 | confirmed |
| DocumentFilePanel | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!canWrite \|\| operationState.isUploading | onClick=onOpenUpload | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:133 | confirmed |
| DocumentFilePanel | button | ファイルをアップロード | 「ファイルをアップロード」を実行するボタン。 | 状態: disabled=!canWrite \|\| !uploadGroupId | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:196 | confirmed |
| DocumentFilePanel | button | `${document.fileName}の詳細` | 「`${document.fileName}の詳細`」を実行するボタン。 | - | onClick=(event) => { event.stopPropagation() onSelectDocument(document) } | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:236 | confirmed |
| DocumentFilePanel | button | `${document.fileName}を共有` | 「`${document.fileName}を共有`」を実行するボタン。 | 状態: disabled=operationState.sharingDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() onShareDocument(document) } | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:248 | confirmed |
| DocumentFilePanel | button | `${document.fileName}を移動` | 「`${document.fileName}を移動`」を実行するボタン。 | 状態: disabled=operationState.movingDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() onMoveDocument(document) } | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:262 | confirmed |
| DocumentFilePanel | button | `${document.fileName}の再インデックスをステージング` | 「`${document.fileName}の再インデックスをステージング`」を実行するボタン。 | 状態: disabled=!canReindexRow \|\| operationState.stagingReindexDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() if (!canReindexRow) return onConfirmAction({ kind: "… | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:275 | confirmed |
| DocumentFilePanel | button | `${document.fileName}を削除` | 「`${document.fileName}を削除`」を実行するボタン。 | 状態: disabled=!canDeleteRow \|\| operationState.deletingDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() if (!canDeleteRow) return onConfirmAction({ kind: "d… | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:288 | confirmed |
| DocumentFilePanel | button | 前のページ | 「前のページ」を実行するボタン。 | 状態: disabled=documentPage <= 1 \|\| filteredDocumentsCount === 0 | onClick=() => onDocumentPageChange(Math.max(1, documentPage - 1)) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:328 | confirmed |
| DocumentFilePanel | button | 次のページ | 「次のページ」を実行するボタン。 | 状態: disabled=documentPage >= documentPageCount \|\| filteredDocumentsCount === 0 | onClick=() => onDocumentPageChange(Math.min(documentPageCount, documentPage + 1)) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:337 | confirmed |
| ReindexMigrationStrip | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.cutoverMigrationId === migration.migrationId \|\| migration.status !== "stag… | onClick=() => onConfirmAction({ kind: "cutover", migration }) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:386 | unknown |
| ReindexMigrationStrip | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.rollbackMigrationId === migration.migrationId \|\| migration.status !== "cut… | onClick=() => onConfirmAction({ kind: "rollback", migration }) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:389 | unknown |
| DocumentFolderTree | button | フォルダ検索をクリア | 「フォルダ検索をクリア」を実行するボタン。 | 状態: disabled=!folderSearch | onClick=() => onFolderSearchChange("") | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:36 | confirmed |
| DocumentFolderTree | button | すべてのドキュメント | 「すべてのドキュメント」を実行するボタン。 | 状態: aria-current=selectedFolderId === "all" ? "true" : undefined | onClick=() => onSelectFolder("all", "") | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:41 | confirmed |
| DocumentFolderTree | button | `${folder.path} ${folder.count}件` | 「`${folder.path} ${folder.count}件`」を実行するボタン。 | 状態: aria-current=selectedFolder.id === folder.id ? "true" : undefined | onClick=() => onSelectFolder(folder.id, folder.group?.groupId ?? "") | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:58 | confirmed |

## フォーム

| コンポーネント | ラベル | フォーム説明 | 状態・補足 | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | 共有フォルダ / 選択してください / 共有 group / 追加: / 削除: / 保存 | 「共有フォルダ / 選択してください / 共有 group / 追加: / 削除: / 保存」を入力・送信するフォーム。 | - | onSubmit=(event) => void onShareSubmit(event) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:524 | confirmed |
| DocumentWorkspace | 移動先: / 保存 | 「移動先: / 保存」を入力・送信するフォーム。 | - | onSubmit=(event) => void onEditGroupSubmit(event) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:535 | confirmed |
| DocumentWorkspace | 保存先フォルダ / 選択してください / アップロード先: / 文書アップロード / アップロード | 「保存先フォルダ / 選択してください / アップロード先: / 文書アップロード / アップロード」を入力・送信するフォーム。 | - | onSubmit=(event) => void onSubmit(event) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:545 | confirmed |
| DocumentWorkspace | ファイル名: / 現在の権限: / 継承: / 共有先種別 / 共有先ID / 権限 / 理由 / 保存 | 「ファイル名: / 現在の権限: / 継承: / 共有先種別 / 共有先ID / 権限 / 理由 / 保存」を入力・送信するフォーム。 | - | onSubmit=(event) => void onDocumentShareSubmit(event) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:566 | confirmed |
| DocumentWorkspace | ファイル名: / 移動先フォルダ / 選択してください / 移動後の表示名 / 直接共有は維持され、継承共有は移動先フォルダの設定に変わります。 / 理由 / 移動 | 「ファイル名: / 移動先フォルダ / 選択してください / 移動後の表示名 / 直接共有は維持され、継承共有は移動先フォルダの設定に変わります。 / 理由 / 移動」を入力・送信するフォーム。 | - | onSubmit=(event) => void onDocumentMoveSubmit(event) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:596 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => setShareGroupId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:525 | confirmed |
| DocumentWorkspace | input | group をカンマ区切りで入力 | 「group をカンマ区切りで入力」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => updateShareGroups(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:526 | confirmed |
| DocumentWorkspace | input | 既存共有をすべて削除することを確認しました | 「既存共有をすべて削除することを確認しました」を入力または選択する項目。 | - | onChange=(event) => setShareClearConfirmed(event.target.checked) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:528 | confirmed |
| DocumentWorkspace | input | フォルダ名 | 「フォルダ名」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| !editTargetGroup | onChange=(event) => setEditGroupName(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:536 | confirmed |
| DocumentWorkspace | select | ルート | 「ルート」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| !editTargetGroup | onChange=(event) => setEditGroupParentId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:537 | confirmed |
| DocumentWorkspace | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.isUploading | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:548 | confirmed |
| DocumentWorkspace | input | 文書アップロード | 「文書アップロード」を入力または選択する項目。 | - | onChange=(event) => onUploadFileChange(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:558 | confirmed |
| DocumentWorkspace | select | user / group | 「user / group」を選ぶ選択項目。 | - | onChange=(event) => setDocumentSharePrincipalType(event.target.value as "user" \| "group") | apps/web/src/features/documents/components/DocumentWorkspace.tsx:586 | confirmed |
| DocumentWorkspace | input | 共有先ID | 「共有先ID」を入力または選択する項目。 | - | onChange=(event) => setDocumentSharePrincipalId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:587 | confirmed |
| DocumentWorkspace | select | readOnly / full | 「readOnly / full」を選ぶ選択項目。 | - | onChange=(event) => setDocumentSharePermissionLevel(event.target.value as "readOnly" \| "full") | apps/web/src/features/documents/components/DocumentWorkspace.tsx:588 | confirmed |
| DocumentWorkspace | textarea | 理由 | 「理由」を複数行で入力する項目。 | - | onChange=(event) => setDocumentShareReason(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:589 | confirmed |
| DocumentWorkspace | select | 選択してください | 「選択してください」を選ぶ選択項目。 | - | onChange=(event) => setDocumentMoveDestinationId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:598 | confirmed |
| DocumentWorkspace | input | 移動後の表示名 | 「移動後の表示名」を入力または選択する項目。 | - | onChange=(event) => setDocumentMoveNewTitle(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:599 | confirmed |
| DocumentWorkspace | textarea | 理由 | 「理由」を複数行で入力する項目。 | - | onChange=(event) => setDocumentMoveReason(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:602 | confirmed |
| DocumentFilePanel | input | ファイル名 | 「ファイル名」を入力または選択する項目。 | - | onChange=(event) => onDocumentQueryChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:140 | confirmed |
| DocumentFilePanel | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => onDocumentTypeFilterChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:144 | confirmed |
| DocumentFilePanel | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => onDocumentStatusFilterChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:153 | confirmed |
| DocumentFilePanel | select | すべて / 未設定 | 「すべて / 未設定」を選ぶ選択項目。 | - | onChange=(event) => onDocumentGroupFilterChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:162 | confirmed |
| DocumentFilePanel | select | 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順 | 「更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順」を選ぶ選択項目。 | - | onChange=(event) => onDocumentSortChange(event.target.value as DocumentSortKey) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:172 | confirmed |
| DocumentFilePanel | select | 表示件数 | 「表示件数」を選ぶ選択項目。 | - | onChange=(event) => onDocumentPageSizeChange(Number(event.target.value)) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:322 | confirmed |
| DocumentFolderTree | input | フォルダを検索 | 「フォルダを検索」を入力または選択する項目。 | - | onChange=(event) => onFolderSearchChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:28 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | button | 管理者設定へ戻る | 「管理者設定へ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:425 | confirmed |
| DocumentWorkspace | form | 共有フォルダ / 選択してください / 共有 group / 追加: / 削除: / 保存 | 「共有フォルダ / 選択してください / 共有 group / 追加: / 削除: / 保存」を入力・送信するフォーム。 | - | onSubmit=(event) => void onShareSubmit(event) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:524 | confirmed |
| DocumentWorkspace | label | 共有フォルダ / 選択してください | 「共有フォルダ / 選択してください」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:525 | confirmed |
| DocumentWorkspace | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => setShareGroupId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:525 | confirmed |
| DocumentWorkspace | option | 選択してください | 「選択してください」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:525 | confirmed |
| DocumentWorkspace | option | 共有フォルダ / 選択してください | 「共有フォルダ / 選択してください」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:525 | confirmed |
| DocumentWorkspace | label | 共有 group | 「共有 group」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:526 | confirmed |
| DocumentWorkspace | input | group をカンマ区切りで入力 | 「group をカンマ区切りで入力」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onChange=(event) => updateShareGroups(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:526 | confirmed |
| DocumentWorkspace | label | 既存共有をすべて削除することを確認しました | 「既存共有をすべて削除することを確認しました」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:528 | confirmed |
| DocumentWorkspace | input | 既存共有をすべて削除することを確認しました | 「既存共有をすべて削除することを確認しました」を入力または選択する項目。 | - | onChange=(event) => setShareClearConfirmed(event.target.checked) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:528 | confirmed |
| DocumentWorkspace | button | 保存 | 「保存」を実行するボタン。 | 状態: disabled=!canSubmitShare | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:529 | confirmed |
| DocumentWorkspace | form | 移動先: / 保存 | 「移動先: / 保存」を入力・送信するフォーム。 | - | onSubmit=(event) => void onEditGroupSubmit(event) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:535 | confirmed |
| DocumentWorkspace | label | フォルダ名 | 「フォルダ名」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:536 | confirmed |
| DocumentWorkspace | input | フォルダ名 | 「フォルダ名」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| !editTargetGroup | onChange=(event) => setEditGroupName(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:536 | confirmed |
| DocumentWorkspace | label | 移動先フォルダ / ルート | 「移動先フォルダ / ルート」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:537 | confirmed |
| DocumentWorkspace | select | ルート | 「ルート」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| !editTargetGroup | onChange=(event) => setEditGroupParentId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:537 | confirmed |
| DocumentWorkspace | option | ルート | 「ルート」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:537 | confirmed |
| DocumentWorkspace | option | 移動先フォルダ / ルート | 「移動先フォルダ / ルート」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:537 | confirmed |
| DocumentWorkspace | button | 保存 | 「保存」を実行するボタン。 | 状態: disabled=!editCanSubmit | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:539 | confirmed |
| DocumentWorkspace | form | 保存先フォルダ / 選択してください / アップロード先: / 文書アップロード / アップロード | 「保存先フォルダ / 選択してください / アップロード先: / 文書アップロード / アップロード」を入力・送信するフォーム。 | - | onSubmit=(event) => void onSubmit(event) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:545 | confirmed |
| DocumentWorkspace | label | 保存先フォルダ / 選択してください | 「保存先フォルダ / 選択してください」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:546 | confirmed |
| DocumentWorkspace | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.isUploading | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:548 | confirmed |
| DocumentWorkspace | option | 選択してください | 「選択してください」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:549 | confirmed |
| DocumentWorkspace | option | 保存先フォルダ / 選択してください | 「保存先フォルダ / 選択してください」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:551 | confirmed |
| DocumentWorkspace | label | 文書アップロード | 「文書アップロード」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:556 | confirmed |
| DocumentWorkspace | input | 文書アップロード | 「文書アップロード」を入力または選択する項目。 | - | onChange=(event) => onUploadFileChange(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:558 | confirmed |
| DocumentWorkspace | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!uploadFile \|\| !canUploadToDestination \|\| operationState.isUploading | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:560 | confirmed |
| DocumentWorkspace | form | ファイル名: / 現在の権限: / 継承: / 共有先種別 / 共有先ID / 権限 / 理由 / 保存 | 「ファイル名: / 現在の権限: / 継承: / 共有先種別 / 共有先ID / 権限 / 理由 / 保存」を入力・送信するフォーム。 | - | onSubmit=(event) => void onDocumentShareSubmit(event) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:566 | confirmed |
| DocumentWorkspace | button | 削除 | 「削除」を実行するボタン。 | - | onClick=() => setDocumentShareDraftGrants((current) => current.filter((item) => !(item.principalT… | apps/web/src/features/documents/components/DocumentWorkspace.tsx:577 | confirmed |
| DocumentWorkspace | label | 共有先種別 | 「共有先種別」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:586 | confirmed |
| DocumentWorkspace | select | user / group | 「user / group」を選ぶ選択項目。 | - | onChange=(event) => setDocumentSharePrincipalType(event.target.value as "user" \| "group") | apps/web/src/features/documents/components/DocumentWorkspace.tsx:586 | confirmed |
| DocumentWorkspace | option | user | 「user」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:586 | confirmed |
| DocumentWorkspace | option | group | 「group」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:586 | confirmed |
| DocumentWorkspace | label | 共有先ID | 「共有先ID」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:587 | confirmed |
| DocumentWorkspace | input | 共有先ID | 「共有先ID」を入力または選択する項目。 | - | onChange=(event) => setDocumentSharePrincipalId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:587 | confirmed |
| DocumentWorkspace | label | 権限 | 「権限」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:588 | confirmed |
| DocumentWorkspace | select | readOnly / full | 「readOnly / full」を選ぶ選択項目。 | - | onChange=(event) => setDocumentSharePermissionLevel(event.target.value as "readOnly" \| "full") | apps/web/src/features/documents/components/DocumentWorkspace.tsx:588 | confirmed |
| DocumentWorkspace | option | readOnly | 「readOnly」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:588 | confirmed |
| DocumentWorkspace | option | full | 「full」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:588 | confirmed |
| DocumentWorkspace | label | 理由 | 「理由」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:589 | confirmed |
| DocumentWorkspace | textarea | 理由 | 「理由」を複数行で入力する項目。 | - | onChange=(event) => setDocumentShareReason(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:589 | confirmed |
| DocumentWorkspace | button | 保存 | 「保存」を実行するボタン。 | 状態: disabled=!documentShareReason.trim() \|\| operationState.sharingDocumentId === documentShareTarget.d… | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:590 | confirmed |
| DocumentWorkspace | form | ファイル名: / 移動先フォルダ / 選択してください / 移動後の表示名 / 直接共有は維持され、継承共有は移動先フォルダの設定に変わります。 / 理由 / 移動 | 「ファイル名: / 移動先フォルダ / 選択してください / 移動後の表示名 / 直接共有は維持され、継承共有は移動先フォルダの設定に変わります。 / 理由 / 移動」を入力・送信するフォーム。 | - | onSubmit=(event) => void onDocumentMoveSubmit(event) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:596 | confirmed |
| DocumentWorkspace | label | 移動先フォルダ / 選択してください | 「移動先フォルダ / 選択してください」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:598 | confirmed |
| DocumentWorkspace | select | 選択してください | 「選択してください」を選ぶ選択項目。 | - | onChange=(event) => setDocumentMoveDestinationId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:598 | confirmed |
| DocumentWorkspace | option | 選択してください | 「選択してください」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:598 | confirmed |
| DocumentWorkspace | option | 移動先フォルダ / 選択してください | 「移動先フォルダ / 選択してください」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:598 | confirmed |
| DocumentWorkspace | label | 移動後の表示名 | 「移動後の表示名」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:599 | confirmed |
| DocumentWorkspace | input | 移動後の表示名 | 「移動後の表示名」を入力または選択する項目。 | - | onChange=(event) => setDocumentMoveNewTitle(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:599 | confirmed |
| DocumentWorkspace | label | 理由 | 「理由」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:602 | confirmed |
| DocumentWorkspace | textarea | 理由 | 「理由」を複数行で入力する項目。 | - | onChange=(event) => setDocumentMoveReason(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:602 | confirmed |
| DocumentWorkspace | button | 移動 | 「移動」を実行するボタン。 | 状態: disabled=!documentMoveDestinationId \|\| documentMoveNameConflict \|\| !documentMoveReason.trim() \|\| o… | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:603 | confirmed |
| WorkspaceModal | button | `${title}を閉じる` | 「`${title}を閉じる`」を実行するボタン。 | - | onClick=onClose | apps/web/src/features/documents/components/DocumentWorkspace.tsx:661 | confirmed |
| DocumentDetailDrawer | button | 文書詳細を閉じる | 「文書詳細を閉じる」を実行するボタン。 | - | onClick=onClose | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:61 | confirmed |
| DocumentDetailDrawer | button | この資料に質問する | 「この資料に質問する」を実行するボタン。 | 状態: disabled=!onAskDocument | onClick=() => onAskDocument?.() | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:88 | confirmed |
| DocumentDetailDrawer | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | onClick=onCopyDocumentId | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:92 | unknown |
| DocumentDetailDrawer | button | 再インデックス | 「再インデックス」を実行するボタン。 | 状態: disabled=!canReindex | onClick=onStageReindex | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:96 | confirmed |
| DocumentDetailDrawer | button | 削除 | 「削除」を実行するボタン。 | 状態: disabled=!canDelete | onClick=onDelete | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:100 | confirmed |
| DocumentFilePanel | button | フォルダ情報 | 「フォルダ情報」を実行するボタン。 | - | onClick=onOpenFolderInfo | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:129 | confirmed |
| DocumentFilePanel | button | フォルダ共有 | 「フォルダ共有」を実行するボタン。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | onClick=onOpenFolderShare | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:130 | confirmed |
| DocumentFilePanel | button | フォルダ名変更 | 「フォルダ名変更」を実行するボタン。 | 状態: disabled=!canWrite | onClick=onOpenFolderRename | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:131 | confirmed |
| DocumentFilePanel | button | フォルダ移動 | 「フォルダ移動」を実行するボタン。 | 状態: disabled=!canWrite | onClick=onOpenFolderMove | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:132 | confirmed |
| DocumentFilePanel | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!canWrite \|\| operationState.isUploading | onClick=onOpenUpload | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:133 | confirmed |
| DocumentFilePanel | label | ファイル名検索 | 「ファイル名検索」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:138 | confirmed |
| DocumentFilePanel | input | ファイル名 | 「ファイル名」を入力または選択する項目。 | - | onChange=(event) => onDocumentQueryChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:140 | confirmed |
| DocumentFilePanel | label | 種別 / すべて | 「種別 / すべて」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:142 | confirmed |
| DocumentFilePanel | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => onDocumentTypeFilterChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:144 | confirmed |
| DocumentFilePanel | option | すべて | 「すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:145 | confirmed |
| DocumentFilePanel | option | 種別 / すべて | 「種別 / すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:147 | confirmed |
| DocumentFilePanel | label | 状態 / すべて | 「状態 / すべて」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:151 | confirmed |
| DocumentFilePanel | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => onDocumentStatusFilterChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:153 | confirmed |
| DocumentFilePanel | option | すべて | 「すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:154 | confirmed |
| DocumentFilePanel | option | 状態 / すべて | 「状態 / すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:156 | confirmed |
| DocumentFilePanel | label | 所属フォルダ / すべて / 未設定 | 「所属フォルダ / すべて / 未設定」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:160 | confirmed |
| DocumentFilePanel | select | すべて / 未設定 | 「すべて / 未設定」を選ぶ選択項目。 | - | onChange=(event) => onDocumentGroupFilterChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:162 | confirmed |
| DocumentFilePanel | option | すべて | 「すべて」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:163 | confirmed |
| DocumentFilePanel | option | 未設定 | 「未設定」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:164 | confirmed |
| DocumentFilePanel | option | 所属フォルダ / すべて / 未設定 | 「所属フォルダ / すべて / 未設定」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:166 | confirmed |
| DocumentFilePanel | label | 並び替え / 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順 | 「並び替え / 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:170 | confirmed |
| DocumentFilePanel | select | 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順 | 「更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順」を選ぶ選択項目。 | - | onChange=(event) => onDocumentSortChange(event.target.value as DocumentSortKey) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:172 | confirmed |
| DocumentFilePanel | option | 更新日 新しい順 | 「更新日 新しい順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:173 | confirmed |
| DocumentFilePanel | option | 更新日 古い順 | 「更新日 古い順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:174 | confirmed |
| DocumentFilePanel | option | ファイル名順 | 「ファイル名順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:175 | confirmed |
| DocumentFilePanel | option | チャンク数順 | 「チャンク数順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:176 | confirmed |
| DocumentFilePanel | option | 種別順 | 「種別順」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:177 | confirmed |
| DocumentFilePanel | button | ファイルをアップロード | 「ファイルをアップロード」を実行するボタン。 | 状態: disabled=!canWrite \|\| !uploadGroupId | onClick=() => uploadInputRef.current?.click() | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:196 | confirmed |
| DocumentFilePanel | button | `${document.fileName}の詳細` | 「`${document.fileName}の詳細`」を実行するボタン。 | - | onClick=(event) => { event.stopPropagation() onSelectDocument(document) } | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:236 | confirmed |
| DocumentFilePanel | button | `${document.fileName}を共有` | 「`${document.fileName}を共有`」を実行するボタン。 | 状態: disabled=operationState.sharingDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() onShareDocument(document) } | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:248 | confirmed |
| DocumentFilePanel | button | `${document.fileName}を移動` | 「`${document.fileName}を移動`」を実行するボタン。 | 状態: disabled=operationState.movingDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() onMoveDocument(document) } | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:262 | confirmed |
| DocumentFilePanel | button | `${document.fileName}の再インデックスをステージング` | 「`${document.fileName}の再インデックスをステージング`」を実行するボタン。 | 状態: disabled=!canReindexRow \|\| operationState.stagingReindexDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() if (!canReindexRow) return onConfirmAction({ kind: "… | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:275 | confirmed |
| DocumentFilePanel | button | `${document.fileName}を削除` | 「`${document.fileName}を削除`」を実行するボタン。 | 状態: disabled=!canDeleteRow \|\| operationState.deletingDocumentId === document.documentId | onClick=(event) => { event.stopPropagation() if (!canDeleteRow) return onConfirmAction({ kind: "d… | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:288 | confirmed |
| DocumentFilePanel | label | 表示件数 | 「表示件数」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:320 | confirmed |
| DocumentFilePanel | select | 表示件数 | 「表示件数」を選ぶ選択項目。 | - | onChange=(event) => onDocumentPageSizeChange(Number(event.target.value)) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:322 | confirmed |
| DocumentFilePanel | option | 件 | 「件」を表す option 要素。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:324 | confirmed |
| DocumentFilePanel | button | 前のページ | 「前のページ」を実行するボタン。 | 状態: disabled=documentPage <= 1 \|\| filteredDocumentsCount === 0 | onClick=() => onDocumentPageChange(Math.max(1, documentPage - 1)) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:328 | confirmed |
| DocumentFilePanel | button | 次のページ | 「次のページ」を実行するボタン。 | 状態: disabled=documentPage >= documentPageCount \|\| filteredDocumentsCount === 0 | onClick=() => onDocumentPageChange(Math.min(documentPageCount, documentPage + 1)) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:337 | confirmed |
| ReindexMigrationStrip | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.cutoverMigrationId === migration.migrationId \|\| migration.status !== "stag… | onClick=() => onConfirmAction({ kind: "cutover", migration }) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:386 | unknown |
| ReindexMigrationStrip | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.rollbackMigrationId === migration.migrationId \|\| migration.status !== "cut… | onClick=() => onConfirmAction({ kind: "rollback", migration }) | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:389 | unknown |
| DocumentFolderTree | label | フォルダを検索 | 「フォルダを検索」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:27 | confirmed |
| DocumentFolderTree | input | フォルダを検索 | 「フォルダを検索」を入力または選択する項目。 | - | onChange=(event) => onFolderSearchChange(event.target.value) | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:28 | confirmed |
| DocumentFolderTree | button | フォルダ検索をクリア | 「フォルダ検索をクリア」を実行するボタン。 | 状態: disabled=!folderSearch | onClick=() => onFolderSearchChange("") | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:36 | confirmed |
| DocumentFolderTree | button | すべてのドキュメント | 「すべてのドキュメント」を実行するボタン。 | 状態: aria-current=selectedFolderId === "all" ? "true" : undefined | onClick=() => onSelectFolder("all", "") | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:41 | confirmed |
| DocumentFolderTree | button | `${folder.path} ${folder.count}件` | 「`${folder.path} ${folder.count}件`」を実行するボタン。 | 状態: aria-current=selectedFolder.id === folder.id ? "true" : undefined | onClick=() => onSelectFolder(folder.id, folder.group?.groupId ?? "") | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:58 | confirmed |
