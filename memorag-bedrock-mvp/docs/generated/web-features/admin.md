# Web 機能詳細: 管理

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## 概要

管理者向けのユーザー、ロール、利用状況、コスト、alias review / publish を扱う領域です。

## 関連画面

| 表示名 | view | 画面コンポーネント | 権限条件 | 説明 |
| --- | --- | --- | --- | --- |
| 管理者設定 | admin | AdminWorkspace | canSeeAdminSettings | 管理者設定。文書管理、担当者対応、debug / benchmark、ユーザー管理、alias 管理などの入口になります。 |

## コンポーネント

| コンポーネント | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- |
| AdminWorkspace | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/AdminWorkspace.tsx | AdminWorkspace | AdminCreateUserForm, AliasAdminPanel, Icon, LoadingSpinner, LoadingStatus, ManagedUserRow, article, button, div, form, h2, h3, header, i, input, label, option, p, section, select, small, span, strong, time |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | アクセシブル名 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AdminWorkspace | button | チャットへ戻る | チャットへ戻る (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onBack | apps/web/src/features/admin/components/AdminWorkspace.tsx:108 | confirmed |
| AdminWorkspace | button | ドキュメント管理 / documentsCount / 件 | ドキュメント管理 / documentsCount / 件 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onOpenDocuments | apps/web/src/features/admin/components/AdminWorkspace.tsx:120 | confirmed |
| AdminWorkspace | button | 担当者対応 / openQuestionsCount / 件が対応待ち | 担当者対応 / openQuestionsCount / 件が対応待ち (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onOpenAssignee | apps/web/src/features/admin/components/AdminWorkspace.tsx:127 | confirmed |
| AdminWorkspace | button | デバッグ / 評価 / debugRunsCount / 件の実行履歴 | デバッグ / 評価 / debugRunsCount / 件の実行履歴 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onOpenDebug | apps/web/src/features/admin/components/AdminWorkspace.tsx:134 | confirmed |
| AdminWorkspace | button | 性能テスト / benchmarkRunsCount / 件の実行履歴 | 性能テスト / benchmarkRunsCount / 件の実行履歴 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onOpenBenchmark | apps/web/src/features/admin/components/AdminWorkspace.tsx:141 | confirmed |
| AdminWorkspace | button | loading && <LoadingSpinner className="button-spinner" /> / 更新 | loading && <LoadingSpinner className="button-spinner" /> / 更新 (visible-text) | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => void onRefreshAdminData() | apps/web/src/features/admin/components/AdminWorkspace.tsx:206 | confirmed |
| AliasAdminPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 公開 | loading && <LoadingSpinner className="button-spinner" /> / 公開 (visible-text) | disabled=!canPublish \|\| loading | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onPublish() | apps/web/src/features/admin/components/AdminWorkspace.tsx:405 | confirmed |
| AliasAdminPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 追加 | loading && <LoadingSpinner className="button-spinner" /> / 追加 (visible-text) | disabled=loading \|\| !term.trim() \|\| parseExpansionList(expansions).length === 0 | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:426 | confirmed |
| AliasAdminPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 下書き化 | loading && <LoadingSpinner className="button-spinner" /> / 下書き化 (visible-text) | disabled=!canWrite \|\| loading \|\| alias.status === "disabled" | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => void onUpdate(alias.aliasId, { expansions: alias.expansions }) | apps/web/src/features/admin/components/AdminWorkspace.tsx:445 | confirmed |
| AliasAdminPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 承認 | loading && <LoadingSpinner className="button-spinner" /> / 承認 (visible-text) | disabled=!canReview \|\| loading \|\| alias.status === "disabled" | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onReview(alias.aliasId, "approve") | apps/web/src/features/admin/components/AdminWorkspace.tsx:449 | confirmed |
| AliasAdminPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 差戻 | loading && <LoadingSpinner className="button-spinner" /> / 差戻 (visible-text) | disabled=!canReview \|\| loading \|\| alias.status === "disabled" | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onReview(alias.aliasId, "reject", "Rejected from UI") | apps/web/src/features/admin/components/AdminWorkspace.tsx:453 | confirmed |
| AliasAdminPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 無効 | loading && <LoadingSpinner className="button-spinner" /> / 無効 (visible-text) | disabled=!canDisable \|\| loading \|\| alias.status === "disabled" | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onDisable(alias.aliasId) | apps/web/src/features/admin/components/AdminWorkspace.tsx:457 | confirmed |
| AdminCreateUserForm | button | loading && <LoadingSpinner className="button-spinner" /> / 作成 | loading && <LoadingSpinner className="button-spinner" /> / 作成 (visible-text) | disabled=loading \|\| email.trim().length === 0 | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:530 | confirmed |
| ManagedUserRow | button | loading && <LoadingSpinner className="button-spinner" /> / 付与 | loading && <LoadingSpinner className="button-spinner" /> / 付与 (visible-text) | disabled=!canAssignRoles \|\| loading \|\| user.groups.includes(selectedRole) | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onAssignRoles(user.userId, [selectedRole]) | apps/web/src/features/admin/components/AdminWorkspace.tsx:581 | confirmed |
| ManagedUserRow | button | loading && <LoadingSpinner className="button-spinner" /> / 再開 | loading && <LoadingSpinner className="button-spinner" /> / 再開 (visible-text) | disabled=!canUnsuspend \|\| loading | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onSetStatus(user.userId, "unsuspend") | apps/web/src/features/admin/components/AdminWorkspace.tsx:591 | confirmed |
| ManagedUserRow | button | loading && <LoadingSpinner className="button-spinner" /> / 停止 | loading && <LoadingSpinner className="button-spinner" /> / 停止 (visible-text) | disabled=!canSuspend \|\| loading | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onSetStatus(user.userId, "suspend") | apps/web/src/features/admin/components/AdminWorkspace.tsx:596 | confirmed |
| ManagedUserRow | button | loading && <LoadingSpinner className="button-spinner" /> / 削除 | loading && <LoadingSpinner className="button-spinner" /> / 削除 (visible-text) | disabled=!canDelete \|\| loading | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onSetStatus(user.userId, "delete") | apps/web/src/features/admin/components/AdminWorkspace.tsx:601 | confirmed |

## フォーム

| コンポーネント | ラベル | 説明参照 | a11y | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| AliasAdminPanel | 用語 / 展開語 / 部署 scope / loading && <LoadingSpinner className="button-spinner" /> … | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSubmit=(event) => void onSubmit(event) | apps/web/src/features/admin/components/AdminWorkspace.tsx:413 | confirmed |
| AdminCreateUserForm | 管理対象ユーザー作成 | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSubmit=(event) => void submit(event) | apps/web/src/features/admin/components/AdminWorkspace.tsx:513 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | アクセシブル名 | 説明参照 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AliasAdminPanel | input | pto | pto (placeholder) | - | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setTerm(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:416 | confirmed |
| AliasAdminPanel | input | 有給休暇, 休暇申請 | 有給休暇, 休暇申請 (placeholder) | - | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setExpansions(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:420 | confirmed |
| AliasAdminPanel | input | 任意 | 任意 (placeholder) | - | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setDepartment(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:424 | confirmed |
| AdminCreateUserForm | input | new-user@example.com | new-user@example.com (placeholder) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setEmail(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:516 | confirmed |
| AdminCreateUserForm | input | 任意 | 任意 (placeholder) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setDisplayName(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:520 | confirmed |
| AdminCreateUserForm | select | role | roles.map((roleDefinition) => ( <option value={roleDefinition.role} key={roleDe… (visible-text) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setRole(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:524 | confirmed |
| ManagedUserRow | select | `${user.email}に付与するロール` | `${user.email}に付与するロール` (aria-label) | - | disabled=!canAssignRoles \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setSelectedRole(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:576 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | アクセシブル名 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AdminWorkspace | button | チャットへ戻る | チャットへ戻る (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onBack | apps/web/src/features/admin/components/AdminWorkspace.tsx:108 | confirmed |
| AdminWorkspace | button | ドキュメント管理 / documentsCount / 件 | ドキュメント管理 / documentsCount / 件 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onOpenDocuments | apps/web/src/features/admin/components/AdminWorkspace.tsx:120 | confirmed |
| AdminWorkspace | button | 担当者対応 / openQuestionsCount / 件が対応待ち | 担当者対応 / openQuestionsCount / 件が対応待ち (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onOpenAssignee | apps/web/src/features/admin/components/AdminWorkspace.tsx:127 | confirmed |
| AdminWorkspace | button | デバッグ / 評価 / debugRunsCount / 件の実行履歴 | デバッグ / 評価 / debugRunsCount / 件の実行履歴 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onOpenDebug | apps/web/src/features/admin/components/AdminWorkspace.tsx:134 | confirmed |
| AdminWorkspace | button | 性能テスト / benchmarkRunsCount / 件の実行履歴 | 性能テスト / benchmarkRunsCount / 件の実行履歴 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onOpenBenchmark | apps/web/src/features/admin/components/AdminWorkspace.tsx:141 | confirmed |
| AdminWorkspace | AliasAdminPanel | 未推定 | 未推定 (missing) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onCreate=onCreateAlias<br>onUpdate=onUpdateAlias<br>onReview=onReviewAlias<br>onDisable=onDisableAlias<br>onPublish=onPublishAliases | apps/web/src/features/admin/components/AdminWorkspace.tsx:186 | unknown |
| AdminWorkspace | button | loading && <LoadingSpinner className="button-spinner" /> / 更新 | loading && <LoadingSpinner className="button-spinner" /> / 更新 (visible-text) | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => void onRefreshAdminData() | apps/web/src/features/admin/components/AdminWorkspace.tsx:206 | confirmed |
| AdminWorkspace | AdminCreateUserForm | 未推定 | 未推定 (missing) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onCreateUser=onCreateUser | apps/web/src/features/admin/components/AdminWorkspace.tsx:212 | unknown |
| AdminWorkspace | ManagedUserRow | 未推定 | 未推定 (missing) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onAssignRoles=onAssignRoles<br>onSetStatus=onSetUserStatus | apps/web/src/features/admin/components/AdminWorkspace.tsx:225 | unknown |
| AliasAdminPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 公開 | loading && <LoadingSpinner className="button-spinner" /> / 公開 (visible-text) | disabled=!canPublish \|\| loading | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onPublish() | apps/web/src/features/admin/components/AdminWorkspace.tsx:405 | confirmed |
| AliasAdminPanel | form | 用語 / 展開語 / 部署 scope / loading && <LoadingSpinner className="button-spinner" /> … | 用語 / 展開語 / 部署 scope / loading && <LoadingSpinner className="button-spinner" /> / 追加 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSubmit=(event) => void onSubmit(event) | apps/web/src/features/admin/components/AdminWorkspace.tsx:413 | confirmed |
| AliasAdminPanel | label | 用語 | 用語 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:414 | confirmed |
| AliasAdminPanel | input | pto | pto (placeholder) | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setTerm(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:416 | confirmed |
| AliasAdminPanel | label | 展開語 | 展開語 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:418 | confirmed |
| AliasAdminPanel | input | 有給休暇, 休暇申請 | 有給休暇, 休暇申請 (placeholder) | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setExpansions(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:420 | confirmed |
| AliasAdminPanel | label | 部署 scope | 部署 scope (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:422 | confirmed |
| AliasAdminPanel | input | 任意 | 任意 (placeholder) | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setDepartment(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:424 | confirmed |
| AliasAdminPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 追加 | loading && <LoadingSpinner className="button-spinner" /> / 追加 (visible-text) | disabled=loading \|\| !term.trim() \|\| parseExpansionList(expansions).length === 0 | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:426 | confirmed |
| AliasAdminPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 下書き化 | loading && <LoadingSpinner className="button-spinner" /> / 下書き化 (visible-text) | disabled=!canWrite \|\| loading \|\| alias.status === "disabled" | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => void onUpdate(alias.aliasId, { expansions: alias.expansions }) | apps/web/src/features/admin/components/AdminWorkspace.tsx:445 | confirmed |
| AliasAdminPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 承認 | loading && <LoadingSpinner className="button-spinner" /> / 承認 (visible-text) | disabled=!canReview \|\| loading \|\| alias.status === "disabled" | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onReview(alias.aliasId, "approve") | apps/web/src/features/admin/components/AdminWorkspace.tsx:449 | confirmed |
| AliasAdminPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 差戻 | loading && <LoadingSpinner className="button-spinner" /> / 差戻 (visible-text) | disabled=!canReview \|\| loading \|\| alias.status === "disabled" | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onReview(alias.aliasId, "reject", "Rejected from UI") | apps/web/src/features/admin/components/AdminWorkspace.tsx:453 | confirmed |
| AliasAdminPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 無効 | loading && <LoadingSpinner className="button-spinner" /> / 無効 (visible-text) | disabled=!canDisable \|\| loading \|\| alias.status === "disabled" | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onDisable(alias.aliasId) | apps/web/src/features/admin/components/AdminWorkspace.tsx:457 | confirmed |
| AdminCreateUserForm | form | 管理対象ユーザー作成 | 管理対象ユーザー作成 (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSubmit=(event) => void submit(event) | apps/web/src/features/admin/components/AdminWorkspace.tsx:513 | confirmed |
| AdminCreateUserForm | label | メール | メール (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:514 | confirmed |
| AdminCreateUserForm | input | new-user@example.com | new-user@example.com (placeholder) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setEmail(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:516 | confirmed |
| AdminCreateUserForm | label | 表示名 | 表示名 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:518 | confirmed |
| AdminCreateUserForm | input | 任意 | 任意 (placeholder) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setDisplayName(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:520 | confirmed |
| AdminCreateUserForm | label | 初期ロール / roles.map((roleDefinition) => ( <option value={roleDefinition.role} key… | 初期ロール / roles.map((roleDefinition) => ( <option value={roleDefinition.role} key={roleDe… (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:522 | confirmed |
| AdminCreateUserForm | select | role | roles.map((roleDefinition) => ( <option value={roleDefinition.role} key={roleDe… (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setRole(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:524 | confirmed |
| AdminCreateUserForm | option | roleDefinition.role | roleDefinition.role (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:526 | confirmed |
| AdminCreateUserForm | button | loading && <LoadingSpinner className="button-spinner" /> / 作成 | loading && <LoadingSpinner className="button-spinner" /> / 作成 (visible-text) | disabled=loading \|\| email.trim().length === 0 | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:530 | confirmed |
| ManagedUserRow | select | `${user.email}に付与するロール` | `${user.email}に付与するロール` (aria-label) | disabled=!canAssignRoles \|\| loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => setSelectedRole(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:576 | confirmed |
| ManagedUserRow | option | role.role | role.role (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:578 | confirmed |
| ManagedUserRow | button | loading && <LoadingSpinner className="button-spinner" /> / 付与 | loading && <LoadingSpinner className="button-spinner" /> / 付与 (visible-text) | disabled=!canAssignRoles \|\| loading \|\| user.groups.includes(selectedRole) | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onAssignRoles(user.userId, [selectedRole]) | apps/web/src/features/admin/components/AdminWorkspace.tsx:581 | confirmed |
| ManagedUserRow | button | loading && <LoadingSpinner className="button-spinner" /> / 再開 | loading && <LoadingSpinner className="button-spinner" /> / 再開 (visible-text) | disabled=!canUnsuspend \|\| loading | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onSetStatus(user.userId, "unsuspend") | apps/web/src/features/admin/components/AdminWorkspace.tsx:591 | confirmed |
| ManagedUserRow | button | loading && <LoadingSpinner className="button-spinner" /> / 停止 | loading && <LoadingSpinner className="button-spinner" /> / 停止 (visible-text) | disabled=!canSuspend \|\| loading | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onSetStatus(user.userId, "suspend") | apps/web/src/features/admin/components/AdminWorkspace.tsx:596 | confirmed |
| ManagedUserRow | button | loading && <LoadingSpinner className="button-spinner" /> / 削除 | loading && <LoadingSpinner className="button-spinner" /> / 削除 (visible-text) | disabled=!canDelete \|\| loading | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | onClick=() => void onSetStatus(user.userId, "delete") | apps/web/src/features/admin/components/AdminWorkspace.tsx:601 | confirmed |
