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

| コンポーネント | 要素 | ラベル | アクセシブル名 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | button | 管理者設定へ戻る | 管理者設定へ戻る (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:128 | confirmed |
| DocumentWorkspace | button | フォルダを絞り込み | フォルダを絞り込み (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:154 | confirmed |
| DocumentWorkspace | button | すべてのドキュメント / documents.length | すべてのドキュメント / documents.length (visible-text) | aria-current=selectedFolderId === "all" ? "true" : undefined | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => setSelectedFolderId("all") | apps/web/src/features/documents/components/DocumentWorkspace.tsx:159 | confirmed |
| DocumentWorkspace | button | 社内規定 / Math.max(documents.length, 86) | 社内規定 / Math.max(documents.length, 86) (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:165 | confirmed |
| DocumentWorkspace | button | folder.name / folder.count | folder.name / folder.count (visible-text) | aria-current=selectedFolder?.id === folder.id ? "true" : undefined | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => { setSelectedFolderId(folder.id) if (folder.group) onUploadGroupChange(folder.group… | apps/web/src/features/documents/components/DocumentWorkspace.tsx:172 | confirmed |
| DocumentWorkspace | button | 新規フォルダ | 新規フォルダ (title) | disabled=!canWrite \|\| loading | warning: アイコン中心の操作は aria-label または aria-labelledby で用途を明示してください。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:203 | confirmed |
| DocumentWorkspace | button | 共有設定を開く | 共有設定を開く (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:206 | confirmed |
| DocumentWorkspace | button | `${document.fileName}の再インデックスをステージング` | `${document.fileName}の再インデックスをステージング` (aria-label) | disabled=!canReindex \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => void onStageReindex(document.documentId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:251 | confirmed |
| DocumentWorkspace | button | 名前を変更 | 名前を変更 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:263 | confirmed |
| DocumentWorkspace | button | 移動 | 移動 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:267 | confirmed |
| DocumentWorkspace | button | `${document.fileName}を削除` | `${document.fileName}を削除` (aria-label) | disabled=!canDelete \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => onDelete(document.documentId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:271 | confirmed |
| DocumentWorkspace | button | 前のページ | 前のページ (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:293 | confirmed |
| DocumentWorkspace | button | 次のページ | 次のページ (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:297 | confirmed |
| DocumentWorkspace | button | 切替 | 切替 (visible-text) | disabled=loading \|\| migration.status !== "staged" | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onCutoverReindex(migration.migrationId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:313 | confirmed |
| DocumentWorkspace | button | 戻す | 戻す (visible-text) | disabled=loading \|\| migration.status !== "cutover" | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onRollbackReindex(migration.migrationId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:314 | confirmed |
| DocumentWorkspace | button | 共有を編集 | 共有を編集 (visible-text) | disabled=!canWrite \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:350 | confirmed |
| DocumentWorkspace | button | 共有更新 | 共有更新 (visible-text) | disabled=!canWrite \|\| (!shareGroupId && !selectedGroupId) \|\| loading | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:366 | confirmed |
| DocumentWorkspace | button | loading && <LoadingSpinner className="button-spinner" /> / アップロード | loading && <LoadingSpinner className="button-spinner" /> / アップロード (visible-text) | disabled=!canWrite \|\| !uploadFile \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:396 | confirmed |
| DocumentWorkspace | button | 新規フォルダ | 新規フォルダ (visible-text) | disabled=!canWrite \|\| !groupName.trim() \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:406 | confirmed |
| DocumentWorkspace | button | すべて表示 | すべて表示 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:413 | confirmed |

## フォーム

| コンポーネント | ラベル | 説明参照 | a11y | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | 共有フォルダ / 選択してください / documentGroups.map((group) => ( <option value={group.groupI… | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSubmit=onShareSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:352 | confirmed |
| DocumentWorkspace | 保存先フォルダ / フォルダなし / documentGroups.map((group) => ( <option value={group.groupId… | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSubmit=onSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:381 | confirmed |
| DocumentWorkspace | 新規フォルダ / 新規フォルダ | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSubmit=onCreateGroupSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:401 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | アクセシブル名 | 説明参照 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | input | フォルダを検索 | フォルダを検索 (placeholder) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:152 | confirmed |
| DocumentWorkspace | input | `${document.fileName}を選択` | `${document.fileName}を選択` (aria-label) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:229 | confirmed |
| DocumentWorkspace | input | `${document.fileName}を再インデックス対象にする` | `${document.fileName}を再インデックス対象にする` (aria-label) | - | disabled=!canReindex \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => { if (event.target.checked) void onStageReindex(document.documentId) } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:240 | confirmed |
| DocumentWorkspace | select | 表示件数 | 表示件数 (aria-label) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:301 | confirmed |
| DocumentWorkspace | select | shareGroupId \|\| selectedGroupId | 選択してください / documentGroups.map((group) => ( <option value={group.groupId} key={group.groupI… (visible-text) | - | disabled=!canWrite \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setShareGroupId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:355 | confirmed |
| DocumentWorkspace | input | CHAT_USER,RAG_GROUP | CHAT_USER,RAG_GROUP (placeholder) | - | disabled=!canWrite \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setShareGroups(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:364 | confirmed |
| DocumentWorkspace | select | uploadGroupId | フォルダなし / documentGroups.map((group) => ( <option value={group.groupId} key={group.groupI… (visible-text) | - | disabled=!canWrite \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:384 | confirmed |
| DocumentWorkspace | input | アップロードする文書を選択 | アップロードする文書を選択 (aria-label) | - | disabled=!canWrite \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setUploadFile(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:394 | confirmed |
| DocumentWorkspace | input | 2026 | 2026 (placeholder) | - | disabled=!canWrite \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setGroupName(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:404 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | アクセシブル名 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DocumentWorkspace | button | 管理者設定へ戻る | 管理者設定へ戻る (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:128 | confirmed |
| DocumentWorkspace | label | フォルダを検索 | フォルダを検索 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:150 | confirmed |
| DocumentWorkspace | input | フォルダを検索 | フォルダを検索 (placeholder) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:152 | confirmed |
| DocumentWorkspace | button | フォルダを絞り込み | フォルダを絞り込み (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:154 | confirmed |
| DocumentWorkspace | button | すべてのドキュメント / documents.length | すべてのドキュメント / documents.length (visible-text) | aria-current=selectedFolderId === "all" ? "true" : undefined | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => setSelectedFolderId("all") | apps/web/src/features/documents/components/DocumentWorkspace.tsx:159 | confirmed |
| DocumentWorkspace | button | 社内規定 / Math.max(documents.length, 86) | 社内規定 / Math.max(documents.length, 86) (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:165 | confirmed |
| DocumentWorkspace | button | folder.name / folder.count | folder.name / folder.count (visible-text) | aria-current=selectedFolder?.id === folder.id ? "true" : undefined | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => { setSelectedFolderId(folder.id) if (folder.group) onUploadGroupChange(folder.group… | apps/web/src/features/documents/components/DocumentWorkspace.tsx:172 | confirmed |
| DocumentWorkspace | button | 新規フォルダ | 新規フォルダ (title) | disabled=!canWrite \|\| loading | warning: アイコン中心の操作は aria-label または aria-labelledby で用途を明示してください。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:203 | confirmed |
| DocumentWorkspace | button | 共有設定を開く | 共有設定を開く (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:206 | confirmed |
| DocumentWorkspace | input | `${document.fileName}を選択` | `${document.fileName}を選択` (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:229 | confirmed |
| DocumentWorkspace | input | `${document.fileName}を再インデックス対象にする` | `${document.fileName}を再インデックス対象にする` (aria-label) | disabled=!canReindex \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => { if (event.target.checked) void onStageReindex(document.documentId) } | apps/web/src/features/documents/components/DocumentWorkspace.tsx:240 | confirmed |
| DocumentWorkspace | button | `${document.fileName}の再インデックスをステージング` | `${document.fileName}の再インデックスをステージング` (aria-label) | disabled=!canReindex \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => void onStageReindex(document.documentId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:251 | confirmed |
| DocumentWorkspace | summary | `${document.fileName}の操作メニュー` | `${document.fileName}の操作メニュー` (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:261 | confirmed |
| DocumentWorkspace | button | 名前を変更 | 名前を変更 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:263 | confirmed |
| DocumentWorkspace | button | 移動 | 移動 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:267 | confirmed |
| DocumentWorkspace | button | `${document.fileName}を削除` | `${document.fileName}を削除` (aria-label) | disabled=!canDelete \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => onDelete(document.documentId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:271 | confirmed |
| DocumentWorkspace | button | 前のページ | 前のページ (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:293 | confirmed |
| DocumentWorkspace | button | 次のページ | 次のページ (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:297 | confirmed |
| DocumentWorkspace | select | 表示件数 | 表示件数 (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:301 | confirmed |
| DocumentWorkspace | option | 20 件/ページ | 20 件/ページ (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:302 | confirmed |
| DocumentWorkspace | option | 50 件/ページ | 50 件/ページ (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:303 | confirmed |
| DocumentWorkspace | button | 切替 | 切替 (visible-text) | disabled=loading \|\| migration.status !== "staged" | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onCutoverReindex(migration.migrationId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:313 | confirmed |
| DocumentWorkspace | button | 戻す | 戻す (visible-text) | disabled=loading \|\| migration.status !== "cutover" | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onRollbackReindex(migration.migrationId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:314 | confirmed |
| DocumentWorkspace | button | 共有を編集 | 共有を編集 (visible-text) | disabled=!canWrite \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:350 | confirmed |
| DocumentWorkspace | form | 共有フォルダ / 選択してください / documentGroups.map((group) => ( <option value={group.groupI… | 共有フォルダ / 選択してください / documentGroups.map((group) => ( <option value={group.groupId} key={group.groupI… / 共有 Cognito group… (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSubmit=onShareSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:352 | confirmed |
| DocumentWorkspace | label | 共有フォルダ / 選択してください / documentGroups.map((group) => ( <option value={group.groupI… | 共有フォルダ / 選択してください / documentGroups.map((group) => ( <option value={group.groupId} key={group.groupI… (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:353 | confirmed |
| DocumentWorkspace | select | shareGroupId \|\| selectedGroupId | 選択してください / documentGroups.map((group) => ( <option value={group.groupId} key={group.groupI… (visible-text) | disabled=!canWrite \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setShareGroupId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:355 | confirmed |
| DocumentWorkspace | option | 選択してください | 選択してください (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:356 | confirmed |
| DocumentWorkspace | option | group.groupId | group.name (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:358 | confirmed |
| DocumentWorkspace | label | 共有 Cognito group | 共有 Cognito group (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:362 | confirmed |
| DocumentWorkspace | input | CHAT_USER,RAG_GROUP | CHAT_USER,RAG_GROUP (placeholder) | disabled=!canWrite \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setShareGroups(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:364 | confirmed |
| DocumentWorkspace | button | 共有更新 | 共有更新 (visible-text) | disabled=!canWrite \|\| (!shareGroupId && !selectedGroupId) \|\| loading | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:366 | confirmed |
| DocumentWorkspace | form | 保存先フォルダ / フォルダなし / documentGroups.map((group) => ( <option value={group.groupId… | 保存先フォルダ / フォルダなし / documentGroups.map((group) => ( <option value={group.groupId} key={group.groupI… / uploadFile ? uplo… (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSubmit=onSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:381 | confirmed |
| DocumentWorkspace | label | 保存先フォルダ / フォルダなし / documentGroups.map((group) => ( <option value={group.groupId… | 保存先フォルダ / フォルダなし / documentGroups.map((group) => ( <option value={group.groupId} key={group.groupI… (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:382 | confirmed |
| DocumentWorkspace | select | uploadGroupId | フォルダなし / documentGroups.map((group) => ( <option value={group.groupId} key={group.groupI… (visible-text) | disabled=!canWrite \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:384 | confirmed |
| DocumentWorkspace | option | フォルダなし | フォルダなし (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:385 | confirmed |
| DocumentWorkspace | option | group.groupId | group.name (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:387 | confirmed |
| DocumentWorkspace | label | 文書アップロード | 文書アップロード (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:391 | confirmed |
| DocumentWorkspace | input | アップロードする文書を選択 | アップロードする文書を選択 (aria-label) | disabled=!canWrite \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setUploadFile(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:394 | confirmed |
| DocumentWorkspace | button | loading && <LoadingSpinner className="button-spinner" /> / アップロード | loading && <LoadingSpinner className="button-spinner" /> / アップロード (visible-text) | disabled=!canWrite \|\| !uploadFile \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:396 | confirmed |
| DocumentWorkspace | form | 新規フォルダ / 新規フォルダ | 新規フォルダ / 新規フォルダ (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSubmit=onCreateGroupSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:401 | confirmed |
| DocumentWorkspace | label | 新規フォルダ | 新規フォルダ (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:402 | confirmed |
| DocumentWorkspace | input | 2026 | 2026 (placeholder) | disabled=!canWrite \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setGroupName(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:404 | confirmed |
| DocumentWorkspace | button | 新規フォルダ | 新規フォルダ (visible-text) | disabled=!canWrite \|\| !groupName.trim() \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:406 | confirmed |
| DocumentWorkspace | button | すべて表示 | すべて表示 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:413 | confirmed |
