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

| コンポーネント | 説明 | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- | --- |
| AdminWorkspace | AdminWorkspace は 管理 領域の 画面または画面内 UI コンポーネント です。関連画面: 管理者設定。 | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/AdminWorkspace.tsx | AdminWorkspace | AdminAuditPanel, AdminCostPanel, AdminOverviewGrid, AdminRolePanel, AdminUsagePanel, AdminUserPanel, AliasAdminPanel, Icon, LoadingStatus, ResourceStateBoundary, button, div, h2, header, nav, section, span |
| AdminAuditPanel | AdminAuditPanel は 管理 領域の 画面または画面内 UI コンポーネント です。関連画面: 管理者設定。 | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx | AdminAuditPanel | EmptyState, article, div, h3, p, section, small, span, strong, time |
| AdminCostPanel | AdminCostPanel は 管理 領域の 画面または画面内 UI コンポーネント です。関連画面: 管理者設定。 | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx | AdminCostPanel | EmptyState, article, div, h3, i, p, section, span, strong |
| AdminOverviewGrid | AdminOverviewGrid は 管理 領域の 画面または画面内 UI コンポーネント です。関連画面: 管理者設定。 | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/panels/AdminOverviewGrid.tsx | AdminOverviewGrid | EmptyState, Icon, article, button, div, small, span, strong |
| AdminRolePanel | AdminRolePanel は 管理 領域の 画面または画面内 UI コンポーネント です。関連画面: 管理者設定。 | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/panels/AdminRolePanel.tsx | AdminRolePanel | EmptyState, article, div, h3, p, section, span, strong |
| AdminUsagePanel | AdminUsagePanel は 管理 領域の 画面または画面内 UI コンポーネント です。関連画面: 管理者設定。 | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx | AdminUsagePanel | EmptyState, div, h3, p, section, span |
| AdminUserPanel | AdminUserPanel は 管理 領域の 画面または画面内 UI コンポーネント です。関連画面: 管理者設定。 | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx | AdminUserPanel | AdminCreateUserForm, ConfirmDialog, EmptyState, LoadingSpinner, ManagedUserRow, OperationFeedback, StatusBadge, button, div, form, h3, input, label, option, section, select, small, span, strong |
| AliasAdminPanel | AliasAdminPanel は 管理 領域の 画面または画面内 UI コンポーネント です。関連画面: 管理者設定。 | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx | AliasAdminPanel | ConfirmDialog, EmptyState, LoadingSpinner, OperationFeedback, StatusBadge, article, button, div, form, h3, input, label, section, small, span, strong |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AdminWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/admin/components/AdminWorkspace.tsx:143 | confirmed |
| AdminWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=resolvedActiveSection === section.id ? "page" : undefined | onClick=() => setActiveSection(section.id) | apps/web/src/features/admin/components/AdminWorkspace.tsx:156 | unknown |
| AdminOverviewGrid | button | `${card.label}を開く` | 「`${card.label}を開く`」を実行するボタン。 | - | onClick=card.onSelect | apps/web/src/features/admin/components/panels/AdminOverviewGrid.tsx:191 | confirmed |
| AdminUserPanel | button | 更新 | 「更新」を実行するボタン。 | 状態: disabled=loading | onClick=() => void onRefreshAdminData() | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:63 | confirmed |
| AdminCreateUserForm | button | 作成 | 「作成」を実行するボタン。 | 状態: disabled=loading \|\| email.trim().length === 0 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:176 | confirmed |
| ManagedUserRow | button | 付与 | 「付与」を実行するボタン。 | 状態: disabled=loading \|\| !roleChanged \|\| roleReason.trim().length === 0 | onClick=() => setRoleAssignOpen(true) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:295 | confirmed |
| ManagedUserRow | button | 再開 | 「再開」を実行するボタン。 | 状態: disabled=loading | onClick=() => void applyStatus("unsuspend") | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:318 | confirmed |
| ManagedUserRow | button | 停止 | 「停止」を実行するボタン。 | 状態: disabled=loading | onClick=() => setStatusCandidate("suspend") | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:323 | confirmed |
| ManagedUserRow | button | 削除 | 「削除」を実行するボタン。 | 状態: disabled=loading | onClick=() => void prepareDelete() | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:328 | confirmed |
| AliasAdminPanel | button | 公開 | 「公開」を実行するボタン。 | 状態: disabled=loading | onClick=() => setPublishConfirmOpen(true) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:81 | confirmed |
| AliasAdminPanel | button | 追加 | 「追加」を実行するボタン。 | 状態: disabled=loading \|\| !term.trim() \|\| parseExpansionList(expansions).length === 0 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:109 | confirmed |
| AliasAdminPanel | button | 下書き化 | 「下書き化」を実行するボタン。 | 状態: disabled=!canWrite \|\| loading \|\| alias.status === "disabled" | onClick=() => void onUpdate(alias.aliasId, { expansions: alias.expansions }) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:134 | confirmed |
| AliasAdminPanel | button | 承認 | 「承認」を実行するボタン。 | 状態: disabled=!canReview \|\| loading \|\| alias.status === "disabled" | onClick=() => void onReview(alias.aliasId, "approve") | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:138 | confirmed |
| AliasAdminPanel | button | 差戻 | 「差戻」を実行するボタン。 | 状態: disabled=!canReview \|\| loading \|\| alias.status === "disabled" | onClick=() => void onReview(alias.aliasId, "reject", "画面から差し戻し") | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:142 | confirmed |
| AliasAdminPanel | button | 無効 | 「無効」を実行するボタン。 | 状態: disabled=!canDisable \|\| loading \|\| alias.status === "disabled" | onClick=() => setDisableCandidate(alias) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:146 | confirmed |

## フォーム

| コンポーネント | ラベル | フォーム説明 | 状態・補足 | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| AdminCreateUserForm | 管理対象ユーザー作成 | 「管理対象ユーザー作成」を入力・送信するフォーム。 | - | onSubmit=(event) => void submit(event) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:153 | confirmed |
| AliasAdminPanel | 用語 / 展開語 / 適用部署 / 追加 | 「用語 / 展開語 / 適用部署 / 追加」を入力・送信するフォーム。 | - | onSubmit=(event) => void onSubmit(event) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:96 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AdminCreateUserForm | input | new-user@example.com | 「new-user@example.com」を入力または選択する項目。 | - | onChange=(event) => setEmail(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:156 | confirmed |
| AdminCreateUserForm | input | 任意 | 「任意」を入力または選択する項目。 | - | onChange=(event) => setDisplayName(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:160 | confirmed |
| AdminCreateUserForm | select | 初期ロール | 「初期ロール」を選ぶ選択項目。 | - | onChange=(event) => setRole(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:169 | confirmed |
| ManagedUserRow | select | `${user.email}に付与するロール` | 「`${user.email}に付与するロール`」を選ぶ選択項目。 | 状態: disabled=loading | onChange=(event) => setSelectedRole(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:290 | confirmed |
| ManagedUserRow | input | `${user.email}のロール変更理由` | 「`${user.email}のロール変更理由`」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => setRoleReason(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:299 | confirmed |
| ManagedUserRow | select | `${user.email}の後継管理者` | 「`${user.email}の後継管理者`」を選ぶ選択項目。 | 状態: disabled=loading | onChange=(event) => setSuccessorUserId(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:378 | confirmed |
| AliasAdminPanel | input | pto | 「pto」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => setTerm(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:99 | confirmed |
| AliasAdminPanel | input | 有給休暇, 休暇申請 | 「有給休暇, 休暇申請」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => setExpansions(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:103 | confirmed |
| AliasAdminPanel | input | 任意 | 「任意」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => setDepartment(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:107 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AdminWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/admin/components/AdminWorkspace.tsx:143 | confirmed |
| AdminWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=resolvedActiveSection === section.id ? "page" : undefined | onClick=() => setActiveSection(section.id) | apps/web/src/features/admin/components/AdminWorkspace.tsx:156 | unknown |
| AdminOverviewGrid | button | `${card.label}を開く` | 「`${card.label}を開く`」を実行するボタン。 | - | onClick=card.onSelect | apps/web/src/features/admin/components/panels/AdminOverviewGrid.tsx:191 | confirmed |
| AdminUserPanel | button | 更新 | 「更新」を実行するボタン。 | 状態: disabled=loading | onClick=() => void onRefreshAdminData() | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:63 | confirmed |
| AdminUserPanel | AdminCreateUserForm | 未推定 | AdminCreateUserForm 要素。静的解析では具体的な操作名を推定できません。 | - | onCreateUser=onCreateUser | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:69 | unknown |
| AdminCreateUserForm | form | 管理対象ユーザー作成 | 「管理対象ユーザー作成」を入力・送信するフォーム。 | - | onSubmit=(event) => void submit(event) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:153 | confirmed |
| AdminCreateUserForm | label | メール | 「メール」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:154 | confirmed |
| AdminCreateUserForm | input | new-user@example.com | 「new-user@example.com」を入力または選択する項目。 | - | onChange=(event) => setEmail(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:156 | confirmed |
| AdminCreateUserForm | label | 表示名 | 「表示名」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:158 | confirmed |
| AdminCreateUserForm | input | 任意 | 「任意」を入力または選択する項目。 | - | onChange=(event) => setDisplayName(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:160 | confirmed |
| AdminCreateUserForm | label | 初期ロール | 「初期ロール」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:162 | confirmed |
| AdminCreateUserForm | select | 初期ロール | 「初期ロール」を選ぶ選択項目。 | - | onChange=(event) => setRole(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:169 | confirmed |
| AdminCreateUserForm | option | 初期ロール | 「初期ロール」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:171 | confirmed |
| AdminCreateUserForm | button | 作成 | 「作成」を実行するボタン。 | 状態: disabled=loading \|\| email.trim().length === 0 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:176 | confirmed |
| ManagedUserRow | select | `${user.email}に付与するロール` | 「`${user.email}に付与するロール`」を選ぶ選択項目。 | 状態: disabled=loading | onChange=(event) => setSelectedRole(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:290 | confirmed |
| ManagedUserRow | option | role.role | 「role.role」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:292 | confirmed |
| ManagedUserRow | button | 付与 | 「付与」を実行するボタン。 | 状態: disabled=loading \|\| !roleChanged \|\| roleReason.trim().length === 0 | onClick=() => setRoleAssignOpen(true) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:295 | confirmed |
| ManagedUserRow | input | `${user.email}のロール変更理由` | 「`${user.email}のロール変更理由`」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => setRoleReason(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:299 | confirmed |
| ManagedUserRow | button | 再開 | 「再開」を実行するボタン。 | 状態: disabled=loading | onClick=() => void applyStatus("unsuspend") | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:318 | confirmed |
| ManagedUserRow | button | 停止 | 「停止」を実行するボタン。 | 状態: disabled=loading | onClick=() => setStatusCandidate("suspend") | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:323 | confirmed |
| ManagedUserRow | button | 削除 | 「削除」を実行するボタン。 | 状態: disabled=loading | onClick=() => void prepareDelete() | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:328 | confirmed |
| ManagedUserRow | label | 後継管理者 | 「後継管理者」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:376 | confirmed |
| ManagedUserRow | select | `${user.email}の後継管理者` | 「`${user.email}の後継管理者`」を選ぶ選択項目。 | 状態: disabled=loading | onChange=(event) => setSuccessorUserId(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:378 | confirmed |
| ManagedUserRow | option | 選択してください | 「選択してください」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:386 | confirmed |
| ManagedUserRow | option | candidate.userId | 「candidate.userId」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:388 | confirmed |
| AliasAdminPanel | button | 公開 | 「公開」を実行するボタン。 | 状態: disabled=loading | onClick=() => setPublishConfirmOpen(true) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:81 | confirmed |
| AliasAdminPanel | form | 用語 / 展開語 / 適用部署 / 追加 | 「用語 / 展開語 / 適用部署 / 追加」を入力・送信するフォーム。 | - | onSubmit=(event) => void onSubmit(event) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:96 | confirmed |
| AliasAdminPanel | label | 用語 | 「用語」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:97 | confirmed |
| AliasAdminPanel | input | pto | 「pto」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => setTerm(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:99 | confirmed |
| AliasAdminPanel | label | 展開語 | 「展開語」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:101 | confirmed |
| AliasAdminPanel | input | 有給休暇, 休暇申請 | 「有給休暇, 休暇申請」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => setExpansions(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:103 | confirmed |
| AliasAdminPanel | label | 適用部署 | 「適用部署」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:105 | confirmed |
| AliasAdminPanel | input | 任意 | 「任意」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => setDepartment(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:107 | confirmed |
| AliasAdminPanel | button | 追加 | 「追加」を実行するボタン。 | 状態: disabled=loading \|\| !term.trim() \|\| parseExpansionList(expansions).length === 0 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:109 | confirmed |
| AliasAdminPanel | button | 下書き化 | 「下書き化」を実行するボタン。 | 状態: disabled=!canWrite \|\| loading \|\| alias.status === "disabled" | onClick=() => void onUpdate(alias.aliasId, { expansions: alias.expansions }) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:134 | confirmed |
| AliasAdminPanel | button | 承認 | 「承認」を実行するボタン。 | 状態: disabled=!canReview \|\| loading \|\| alias.status === "disabled" | onClick=() => void onReview(alias.aliasId, "approve") | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:138 | confirmed |
| AliasAdminPanel | button | 差戻 | 「差戻」を実行するボタン。 | 状態: disabled=!canReview \|\| loading \|\| alias.status === "disabled" | onClick=() => void onReview(alias.aliasId, "reject", "画面から差し戻し") | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:142 | confirmed |
| AliasAdminPanel | button | 無効 | 「無効」を実行するボタン。 | 状態: disabled=!canDisable \|\| loading \|\| alias.status === "disabled" | onClick=() => setDisableCandidate(alias) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:146 | confirmed |
