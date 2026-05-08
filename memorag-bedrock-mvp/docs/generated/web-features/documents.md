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
| DocumentWorkspace | DocumentWorkspace は ドキュメント 領域の 画面または画面内 UI コンポーネント です。関連画面: ドキュメント。 | 画面または画面内 UI コンポーネント | apps/web/src/features/documents/components/DocumentWorkspace.tsx | DocumentWorkspace | FileIcon, Icon, LoadingSpinner, LoadingStatus, article, aside, button, dd, details, div, dl, dt, footer, form, h2, h3, header, input, label, li, nav, option, progress, section, select, small, span, strong, summary, ul |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | button | 管理者設定へ戻る | 「管理者設定へ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:128 | confirmed |
| DocumentWorkspace | button | フォルダを絞り込み | 「フォルダを絞り込み」を実行するボタン。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:154 | confirmed |
| DocumentWorkspace | button | すべてのドキュメント | 「すべてのドキュメント」を実行するボタン。 | 状態: aria-current=selectedFolderId === "all" ? "true" : undefined | onClick=() => setSelectedFolderId("all") | apps/web/src/features/documents/components/DocumentWorkspace.tsx:159 | confirmed |
| DocumentWorkspace | button | 社内規定 | 「社内規定」を実行するボタン。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:165 | confirmed |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=selectedFolder?.id === folder.id ? "true" : undefined | onClick=() => { setSelectedFolderId(folder.id) if (folder.group) onUploadGroupChange(folder.group… | apps/web/src/features/documents/components/DocumentWorkspace.tsx:172 | unknown |
| DocumentWorkspace | button | 新規フォルダ | 「新規フォルダ」を実行するボタン。 | 状態: disabled=!canWrite \|\| loading | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:203 | confirmed |
| DocumentWorkspace | button | 共有設定を開く | 「共有設定を開く」を実行するボタン。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:206 | confirmed |
| DocumentWorkspace | button | `${document.fileName}の再インデックスをステージング` | 「`${document.fileName}の再インデックスをステージング`」を実行するボタン。 | 状態: disabled=!canReindex \|\| loading | onClick=() => void onStageReindex(document.documentId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:251 | confirmed |
| DocumentWorkspace | button | 名前を変更 | 「名前を変更」を実行するボタン。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:263 | confirmed |
| DocumentWorkspace | button | 移動 | 「移動」を実行するボタン。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:267 | confirmed |
| DocumentWorkspace | button | `${document.fileName}を削除` | 「`${document.fileName}を削除`」を実行するボタン。 | 状態: disabled=!canDelete \|\| loading | onClick=() => onDelete(document.documentId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:271 | confirmed |
| DocumentWorkspace | button | 前のページ | 「前のページ」を実行するボタン。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:293 | confirmed |
| DocumentWorkspace | button | 次のページ | 「次のページ」を実行するボタン。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:297 | confirmed |
| DocumentWorkspace | button | 切替 | 「切替」を実行するボタン。 | 状態: disabled=loading \|\| migration.status !== "staged" | onClick=() => void onCutoverReindex(migration.migrationId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:313 | confirmed |
| DocumentWorkspace | button | 戻す | 「戻す」を実行するボタン。 | 状態: disabled=loading \|\| migration.status !== "cutover" | onClick=() => void onRollbackReindex(migration.migrationId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:314 | confirmed |
| DocumentWorkspace | button | 共有を編集 | 「共有を編集」を実行するボタン。 | 状態: disabled=!canWrite \|\| loading | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:350 | confirmed |
| DocumentWorkspace | button | 共有更新 | 「共有更新」を実行するボタン。 | 状態: disabled=!canWrite \|\| (!shareGroupId && !selectedGroupId) \|\| loading | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:366 | confirmed |
| DocumentWorkspace | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!canWrite \|\| !uploadFile \|\| loading | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:396 | confirmed |
| DocumentWorkspace | button | 新規フォルダ | 「新規フォルダ」を実行するボタン。 | 状態: disabled=!canWrite \|\| !groupName.trim() \|\| loading | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:406 | confirmed |
| DocumentWorkspace | button | すべて表示 | 「すべて表示」を実行するボタン。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:413 | confirmed |

## フォーム

| コンポーネント | ラベル | フォーム説明 | 状態・補足 | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | 共有フォルダ / 選択してください / 共有 Cognito group / 共有更新 | 「共有フォルダ / 選択してください / 共有 Cognito group / 共有更新」を入力・送信するフォーム。 | - | onSubmit=onShareSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:352 | confirmed |
| DocumentWorkspace | 保存先フォルダ / フォルダなし / アップロード | 「保存先フォルダ / フォルダなし / アップロード」を入力・送信するフォーム。 | - | onSubmit=onSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:381 | confirmed |
| DocumentWorkspace | 新規フォルダ / 新規フォルダ | 「新規フォルダ / 新規フォルダ」を入力・送信するフォーム。 | - | onSubmit=onCreateGroupSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:401 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | input | フォルダを検索 | 「フォルダを検索」を入力または選択する項目。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:152 | confirmed |
| DocumentWorkspace | input | `${document.fileName}を選択` | 「`${document.fileName}を選択`」を入力または選択する項目。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:229 | confirmed |
| DocumentWorkspace | input | `${document.fileName}を再インデックス対象にする` | 「`${document.fileName}を再インデックス対象にする`」を入力または選択する項目。 | 状態: disabled=!canReindex \|\| loading | onChange=(event) => { if (event.target.checked) void onStageReindex(document.documentId) } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:240 | confirmed |
| DocumentWorkspace | select | 表示件数 | 「表示件数」を選ぶ選択項目。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:301 | confirmed |
| DocumentWorkspace | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| loading | onChange=(event) => setShareGroupId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:355 | confirmed |
| DocumentWorkspace | input | CHAT_USER,RAG_GROUP | 「CHAT_USER,RAG_GROUP」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| loading | onChange=(event) => setShareGroups(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:364 | confirmed |
| DocumentWorkspace | select | フォルダなし | 「フォルダなし」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| loading | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:384 | confirmed |
| DocumentWorkspace | input | アップロードする文書を選択 | 「アップロードする文書を選択」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| loading | onChange=(event) => setUploadFile(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:394 | confirmed |
| DocumentWorkspace | input | 2026 | 「2026」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| loading | onChange=(event) => setGroupName(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:404 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | button | 管理者設定へ戻る | 「管理者設定へ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:128 | confirmed |
| DocumentWorkspace | label | フォルダを検索 | 「フォルダを検索」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:150 | confirmed |
| DocumentWorkspace | input | フォルダを検索 | 「フォルダを検索」を入力または選択する項目。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:152 | confirmed |
| DocumentWorkspace | button | フォルダを絞り込み | 「フォルダを絞り込み」を実行するボタン。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:154 | confirmed |
| DocumentWorkspace | button | すべてのドキュメント | 「すべてのドキュメント」を実行するボタン。 | 状態: aria-current=selectedFolderId === "all" ? "true" : undefined | onClick=() => setSelectedFolderId("all") | apps/web/src/features/documents/components/DocumentWorkspace.tsx:159 | confirmed |
| DocumentWorkspace | button | 社内規定 | 「社内規定」を実行するボタン。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:165 | confirmed |
| DocumentWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=selectedFolder?.id === folder.id ? "true" : undefined | onClick=() => { setSelectedFolderId(folder.id) if (folder.group) onUploadGroupChange(folder.group… | apps/web/src/features/documents/components/DocumentWorkspace.tsx:172 | unknown |
| DocumentWorkspace | button | 新規フォルダ | 「新規フォルダ」を実行するボタン。 | 状態: disabled=!canWrite \|\| loading | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:203 | confirmed |
| DocumentWorkspace | button | 共有設定を開く | 「共有設定を開く」を実行するボタン。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:206 | confirmed |
| DocumentWorkspace | input | `${document.fileName}を選択` | 「`${document.fileName}を選択`」を入力または選択する項目。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:229 | confirmed |
| DocumentWorkspace | input | `${document.fileName}を再インデックス対象にする` | 「`${document.fileName}を再インデックス対象にする`」を入力または選択する項目。 | 状態: disabled=!canReindex \|\| loading | onChange=(event) => { if (event.target.checked) void onStageReindex(document.documentId) } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:240 | confirmed |
| DocumentWorkspace | button | `${document.fileName}の再インデックスをステージング` | 「`${document.fileName}の再インデックスをステージング`」を実行するボタン。 | 状態: disabled=!canReindex \|\| loading | onClick=() => void onStageReindex(document.documentId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:251 | confirmed |
| DocumentWorkspace | summary | `${document.fileName}の操作メニュー` | 「`${document.fileName}の操作メニュー`」の詳細を開閉する要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:261 | confirmed |
| DocumentWorkspace | button | 名前を変更 | 「名前を変更」を実行するボタン。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:263 | confirmed |
| DocumentWorkspace | button | 移動 | 「移動」を実行するボタン。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:267 | confirmed |
| DocumentWorkspace | button | `${document.fileName}を削除` | 「`${document.fileName}を削除`」を実行するボタン。 | 状態: disabled=!canDelete \|\| loading | onClick=() => onDelete(document.documentId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:271 | confirmed |
| DocumentWorkspace | button | 前のページ | 「前のページ」を実行するボタン。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:293 | confirmed |
| DocumentWorkspace | button | 次のページ | 「次のページ」を実行するボタン。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:297 | confirmed |
| DocumentWorkspace | select | 表示件数 | 「表示件数」を選ぶ選択項目。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:301 | confirmed |
| DocumentWorkspace | option | 20 件 / ページ | 「20 件 / ページ」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:302 | confirmed |
| DocumentWorkspace | option | 50 件 / ページ | 「50 件 / ページ」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:303 | confirmed |
| DocumentWorkspace | button | 切替 | 「切替」を実行するボタン。 | 状態: disabled=loading \|\| migration.status !== "staged" | onClick=() => void onCutoverReindex(migration.migrationId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:313 | confirmed |
| DocumentWorkspace | button | 戻す | 「戻す」を実行するボタン。 | 状態: disabled=loading \|\| migration.status !== "cutover" | onClick=() => void onRollbackReindex(migration.migrationId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:314 | confirmed |
| DocumentWorkspace | button | 共有を編集 | 「共有を編集」を実行するボタン。 | 状態: disabled=!canWrite \|\| loading | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:350 | confirmed |
| DocumentWorkspace | form | 共有フォルダ / 選択してください / 共有 Cognito group / 共有更新 | 「共有フォルダ / 選択してください / 共有 Cognito group / 共有更新」を入力・送信するフォーム。 | - | onSubmit=onShareSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:352 | confirmed |
| DocumentWorkspace | label | 共有フォルダ / 選択してください | 「共有フォルダ / 選択してください」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:353 | confirmed |
| DocumentWorkspace | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| loading | onChange=(event) => setShareGroupId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:355 | confirmed |
| DocumentWorkspace | option | 選択してください | 「選択してください」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:356 | confirmed |
| DocumentWorkspace | option | 共有フォルダ / 選択してください | 「共有フォルダ / 選択してください」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:358 | confirmed |
| DocumentWorkspace | label | 共有 Cognito group | 「共有 Cognito group」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:362 | confirmed |
| DocumentWorkspace | input | CHAT_USER,RAG_GROUP | 「CHAT_USER,RAG_GROUP」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| loading | onChange=(event) => setShareGroups(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:364 | confirmed |
| DocumentWorkspace | button | 共有更新 | 「共有更新」を実行するボタン。 | 状態: disabled=!canWrite \|\| (!shareGroupId && !selectedGroupId) \|\| loading | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:366 | confirmed |
| DocumentWorkspace | form | 保存先フォルダ / フォルダなし / アップロード | 「保存先フォルダ / フォルダなし / アップロード」を入力・送信するフォーム。 | - | onSubmit=onSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:381 | confirmed |
| DocumentWorkspace | label | 保存先フォルダ / フォルダなし | 「保存先フォルダ / フォルダなし」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:382 | confirmed |
| DocumentWorkspace | select | フォルダなし | 「フォルダなし」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| loading | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:384 | confirmed |
| DocumentWorkspace | option | フォルダなし | 「フォルダなし」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:385 | confirmed |
| DocumentWorkspace | option | 保存先フォルダ / フォルダなし | 「保存先フォルダ / フォルダなし」を表す option 要素。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:387 | confirmed |
| DocumentWorkspace | label | 文書アップロード | 「文書アップロード」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:391 | confirmed |
| DocumentWorkspace | input | アップロードする文書を選択 | 「アップロードする文書を選択」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| loading | onChange=(event) => setUploadFile(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:394 | confirmed |
| DocumentWorkspace | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!canWrite \|\| !uploadFile \|\| loading | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:396 | confirmed |
| DocumentWorkspace | form | 新規フォルダ / 新規フォルダ | 「新規フォルダ / 新規フォルダ」を入力・送信するフォーム。 | - | onSubmit=onCreateGroupSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:401 | confirmed |
| DocumentWorkspace | label | 新規フォルダ | 「新規フォルダ」に紐づく入力ラベル。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:402 | confirmed |
| DocumentWorkspace | input | 2026 | 「2026」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| loading | onChange=(event) => setGroupName(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:404 | confirmed |
| DocumentWorkspace | button | 新規フォルダ | 「新規フォルダ」を実行するボタン。 | 状態: disabled=!canWrite \|\| !groupName.trim() \|\| loading | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:406 | confirmed |
| DocumentWorkspace | button | すべて表示 | 「すべて表示」を実行するボタン。 | - | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:413 | confirmed |
