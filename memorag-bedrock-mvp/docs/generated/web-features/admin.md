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
| AdminWorkspace | AdminWorkspace は 管理 領域の 画面または画面内 UI コンポーネント です。関連画面: 管理者設定。 | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/AdminWorkspace.tsx | AdminWorkspace | AdminCreateUserForm, AliasAdminPanel, Icon, LoadingSpinner, LoadingStatus, ManagedUserRow, article, button, div, form, h2, h3, header, i, input, label, option, p, section, select, small, span, strong, time |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AdminWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/admin/components/AdminWorkspace.tsx:108 | confirmed |
| AdminWorkspace | button | ドキュメント管理 / 件 | 「ドキュメント管理 / 件」を実行するボタン。 | - | onClick=onOpenDocuments | apps/web/src/features/admin/components/AdminWorkspace.tsx:120 | confirmed |
| AdminWorkspace | button | 担当者対応 / 件が対応待ち | 「担当者対応 / 件が対応待ち」を実行するボタン。 | - | onClick=onOpenAssignee | apps/web/src/features/admin/components/AdminWorkspace.tsx:127 | confirmed |
| AdminWorkspace | button | デバッグ / 評価 / 件の実行履歴 | 「デバッグ / 評価 / 件の実行履歴」を実行するボタン。 | - | onClick=onOpenDebug | apps/web/src/features/admin/components/AdminWorkspace.tsx:134 | confirmed |
| AdminWorkspace | button | 性能テスト / 件の実行履歴 | 「性能テスト / 件の実行履歴」を実行するボタン。 | - | onClick=onOpenBenchmark | apps/web/src/features/admin/components/AdminWorkspace.tsx:141 | confirmed |
| AdminWorkspace | button | 更新 | 「更新」を実行するボタン。 | 状態: disabled=loading | onClick=() => void onRefreshAdminData() | apps/web/src/features/admin/components/AdminWorkspace.tsx:206 | confirmed |
| AliasAdminPanel | button | 公開 | 「公開」を実行するボタン。 | 状態: disabled=!canPublish \|\| loading | onClick=() => void onPublish() | apps/web/src/features/admin/components/AdminWorkspace.tsx:405 | confirmed |
| AliasAdminPanel | button | 追加 | 「追加」を実行するボタン。 | 状態: disabled=loading \|\| !term.trim() \|\| parseExpansionList(expansions).length === 0 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:426 | confirmed |
| AliasAdminPanel | button | 下書き化 | 「下書き化」を実行するボタン。 | 状態: disabled=!canWrite \|\| loading \|\| alias.status === "disabled" | onClick=() => void onUpdate(alias.aliasId, { expansions: alias.expansions }) | apps/web/src/features/admin/components/AdminWorkspace.tsx:445 | confirmed |
| AliasAdminPanel | button | 承認 | 「承認」を実行するボタン。 | 状態: disabled=!canReview \|\| loading \|\| alias.status === "disabled" | onClick=() => void onReview(alias.aliasId, "approve") | apps/web/src/features/admin/components/AdminWorkspace.tsx:449 | confirmed |
| AliasAdminPanel | button | 差戻 | 「差戻」を実行するボタン。 | 状態: disabled=!canReview \|\| loading \|\| alias.status === "disabled" | onClick=() => void onReview(alias.aliasId, "reject", "Rejected from UI") | apps/web/src/features/admin/components/AdminWorkspace.tsx:453 | confirmed |
| AliasAdminPanel | button | 無効 | 「無効」を実行するボタン。 | 状態: disabled=!canDisable \|\| loading \|\| alias.status === "disabled" | onClick=() => void onDisable(alias.aliasId) | apps/web/src/features/admin/components/AdminWorkspace.tsx:457 | confirmed |
| AdminCreateUserForm | button | 作成 | 「作成」を実行するボタン。 | 状態: disabled=loading \|\| email.trim().length === 0 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:530 | confirmed |
| ManagedUserRow | button | 付与 | 「付与」を実行するボタン。 | 状態: disabled=!canAssignRoles \|\| loading \|\| user.groups.includes(selectedRole) | onClick=() => void onAssignRoles(user.userId, [selectedRole]) | apps/web/src/features/admin/components/AdminWorkspace.tsx:581 | confirmed |
| ManagedUserRow | button | 再開 | 「再開」を実行するボタン。 | 状態: disabled=!canUnsuspend \|\| loading | onClick=() => void onSetStatus(user.userId, "unsuspend") | apps/web/src/features/admin/components/AdminWorkspace.tsx:591 | confirmed |
| ManagedUserRow | button | 停止 | 「停止」を実行するボタン。 | 状態: disabled=!canSuspend \|\| loading | onClick=() => void onSetStatus(user.userId, "suspend") | apps/web/src/features/admin/components/AdminWorkspace.tsx:596 | confirmed |
| ManagedUserRow | button | 削除 | 「削除」を実行するボタン。 | 状態: disabled=!canDelete \|\| loading | onClick=() => void onSetStatus(user.userId, "delete") | apps/web/src/features/admin/components/AdminWorkspace.tsx:601 | confirmed |

## フォーム

| コンポーネント | ラベル | フォーム説明 | 状態・補足 | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| AliasAdminPanel | 用語 / 展開語 / 部署 scope / 追加 | 「用語 / 展開語 / 部署 scope / 追加」を入力・送信するフォーム。 | - | onSubmit=(event) => void onSubmit(event) | apps/web/src/features/admin/components/AdminWorkspace.tsx:413 | confirmed |
| AdminCreateUserForm | 管理対象ユーザー作成 | 「管理対象ユーザー作成」を入力・送信するフォーム。 | - | onSubmit=(event) => void submit(event) | apps/web/src/features/admin/components/AdminWorkspace.tsx:513 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AliasAdminPanel | input | pto | 「pto」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => setTerm(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:416 | confirmed |
| AliasAdminPanel | input | 有給休暇, 休暇申請 | 「有給休暇, 休暇申請」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => setExpansions(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:420 | confirmed |
| AliasAdminPanel | input | 任意 | 「任意」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => setDepartment(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:424 | confirmed |
| AdminCreateUserForm | input | new-user@example.com | 「new-user@example.com」を入力または選択する項目。 | - | onChange=(event) => setEmail(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:516 | confirmed |
| AdminCreateUserForm | input | 任意 | 「任意」を入力または選択する項目。 | - | onChange=(event) => setDisplayName(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:520 | confirmed |
| AdminCreateUserForm | select | 初期ロール | 「初期ロール」を選ぶ選択項目。 | - | onChange=(event) => setRole(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:524 | confirmed |
| ManagedUserRow | select | `${user.email}に付与するロール` | 「`${user.email}に付与するロール`」を選ぶ選択項目。 | 状態: disabled=!canAssignRoles \|\| loading | onChange=(event) => setSelectedRole(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:576 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AdminWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/admin/components/AdminWorkspace.tsx:108 | confirmed |
| AdminWorkspace | button | ドキュメント管理 / 件 | 「ドキュメント管理 / 件」を実行するボタン。 | - | onClick=onOpenDocuments | apps/web/src/features/admin/components/AdminWorkspace.tsx:120 | confirmed |
| AdminWorkspace | button | 担当者対応 / 件が対応待ち | 「担当者対応 / 件が対応待ち」を実行するボタン。 | - | onClick=onOpenAssignee | apps/web/src/features/admin/components/AdminWorkspace.tsx:127 | confirmed |
| AdminWorkspace | button | デバッグ / 評価 / 件の実行履歴 | 「デバッグ / 評価 / 件の実行履歴」を実行するボタン。 | - | onClick=onOpenDebug | apps/web/src/features/admin/components/AdminWorkspace.tsx:134 | confirmed |
| AdminWorkspace | button | 性能テスト / 件の実行履歴 | 「性能テスト / 件の実行履歴」を実行するボタン。 | - | onClick=onOpenBenchmark | apps/web/src/features/admin/components/AdminWorkspace.tsx:141 | confirmed |
| AdminWorkspace | button | 更新 | 「更新」を実行するボタン。 | 状態: disabled=loading | onClick=() => void onRefreshAdminData() | apps/web/src/features/admin/components/AdminWorkspace.tsx:206 | confirmed |
| AdminWorkspace | AdminCreateUserForm | 未推定 | AdminCreateUserForm 要素。静的解析では具体的な操作名を推定できません。 | - | onCreateUser=onCreateUser | apps/web/src/features/admin/components/AdminWorkspace.tsx:212 | unknown |
| AliasAdminPanel | button | 公開 | 「公開」を実行するボタン。 | 状態: disabled=!canPublish \|\| loading | onClick=() => void onPublish() | apps/web/src/features/admin/components/AdminWorkspace.tsx:405 | confirmed |
| AliasAdminPanel | form | 用語 / 展開語 / 部署 scope / 追加 | 「用語 / 展開語 / 部署 scope / 追加」を入力・送信するフォーム。 | - | onSubmit=(event) => void onSubmit(event) | apps/web/src/features/admin/components/AdminWorkspace.tsx:413 | confirmed |
| AliasAdminPanel | label | 用語 | 「用語」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:414 | confirmed |
| AliasAdminPanel | input | pto | 「pto」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => setTerm(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:416 | confirmed |
| AliasAdminPanel | label | 展開語 | 「展開語」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:418 | confirmed |
| AliasAdminPanel | input | 有給休暇, 休暇申請 | 「有給休暇, 休暇申請」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => setExpansions(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:420 | confirmed |
| AliasAdminPanel | label | 部署 scope | 「部署 scope」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:422 | confirmed |
| AliasAdminPanel | input | 任意 | 「任意」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => setDepartment(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:424 | confirmed |
| AliasAdminPanel | button | 追加 | 「追加」を実行するボタン。 | 状態: disabled=loading \|\| !term.trim() \|\| parseExpansionList(expansions).length === 0 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:426 | confirmed |
| AliasAdminPanel | button | 下書き化 | 「下書き化」を実行するボタン。 | 状態: disabled=!canWrite \|\| loading \|\| alias.status === "disabled" | onClick=() => void onUpdate(alias.aliasId, { expansions: alias.expansions }) | apps/web/src/features/admin/components/AdminWorkspace.tsx:445 | confirmed |
| AliasAdminPanel | button | 承認 | 「承認」を実行するボタン。 | 状態: disabled=!canReview \|\| loading \|\| alias.status === "disabled" | onClick=() => void onReview(alias.aliasId, "approve") | apps/web/src/features/admin/components/AdminWorkspace.tsx:449 | confirmed |
| AliasAdminPanel | button | 差戻 | 「差戻」を実行するボタン。 | 状態: disabled=!canReview \|\| loading \|\| alias.status === "disabled" | onClick=() => void onReview(alias.aliasId, "reject", "Rejected from UI") | apps/web/src/features/admin/components/AdminWorkspace.tsx:453 | confirmed |
| AliasAdminPanel | button | 無効 | 「無効」を実行するボタン。 | 状態: disabled=!canDisable \|\| loading \|\| alias.status === "disabled" | onClick=() => void onDisable(alias.aliasId) | apps/web/src/features/admin/components/AdminWorkspace.tsx:457 | confirmed |
| AdminCreateUserForm | form | 管理対象ユーザー作成 | 「管理対象ユーザー作成」を入力・送信するフォーム。 | - | onSubmit=(event) => void submit(event) | apps/web/src/features/admin/components/AdminWorkspace.tsx:513 | confirmed |
| AdminCreateUserForm | label | メール | 「メール」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:514 | confirmed |
| AdminCreateUserForm | input | new-user@example.com | 「new-user@example.com」を入力または選択する項目。 | - | onChange=(event) => setEmail(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:516 | confirmed |
| AdminCreateUserForm | label | 表示名 | 「表示名」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:518 | confirmed |
| AdminCreateUserForm | input | 任意 | 「任意」を入力または選択する項目。 | - | onChange=(event) => setDisplayName(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:520 | confirmed |
| AdminCreateUserForm | label | 初期ロール | 「初期ロール」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:522 | confirmed |
| AdminCreateUserForm | select | 初期ロール | 「初期ロール」を選ぶ選択項目。 | - | onChange=(event) => setRole(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:524 | confirmed |
| AdminCreateUserForm | option | 初期ロール | 「初期ロール」を表す option 要素。 | - | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:526 | confirmed |
| AdminCreateUserForm | button | 作成 | 「作成」を実行するボタン。 | 状態: disabled=loading \|\| email.trim().length === 0 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:530 | confirmed |
| ManagedUserRow | select | `${user.email}に付与するロール` | 「`${user.email}に付与するロール`」を選ぶ選択項目。 | 状態: disabled=!canAssignRoles \|\| loading | onChange=(event) => setSelectedRole(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:576 | confirmed |
| ManagedUserRow | option | role.role | 「role.role」を表す option 要素。 | - | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:578 | confirmed |
| ManagedUserRow | button | 付与 | 「付与」を実行するボタン。 | 状態: disabled=!canAssignRoles \|\| loading \|\| user.groups.includes(selectedRole) | onClick=() => void onAssignRoles(user.userId, [selectedRole]) | apps/web/src/features/admin/components/AdminWorkspace.tsx:581 | confirmed |
| ManagedUserRow | button | 再開 | 「再開」を実行するボタン。 | 状態: disabled=!canUnsuspend \|\| loading | onClick=() => void onSetStatus(user.userId, "unsuspend") | apps/web/src/features/admin/components/AdminWorkspace.tsx:591 | confirmed |
| ManagedUserRow | button | 停止 | 「停止」を実行するボタン。 | 状態: disabled=!canSuspend \|\| loading | onClick=() => void onSetStatus(user.userId, "suspend") | apps/web/src/features/admin/components/AdminWorkspace.tsx:596 | confirmed |
| ManagedUserRow | button | 削除 | 「削除」を実行するボタン。 | 状態: disabled=!canDelete \|\| loading | onClick=() => void onSetStatus(user.userId, "delete") | apps/web/src/features/admin/components/AdminWorkspace.tsx:601 | confirmed |
