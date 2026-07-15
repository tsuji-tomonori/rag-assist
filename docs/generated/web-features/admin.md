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
| AdminPanelDataStatus | AdminPanelDataStatus は 管理 領域の 画面または画面内 UI コンポーネント です。関連画面: 管理者設定。 | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/AdminPanelDataStatus.tsx | AdminPanelDataStatus | button, code, div, span, strong, time |
| AdminWorkspace | AdminWorkspace は 管理 領域の 画面または画面内 UI コンポーネント です。関連画面: 管理者設定。 | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/AdminWorkspace.tsx | AdminWorkspace | AdminAuditPanel, AdminCostPanel, AdminOverviewGrid, AdminRolePanel, AdminUsagePanel, AdminUserPanel, AliasAdminPanel, Icon, LoadingStatus, ResourceStateBoundary, button, div, h2, header, nav, section, span |
| AdminAuditPanel | AdminAuditPanel は 管理 領域の 画面または画面内 UI コンポーネント です。関連画面: 管理者設定。 | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx | AdminAuditPanel | AdminPanelDataStatus, EmptyState, a, article, button, code, div, form, h3, input, label, option, p, section, select, small, span, strong, time |
| AdminCostPanel | AdminCostPanel は 管理 領域の 画面または画面内 UI コンポーネント です。関連画面: 管理者設定。 | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx | AdminCostPanel | AdminPanelDataStatus, EmptyState, UsageQueryForm, a, article, button, dd, div, dl, dt, form, h3, i, input, label, p, section, small, span, strong |
| AdminOverviewGrid | AdminOverviewGrid は 管理 領域の 画面または画面内 UI コンポーネント です。関連画面: 管理者設定。 | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/panels/AdminOverviewGrid.tsx | AdminOverviewGrid | EmptyState, Icon, button, div, small, span, strong |
| AdminRolePanel | AdminRolePanel は 管理 領域の 画面または画面内 UI コンポーネント です。関連画面: 管理者設定。 | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/panels/AdminRolePanel.tsx | AdminRolePanel | AdminPanelDataStatus, EmptyState, code, details, div, h3, li, p, section, small, span, strong, summary, ul |
| AdminUsagePanel | AdminUsagePanel は 管理 領域の 画面または画面内 UI コンポーネント です。関連画面: 管理者設定。 | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx | AdminUsagePanel, UsageQueryForm | AdminPanelDataStatus, CompletenessSummary, EmptyState, UsageQueryForm, a, button, dd, div, dl, dt, form, h3, input, label, p, section, span, table, tbody, td, th, thead, time, tr |
| AdminUserPanel | AdminUserPanel は 管理 領域の 画面または画面内 UI コンポーネント です。関連画面: 管理者設定。 | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx | AdminUserPanel | AdminCreateUserForm, AdminPanelDataStatus, ConfirmDialog, EmptyState, LoadingSpinner, ManagedUserRow, OperationFeedback, StatusBadge, button, code, div, fieldset, form, h3, input, label, legend, option, section, select, small, span, strong, table, tbody, td, textarea, th, thead, tr |
| AliasAdminPanel | AliasAdminPanel は 管理 領域の 画面または画面内 UI コンポーネント です。関連画面: 管理者設定。 | 画面または画面内 UI コンポーネント | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx | AliasAdminPanel | AdminPanelDataStatus, ConfirmDialog, EmptyState, OperationFeedback, ReasonField, StatusBadge, article, button, code, dd, div, dl, dt, form, h3, h4, input, label, option, section, select, small, span, strong, textarea, time |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AdminPanelDataStatus | button | `${label}を更新` | 「`${label}を更新`」を実行するボタン。 | 状態: disabled=loading \|\| isBusy | onClick=() => void onRefresh() | apps/web/src/features/admin/components/AdminPanelDataStatus.tsx:39 | confirmed |
| AdminWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/admin/components/AdminWorkspace.tsx:216 | confirmed |
| AdminWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=resolvedActiveSection === section.id ? "page" : undefined | onClick=() => openSection(section.id) | apps/web/src/features/admin/components/AdminWorkspace.tsx:229 | unknown |
| AdminAuditPanel | button | 検索 | 「検索」を実行するボタン。 | 状態: disabled=loading | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:81 | confirmed |
| AdminAuditPanel | button | 条件を解除 | 「条件を解除」を実行するボタン。 | 状態: disabled=loading | onClick=() => { setQuery("") onUrlStateChange({ ...urlState, section: "audit", query: undefined, … | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:83 | confirmed |
| AdminAuditPanel | button | 現在の条件を export | 「現在の条件を export」を実行するボタン。 | 状態: disabled=loading \|\| exportReason.trim().length === 0 | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:105 | confirmed |
| AdminAuditPanel | a | 有効期限内に取得 | 「有効期限内に取得」へ移動するリンク。 | - | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:110 | confirmed |
| AdminAuditPanel | button | 次の履歴を読み込む（残り / 件） | 「次の履歴を読み込む（残り / 件）」を実行するボタン。 | 状態: disabled=loading | onClick=() => void onLoadMore() | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:140 | confirmed |
| AdminCostPanel | button | 同じ条件の全ページを export | 「同じ条件の全ページを export」を実行するボタン。 | 状態: disabled=loading \|\| !exportReason.trim() | - | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:44 | confirmed |
| AdminCostPanel | a | 有効期限内に取得 | 「有効期限内に取得」へ移動するリンク。 | - | - | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:47 | confirmed |
| AdminCostPanel | button | 次の cost item を読み込む | 「次の cost item を読み込む」を実行するボタン。 | 状態: disabled=loading | onClick=() => void onLoadMore() | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:56 | confirmed |
| AdminOverviewGrid | button | `${card.label}を開く` | 「`${card.label}を開く`」を実行するボタン。 | - | onClick=card.onSelect | apps/web/src/features/admin/components/panels/AdminOverviewGrid.tsx:205 | confirmed |
| AdminOverviewGrid | button | `${card.label}を開く` | 「`${card.label}を開く`」を実行するボタン。 | - | onClick=card.onSelect | apps/web/src/features/admin/components/panels/AdminOverviewGrid.tsx:212 | confirmed |
| AdminUsagePanel | button | 同じ条件の全ページを export | 「同じ条件の全ページを export」を実行するボタン。 | 状態: disabled=loading \|\| !exportReason.trim() | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:58 | confirmed |
| AdminUsagePanel | a | 有効期限内に取得 | 「有効期限内に取得」へ移動するリンク。 | - | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:61 | confirmed |
| AdminUsagePanel | button | 次の usage event を読み込む | 「次の usage event を読み込む」を実行するボタン。 | 状態: disabled=loading | onClick=() => void onLoadMore() | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:78 | confirmed |
| UsageQueryForm | button | 条件を適用 | 「条件を適用」を実行するボタン。 | 状態: disabled=loading | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:92 | confirmed |
| AdminUserPanel | button | 検索 | 「検索」を実行するボタン。 | 状態: disabled=loading | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:95 | confirmed |
| AdminUserPanel | button | 次のユーザーを読み込む（残り / 人） | 「次のユーザーを読み込む（残り / 人）」を実行するボタン。 | 状態: disabled=loading | onClick=() => void onLoadMore() | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:143 | confirmed |
| AdminCreateUserForm | button | 作成 | 「作成」を実行するボタン。 | 状態: disabled=loading \|\| email.trim().length === 0 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:212 | confirmed |
| ManagedUserRow | button | `${user.email}のロール変更を確認` | 「`${user.email}のロール変更を確認`」を実行するボタン。 | 状態: disabled=loading \|\| !roleChanged \|\| nextGroups.length === 0 \|\| roleReason.trim().length === 0 | onClick=() => setRoleAssignOpen(true) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:355 | confirmed |
| ManagedUserRow | button | `${user.email}の利用を再開` | 「`${user.email}の利用を再開`」を実行するボタン。 | 状態: disabled=loading | onClick=() => void applyStatus("unsuspend") | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:376 | confirmed |
| ManagedUserRow | button | `${user.email}の利用を停止` | 「`${user.email}の利用を停止`」を実行するボタン。 | 状態: disabled=loading | onClick=() => setStatusCandidate("suspend") | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:381 | confirmed |
| ManagedUserRow | button | `${user.email}を削除` | 「`${user.email}を削除`」を実行するボタン。 | 状態: disabled=loading | onClick=() => void prepareDelete() | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:386 | confirmed |
| AliasAdminPanel | button | 承認済み用語展開を公開 | 「承認済み用語展開を公開」を実行するボタン。 | 状態: disabled=loading | onClick=() => { setReason(""); setPublishConfirmOpen(true) } | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:129 | confirmed |
| AliasAdminPanel | button | 検索 | 「検索」を実行するボタン。 | 状態: disabled=loading | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:169 | confirmed |
| AliasAdminPanel | button | 条件を解除 | 「条件を解除」を実行するボタン。 | 状態: disabled=loading | onClick=() => { setQuery("") onUrlStateChange({ ...urlState, section: "alias", query: undefined, … | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:171 | confirmed |
| AliasAdminPanel | button | 下書きを追加 | 「下書きを追加」を実行するボタン。 | 状態: disabled=loading \|\| !term.trim() \|\| parseExpansionList(expansions).length === 0 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:198 | confirmed |
| AliasAdminPanel | button | 全件表示へ戻す / 絞り込む | 「全件表示へ戻す / 絞り込む」を実行するボタン。 | - | onClick=() => onUrlStateChange({ ...urlState, section: "alias", selected: urlState.selected === a… | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:225 | confirmed |
| AliasAdminPanel | button | `${alias.term}を編集` | 「`${alias.term}を編集`」を実行するボタン。 | 状態: disabled=loading | onClick=() => openEdit(alias) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:233 | confirmed |
| AliasAdminPanel | button | `${alias.term}を承認` | 「`${alias.term}を承認`」を実行するボタン。 | 状態: disabled=loading | onClick=() => { setReason(""); setCommandCandidate({ alias, command: "approve" }) } | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:237 | confirmed |
| AliasAdminPanel | button | `${alias.term}を差し戻し` | 「`${alias.term}を差し戻し`」を実行するボタン。 | 状態: disabled=loading | onClick=() => { setReason(""); setCommandCandidate({ alias, command: "reject" }) } | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:238 | confirmed |
| AliasAdminPanel | button | `${alias.term}を下書きへ戻す` | 「`${alias.term}を下書きへ戻す`」を実行するボタン。 | 状態: disabled=loading | onClick=() => { setReason(""); setCommandCandidate({ alias, command: "transition" }) } | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:242 | confirmed |
| AliasAdminPanel | button | `${alias.term}を無効化` | 「`${alias.term}を無効化`」を実行するボタン。 | 状態: disabled=loading | onClick=() => { setReason(""); setCommandCandidate({ alias, command: "disable" }) } | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:245 | confirmed |
| AliasAdminPanel | button | 次の用語展開を読み込む（残り / 件） | 「次の用語展開を読み込む（残り / 件）」を実行するボタン。 | 状態: disabled=loading | onClick=() => void onLoadMore() | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:253 | confirmed |
| AliasAdminPanel | button | 次の監査ログを読み込む（残り / 件） | 「次の監査ログを読み込む（残り / 件）」を実行するボタン。 | 状態: disabled=loading | onClick=() => void onLoadMoreAudit() | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:306 | confirmed |

## フォーム

| コンポーネント | ラベル | フォーム説明 | 状態・補足 | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| AdminAuditPanel | 管理操作履歴を絞り込む | 「管理操作履歴を絞り込む」を入力・送信するフォーム。 | role: search | onSubmit=applyFilters | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:62 | confirmed |
| AdminAuditPanel | 現在の監査条件を export | 「現在の監査条件を export」を入力・送信するフォーム。 | - | onSubmit=async (event) => { event.preventDefault() const reason = exportReason.trim() if (!reason)… | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:90 | confirmed |
| AdminCostPanel | 現在のコスト条件を export | 「現在のコスト条件を export」を入力・送信するフォーム。 | - | onSubmit=async (event: FormEvent) => { event.preventDefault(); if (!exportReason.trim()) return; s… | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:38 | confirmed |
| AdminUsagePanel | 現在の利用状況条件を export | 「現在の利用状況条件を export」を入力・送信するフォーム。 | - | onSubmit=exportCurrent | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:56 | confirmed |
| UsageQueryForm | 利用量とコストを絞り込む | 「利用量とコストを絞り込む」を入力・送信するフォーム。 | role: search | onSubmit=onSubmit | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:84 | confirmed |
| AdminUserPanel | 管理対象ユーザーを絞り込む | 「管理対象ユーザーを絞り込む」を入力・送信するフォーム。 | role: search | onSubmit=(event) => { event.preventDefault() onUrlStateChange({ ...urlState, section: "users", que… | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:84 | confirmed |
| AdminCreateUserForm | 管理対象ユーザー作成 | 「管理対象ユーザー作成」を入力・送信するフォーム。 | - | onSubmit=(event) => void submit(event) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:189 | confirmed |
| AliasAdminPanel | 用語展開を絞り込む | 「用語展開を絞り込む」を入力・送信するフォーム。 | role: search | onSubmit=applyFilters | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:138 | confirmed |
| AliasAdminPanel | 用語 / 展開語（カンマまたは改行区切り） / 適用部署（任意） / 下書きを追加 | 「用語 / 展開語（カンマまたは改行区切り） / 適用部署（任意） / 下書きを追加」を入力・送信するフォーム。 | - | onSubmit=(event) => void submitCreate(event) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:185 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AdminAuditPanel | input | 対象・実行者を検索 | 「対象・実行者を検索」を入力または選択する項目。 | - | onChange=(event) => setQuery(event.target.value) | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:65 | confirmed |
| AdminAuditPanel | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => onUrlStateChange({ ...urlState, section: "audit", auditAction: event.target.va… | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:69 | confirmed |
| AdminAuditPanel | input | export 理由（必須） | 「export 理由（必須）」を入力または選択する項目。 | - | onChange=(event) => setExportReason(event.target.value) | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:104 | confirmed |
| AdminCostPanel | input | export 理由（必須） | 「export 理由（必須）」を入力または選択する項目。 | - | onChange=(event) => setExportReason(event.target.value) | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:43 | confirmed |
| AdminUsagePanel | input | export 理由（必須） | 「export 理由（必須）」を入力または選択する項目。 | - | onChange=(event) => setExportReason(event.target.value) | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:57 | confirmed |
| UsageQueryForm | input | 期間開始（ISO 8601） | 「期間開始（ISO 8601）」を入力または選択する項目。 | - | onChange=(event) => onChange({ ...query, periodStart: event.target.value }) | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:85 | confirmed |
| UsageQueryForm | input | 期間終了（ISO 8601・含まない） | 「期間終了（ISO 8601・含まない）」を入力または選択する項目。 | - | onChange=(event) => onChange({ ...query, periodEnd: event.target.value }) | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:86 | confirmed |
| UsageQueryForm | input | subject | 「subject」を入力または選択する項目。 | - | onChange=(event) => onChange({ ...query, subjectId: event.target.value }) | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:87 | confirmed |
| UsageQueryForm | input | run | 「run」を入力または選択する項目。 | - | onChange=(event) => onChange({ ...query, runId: event.target.value }) | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:88 | confirmed |
| UsageQueryForm | input | model | 「model」を入力または選択する項目。 | - | onChange=(event) => onChange({ ...query, modelId: event.target.value }) | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:89 | confirmed |
| UsageQueryForm | input | feature | 「feature」を入力または選択する項目。 | - | onChange=(event) => onChange({ ...query, feature: event.target.value }) | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:90 | confirmed |
| UsageQueryForm | input | provider | 「provider」を入力または選択する項目。 | - | onChange=(event) => onChange({ ...query, provider: event.target.value }) | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:91 | confirmed |
| AdminUserPanel | input | ユーザー・ロールを検索 | 「ユーザー・ロールを検索」を入力または選択する項目。 | - | onChange=(event) => setQuery(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:88 | confirmed |
| AdminUserPanel | select | すべて / 有効 / 停止中 | 「すべて / 有効 / 停止中」を選ぶ選択項目。 | - | onChange=(event) => onUrlStateChange({ ...urlState, section: "users", userStatus: event.target.val… | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:89 | confirmed |
| AdminUserPanel | select | メール昇順 / 更新日時の新しい順 | 「メール昇順 / 更新日時の新しい順」を選ぶ選択項目。 | - | onChange=(event) => onUrlStateChange({ ...urlState, section: "users", userSort: event.target.value… | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:92 | confirmed |
| AdminCreateUserForm | input | new-user@example.com | 「new-user@example.com」を入力または選択する項目。 | - | onChange=(event) => setEmail(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:192 | confirmed |
| AdminCreateUserForm | input | 任意 | 「任意」を入力または選択する項目。 | - | onChange=(event) => setDisplayName(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:196 | confirmed |
| AdminCreateUserForm | select | 初期ロール | 「初期ロール」を選ぶ選択項目。 | - | onChange=(event) => setRole(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:205 | confirmed |
| ManagedUserRow | input | 未推定 | input 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=loading | onChange=(event) => setSelectedRoles((current) => event.target.checked ? [...current, role.role] :… | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:331 | unknown |
| ManagedUserRow | textarea | `${user.email}のロール変更理由` | 「`${user.email}のロール変更理由`」を複数行で入力する項目。 | 状態: disabled=loading | onChange=(event) => setRoleReason(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:346 | confirmed |
| ManagedUserRow | select | `${user.email}の後継管理者` | 「`${user.email}の後継管理者`」を選ぶ選択項目。 | 状態: disabled=loading | onChange=(event) => setSuccessorUserId(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:436 | confirmed |
| AliasAdminPanel | input | 用語・展開語を検索 | 「用語・展開語を検索」を入力または選択する項目。 | - | onChange=(event) => setQuery(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:141 | confirmed |
| AliasAdminPanel | select | すべて / 下書き / 承認済み / 無効 | 「すべて / 下書き / 承認済み / 無効」を選ぶ選択項目。 | - | onChange=(event) => onUrlStateChange({ ...urlState, section: "alias", aliasStatus: event.target.va… | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:145 | confirmed |
| AliasAdminPanel | select | 更新が新しい順 / 用語順 | 「更新が新しい順 / 用語順」を選ぶ選択項目。 | - | onChange=(event) => onUrlStateChange({ ...urlState, section: "alias", sort: event.target.value as … | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:159 | confirmed |
| AliasAdminPanel | input | 用語 | 「用語」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => setTerm(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:188 | confirmed |
| AliasAdminPanel | textarea | 展開語（カンマまたは改行区切り） | 「展開語（カンマまたは改行区切り）」を複数行で入力する項目。 | 状態: disabled=loading | onChange=(event) => setExpansions(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:192 | confirmed |
| AliasAdminPanel | input | 適用部署（任意） | 「適用部署（任意）」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => setDepartment(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:196 | confirmed |
| AliasAdminPanel | select | すべて / 作成 / 更新 / レビュー / 状態遷移 / 無効化 / 公開 | 「すべて / 作成 / 更新 / レビュー / 状態遷移 / 無効化 / 公開」を選ぶ選択項目。 | - | onChange=(event) => onUrlStateChange({ ...urlState, section: "alias", auditAction: event.target.va… | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:265 | confirmed |
| AliasAdminPanel | input | 用語 | 「用語」を入力または選択する項目。 | - | onChange=(event) => setEditTerm(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:381 | confirmed |
| AliasAdminPanel | textarea | 展開語 | 「展開語」を複数行で入力する項目。 | - | onChange=(event) => setEditExpansions(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:382 | confirmed |
| ReasonField | textarea | 実行理由（必須） | 「実行理由（必須）」を複数行で入力する項目。 | - | onChange=(event) => onChange(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:427 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AdminPanelDataStatus | button | `${label}を更新` | 「`${label}を更新`」を実行するボタン。 | 状態: disabled=loading \|\| isBusy | onClick=() => void onRefresh() | apps/web/src/features/admin/components/AdminPanelDataStatus.tsx:39 | confirmed |
| AdminWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/admin/components/AdminWorkspace.tsx:216 | confirmed |
| AdminWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=resolvedActiveSection === section.id ? "page" : undefined | onClick=() => openSection(section.id) | apps/web/src/features/admin/components/AdminWorkspace.tsx:229 | unknown |
| AdminAuditPanel | form | 管理操作履歴を絞り込む | 「管理操作履歴を絞り込む」を入力・送信するフォーム。 | role: search | onSubmit=applyFilters | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:62 | confirmed |
| AdminAuditPanel | label | 対象・実行者を検索 | 「対象・実行者を検索」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:63 | confirmed |
| AdminAuditPanel | input | 対象・実行者を検索 | 「対象・実行者を検索」を入力または選択する項目。 | - | onChange=(event) => setQuery(event.target.value) | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:65 | confirmed |
| AdminAuditPanel | label | 操作 / すべて | 「操作 / すべて」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:67 | confirmed |
| AdminAuditPanel | select | すべて | 「すべて」を選ぶ選択項目。 | - | onChange=(event) => onUrlStateChange({ ...urlState, section: "audit", auditAction: event.target.va… | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:69 | confirmed |
| AdminAuditPanel | option | すべて | 「すべて」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:77 | confirmed |
| AdminAuditPanel | option | 操作 / すべて | 「操作 / すべて」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:78 | confirmed |
| AdminAuditPanel | button | 検索 | 「検索」を実行するボタン。 | 状態: disabled=loading | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:81 | confirmed |
| AdminAuditPanel | button | 条件を解除 | 「条件を解除」を実行するボタン。 | 状態: disabled=loading | onClick=() => { setQuery("") onUrlStateChange({ ...urlState, section: "audit", query: undefined, … | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:83 | confirmed |
| AdminAuditPanel | form | 現在の監査条件を export | 「現在の監査条件を export」を入力・送信するフォーム。 | - | onSubmit=async (event) => { event.preventDefault() const reason = exportReason.trim() if (!reason)… | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:90 | confirmed |
| AdminAuditPanel | label | export 理由（必須） | 「export 理由（必須）」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:104 | confirmed |
| AdminAuditPanel | input | export 理由（必須） | 「export 理由（必須）」を入力または選択する項目。 | - | onChange=(event) => setExportReason(event.target.value) | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:104 | confirmed |
| AdminAuditPanel | button | 現在の条件を export | 「現在の条件を export」を実行するボタン。 | 状態: disabled=loading \|\| exportReason.trim().length === 0 | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:105 | confirmed |
| AdminAuditPanel | a | 有効期限内に取得 | 「有効期限内に取得」へ移動するリンク。 | - | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:110 | confirmed |
| AdminAuditPanel | button | 次の履歴を読み込む（残り / 件） | 「次の履歴を読み込む（残り / 件）」を実行するボタン。 | 状態: disabled=loading | onClick=() => void onLoadMore() | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:140 | confirmed |
| AdminCostPanel | UsageQueryForm | 未推定 | UsageQueryForm 要素。静的解析では具体的な操作名を推定できません。 | - | onChange=setQuery<br>onSubmit=(event) => { event.preventDefault(); void onApplyQuery(query) } | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:30 | unknown |
| AdminCostPanel | form | 現在のコスト条件を export | 「現在のコスト条件を export」を入力・送信するフォーム。 | - | onSubmit=async (event: FormEvent) => { event.preventDefault(); if (!exportReason.trim()) return; s… | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:38 | confirmed |
| AdminCostPanel | label | export 理由（必須） | 「export 理由（必須）」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:43 | confirmed |
| AdminCostPanel | input | export 理由（必須） | 「export 理由（必須）」を入力または選択する項目。 | - | onChange=(event) => setExportReason(event.target.value) | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:43 | confirmed |
| AdminCostPanel | button | 同じ条件の全ページを export | 「同じ条件の全ページを export」を実行するボタン。 | 状態: disabled=loading \|\| !exportReason.trim() | - | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:44 | confirmed |
| AdminCostPanel | a | 有効期限内に取得 | 「有効期限内に取得」へ移動するリンク。 | - | - | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:47 | confirmed |
| AdminCostPanel | button | 次の cost item を読み込む | 「次の cost item を読み込む」を実行するボタン。 | 状態: disabled=loading | onClick=() => void onLoadMore() | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:56 | confirmed |
| AdminOverviewGrid | button | `${card.label}を開く` | 「`${card.label}を開く`」を実行するボタン。 | - | onClick=card.onSelect | apps/web/src/features/admin/components/panels/AdminOverviewGrid.tsx:205 | confirmed |
| AdminOverviewGrid | button | `${card.label}を開く` | 「`${card.label}を開く`」を実行するボタン。 | - | onClick=card.onSelect | apps/web/src/features/admin/components/panels/AdminOverviewGrid.tsx:212 | confirmed |
| AdminRolePanel | summary | 権限 ID / 件を表示 | 「権限 ID / 件を表示」の詳細を開閉する要素。 | - | - | apps/web/src/features/admin/components/panels/AdminRolePanel.tsx:55 | confirmed |
| AdminUsagePanel | UsageQueryForm | 未推定 | UsageQueryForm 要素。静的解析では具体的な操作名を推定できません。 | - | onChange=setQuery<br>onSubmit=applyFilters | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:53 | unknown |
| AdminUsagePanel | form | 現在の利用状況条件を export | 「現在の利用状況条件を export」を入力・送信するフォーム。 | - | onSubmit=exportCurrent | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:56 | confirmed |
| AdminUsagePanel | label | export 理由（必須） | 「export 理由（必須）」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:57 | confirmed |
| AdminUsagePanel | input | export 理由（必須） | 「export 理由（必須）」を入力または選択する項目。 | - | onChange=(event) => setExportReason(event.target.value) | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:57 | confirmed |
| AdminUsagePanel | button | 同じ条件の全ページを export | 「同じ条件の全ページを export」を実行するボタン。 | 状態: disabled=loading \|\| !exportReason.trim() | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:58 | confirmed |
| AdminUsagePanel | a | 有効期限内に取得 | 「有効期限内に取得」へ移動するリンク。 | - | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:61 | confirmed |
| AdminUsagePanel | button | 次の usage event を読み込む | 「次の usage event を読み込む」を実行するボタン。 | 状態: disabled=loading | onClick=() => void onLoadMore() | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:78 | confirmed |
| UsageQueryForm | form | 利用量とコストを絞り込む | 「利用量とコストを絞り込む」を入力・送信するフォーム。 | role: search | onSubmit=onSubmit | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:84 | confirmed |
| UsageQueryForm | label | 期間開始（ISO 8601） | 「期間開始（ISO 8601）」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:85 | confirmed |
| UsageQueryForm | input | 期間開始（ISO 8601） | 「期間開始（ISO 8601）」を入力または選択する項目。 | - | onChange=(event) => onChange({ ...query, periodStart: event.target.value }) | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:85 | confirmed |
| UsageQueryForm | label | 期間終了（ISO 8601・含まない） | 「期間終了（ISO 8601・含まない）」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:86 | confirmed |
| UsageQueryForm | input | 期間終了（ISO 8601・含まない） | 「期間終了（ISO 8601・含まない）」を入力または選択する項目。 | - | onChange=(event) => onChange({ ...query, periodEnd: event.target.value }) | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:86 | confirmed |
| UsageQueryForm | label | subject | 「subject」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:87 | confirmed |
| UsageQueryForm | input | subject | 「subject」を入力または選択する項目。 | - | onChange=(event) => onChange({ ...query, subjectId: event.target.value }) | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:87 | confirmed |
| UsageQueryForm | label | run | 「run」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:88 | confirmed |
| UsageQueryForm | input | run | 「run」を入力または選択する項目。 | - | onChange=(event) => onChange({ ...query, runId: event.target.value }) | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:88 | confirmed |
| UsageQueryForm | label | model | 「model」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:89 | confirmed |
| UsageQueryForm | input | model | 「model」を入力または選択する項目。 | - | onChange=(event) => onChange({ ...query, modelId: event.target.value }) | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:89 | confirmed |
| UsageQueryForm | label | feature | 「feature」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:90 | confirmed |
| UsageQueryForm | input | feature | 「feature」を入力または選択する項目。 | - | onChange=(event) => onChange({ ...query, feature: event.target.value }) | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:90 | confirmed |
| UsageQueryForm | label | provider | 「provider」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:91 | confirmed |
| UsageQueryForm | input | provider | 「provider」を入力または選択する項目。 | - | onChange=(event) => onChange({ ...query, provider: event.target.value }) | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:91 | confirmed |
| UsageQueryForm | button | 条件を適用 | 「条件を適用」を実行するボタン。 | 状態: disabled=loading | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:92 | confirmed |
| AdminUserPanel | form | 管理対象ユーザーを絞り込む | 「管理対象ユーザーを絞り込む」を入力・送信するフォーム。 | role: search | onSubmit=(event) => { event.preventDefault() onUrlStateChange({ ...urlState, section: "users", que… | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:84 | confirmed |
| AdminUserPanel | label | ユーザー・ロールを検索 | 「ユーザー・ロールを検索」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:88 | confirmed |
| AdminUserPanel | input | ユーザー・ロールを検索 | 「ユーザー・ロールを検索」を入力または選択する項目。 | - | onChange=(event) => setQuery(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:88 | confirmed |
| AdminUserPanel | label | 状態 / すべて / 有効 / 停止中 | 「状態 / すべて / 有効 / 停止中」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:89 | confirmed |
| AdminUserPanel | select | すべて / 有効 / 停止中 | 「すべて / 有効 / 停止中」を選ぶ選択項目。 | - | onChange=(event) => onUrlStateChange({ ...urlState, section: "users", userStatus: event.target.val… | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:89 | confirmed |
| AdminUserPanel | option | すべて | 「すべて」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:90 | confirmed |
| AdminUserPanel | option | 有効 | 「有効」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:90 | confirmed |
| AdminUserPanel | option | 停止中 | 「停止中」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:90 | confirmed |
| AdminUserPanel | label | 並び順 / メール昇順 / 更新日時の新しい順 | 「並び順 / メール昇順 / 更新日時の新しい順」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:92 | confirmed |
| AdminUserPanel | select | メール昇順 / 更新日時の新しい順 | 「メール昇順 / 更新日時の新しい順」を選ぶ選択項目。 | - | onChange=(event) => onUrlStateChange({ ...urlState, section: "users", userSort: event.target.value… | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:92 | confirmed |
| AdminUserPanel | option | メール昇順 | 「メール昇順」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:93 | confirmed |
| AdminUserPanel | option | 更新日時の新しい順 | 「更新日時の新しい順」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:93 | confirmed |
| AdminUserPanel | button | 検索 | 「検索」を実行するボタン。 | 状態: disabled=loading | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:95 | confirmed |
| AdminUserPanel | AdminCreateUserForm | 未推定 | AdminCreateUserForm 要素。静的解析では具体的な操作名を推定できません。 | - | onCreateUser=onCreateUser | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:98 | unknown |
| AdminUserPanel | button | 次のユーザーを読み込む（残り / 人） | 「次のユーザーを読み込む（残り / 人）」を実行するボタン。 | 状態: disabled=loading | onClick=() => void onLoadMore() | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:143 | confirmed |
| AdminCreateUserForm | form | 管理対象ユーザー作成 | 「管理対象ユーザー作成」を入力・送信するフォーム。 | - | onSubmit=(event) => void submit(event) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:189 | confirmed |
| AdminCreateUserForm | label | メール | 「メール」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:190 | confirmed |
| AdminCreateUserForm | input | new-user@example.com | 「new-user@example.com」を入力または選択する項目。 | - | onChange=(event) => setEmail(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:192 | confirmed |
| AdminCreateUserForm | label | 表示名 | 「表示名」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:194 | confirmed |
| AdminCreateUserForm | input | 任意 | 「任意」を入力または選択する項目。 | - | onChange=(event) => setDisplayName(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:196 | confirmed |
| AdminCreateUserForm | label | 初期ロール | 「初期ロール」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:198 | confirmed |
| AdminCreateUserForm | select | 初期ロール | 「初期ロール」を選ぶ選択項目。 | - | onChange=(event) => setRole(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:205 | confirmed |
| AdminCreateUserForm | option | ( / ) | 「( / )」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:207 | confirmed |
| AdminCreateUserForm | button | 作成 | 「作成」を実行するボタン。 | 状態: disabled=loading \|\| email.trim().length === 0 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:212 | confirmed |
| ManagedUserRow | label | 未推定 | label 要素。静的解析では具体的な操作名を推定できません。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:330 | unknown |
| ManagedUserRow | input | 未推定 | input 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=loading | onChange=(event) => setSelectedRoles((current) => event.target.checked ? [...current, role.role] :… | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:331 | unknown |
| ManagedUserRow | label | 変更理由（必須） | 「変更理由（必須）」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:344 | confirmed |
| ManagedUserRow | textarea | `${user.email}のロール変更理由` | 「`${user.email}のロール変更理由`」を複数行で入力する項目。 | 状態: disabled=loading | onChange=(event) => setRoleReason(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:346 | confirmed |
| ManagedUserRow | button | `${user.email}のロール変更を確認` | 「`${user.email}のロール変更を確認`」を実行するボタン。 | 状態: disabled=loading \|\| !roleChanged \|\| nextGroups.length === 0 \|\| roleReason.trim().length === 0 | onClick=() => setRoleAssignOpen(true) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:355 | confirmed |
| ManagedUserRow | button | `${user.email}の利用を再開` | 「`${user.email}の利用を再開`」を実行するボタン。 | 状態: disabled=loading | onClick=() => void applyStatus("unsuspend") | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:376 | confirmed |
| ManagedUserRow | button | `${user.email}の利用を停止` | 「`${user.email}の利用を停止`」を実行するボタン。 | 状態: disabled=loading | onClick=() => setStatusCandidate("suspend") | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:381 | confirmed |
| ManagedUserRow | button | `${user.email}を削除` | 「`${user.email}を削除`」を実行するボタン。 | 状態: disabled=loading | onClick=() => void prepareDelete() | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:386 | confirmed |
| ManagedUserRow | label | 後継管理者 | 「後継管理者」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:434 | confirmed |
| ManagedUserRow | select | `${user.email}の後継管理者` | 「`${user.email}の後継管理者`」を選ぶ選択項目。 | 状態: disabled=loading | onChange=(event) => setSuccessorUserId(event.target.value) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:436 | confirmed |
| ManagedUserRow | option | 選択してください | 「選択してください」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:444 | confirmed |
| ManagedUserRow | option | candidate.userId | 「candidate.userId」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:446 | confirmed |
| AliasAdminPanel | button | 承認済み用語展開を公開 | 「承認済み用語展開を公開」を実行するボタン。 | 状態: disabled=loading | onClick=() => { setReason(""); setPublishConfirmOpen(true) } | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:129 | confirmed |
| AliasAdminPanel | form | 用語展開を絞り込む | 「用語展開を絞り込む」を入力・送信するフォーム。 | role: search | onSubmit=applyFilters | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:138 | confirmed |
| AliasAdminPanel | label | 用語・展開語を検索 | 「用語・展開語を検索」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:139 | confirmed |
| AliasAdminPanel | input | 用語・展開語を検索 | 「用語・展開語を検索」を入力または選択する項目。 | - | onChange=(event) => setQuery(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:141 | confirmed |
| AliasAdminPanel | label | 状態 / すべて / 下書き / 承認済み / 無効 | 「状態 / すべて / 下書き / 承認済み / 無効」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:143 | confirmed |
| AliasAdminPanel | select | すべて / 下書き / 承認済み / 無効 | 「すべて / 下書き / 承認済み / 無効」を選ぶ選択項目。 | - | onChange=(event) => onUrlStateChange({ ...urlState, section: "alias", aliasStatus: event.target.va… | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:145 | confirmed |
| AliasAdminPanel | option | すべて | 「すべて」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:151 | confirmed |
| AliasAdminPanel | option | 下書き | 「下書き」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:152 | confirmed |
| AliasAdminPanel | option | 承認済み | 「承認済み」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:153 | confirmed |
| AliasAdminPanel | option | 無効 | 「無効」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:154 | confirmed |
| AliasAdminPanel | label | 並び順 / 更新が新しい順 / 用語順 | 「並び順 / 更新が新しい順 / 用語順」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:157 | confirmed |
| AliasAdminPanel | select | 更新が新しい順 / 用語順 | 「更新が新しい順 / 用語順」を選ぶ選択項目。 | - | onChange=(event) => onUrlStateChange({ ...urlState, section: "alias", sort: event.target.value as … | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:159 | confirmed |
| AliasAdminPanel | option | 更新が新しい順 | 「更新が新しい順」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:165 | confirmed |
| AliasAdminPanel | option | 用語順 | 「用語順」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:166 | confirmed |
| AliasAdminPanel | button | 検索 | 「検索」を実行するボタン。 | 状態: disabled=loading | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:169 | confirmed |
| AliasAdminPanel | button | 条件を解除 | 「条件を解除」を実行するボタン。 | 状態: disabled=loading | onClick=() => { setQuery("") onUrlStateChange({ ...urlState, section: "alias", query: undefined, … | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:171 | confirmed |
| AliasAdminPanel | form | 用語 / 展開語（カンマまたは改行区切り） / 適用部署（任意） / 下書きを追加 | 「用語 / 展開語（カンマまたは改行区切り） / 適用部署（任意） / 下書きを追加」を入力・送信するフォーム。 | - | onSubmit=(event) => void submitCreate(event) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:185 | confirmed |
| AliasAdminPanel | label | 用語 | 「用語」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:186 | confirmed |
| AliasAdminPanel | input | 用語 | 「用語」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => setTerm(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:188 | confirmed |
| AliasAdminPanel | label | 展開語（カンマまたは改行区切り） | 「展開語（カンマまたは改行区切り）」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:190 | confirmed |
| AliasAdminPanel | textarea | 展開語（カンマまたは改行区切り） | 「展開語（カンマまたは改行区切り）」を複数行で入力する項目。 | 状態: disabled=loading | onChange=(event) => setExpansions(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:192 | confirmed |
| AliasAdminPanel | label | 適用部署（任意） | 「適用部署（任意）」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:194 | confirmed |
| AliasAdminPanel | input | 適用部署（任意） | 「適用部署（任意）」を入力または選択する項目。 | 状態: disabled=loading | onChange=(event) => setDepartment(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:196 | confirmed |
| AliasAdminPanel | button | 下書きを追加 | 「下書きを追加」を実行するボタン。 | 状態: disabled=loading \|\| !term.trim() \|\| parseExpansionList(expansions).length === 0 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:198 | confirmed |
| AliasAdminPanel | button | 全件表示へ戻す / 絞り込む | 「全件表示へ戻す / 絞り込む」を実行するボタン。 | - | onClick=() => onUrlStateChange({ ...urlState, section: "alias", selected: urlState.selected === a… | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:225 | confirmed |
| AliasAdminPanel | button | `${alias.term}を編集` | 「`${alias.term}を編集`」を実行するボタン。 | 状態: disabled=loading | onClick=() => openEdit(alias) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:233 | confirmed |
| AliasAdminPanel | button | `${alias.term}を承認` | 「`${alias.term}を承認`」を実行するボタン。 | 状態: disabled=loading | onClick=() => { setReason(""); setCommandCandidate({ alias, command: "approve" }) } | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:237 | confirmed |
| AliasAdminPanel | button | `${alias.term}を差し戻し` | 「`${alias.term}を差し戻し`」を実行するボタン。 | 状態: disabled=loading | onClick=() => { setReason(""); setCommandCandidate({ alias, command: "reject" }) } | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:238 | confirmed |
| AliasAdminPanel | button | `${alias.term}を下書きへ戻す` | 「`${alias.term}を下書きへ戻す`」を実行するボタン。 | 状態: disabled=loading | onClick=() => { setReason(""); setCommandCandidate({ alias, command: "transition" }) } | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:242 | confirmed |
| AliasAdminPanel | button | `${alias.term}を無効化` | 「`${alias.term}を無効化`」を実行するボタン。 | 状態: disabled=loading | onClick=() => { setReason(""); setCommandCandidate({ alias, command: "disable" }) } | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:245 | confirmed |
| AliasAdminPanel | button | 次の用語展開を読み込む（残り / 件） | 「次の用語展開を読み込む（残り / 件）」を実行するボタン。 | 状態: disabled=loading | onClick=() => void onLoadMore() | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:253 | confirmed |
| AliasAdminPanel | label | 監査操作 / すべて / 作成 / 更新 / レビュー / 状態遷移 / 無効化 / 公開 | 「監査操作 / すべて / 作成 / 更新 / レビュー / 状態遷移 / 無効化 / 公開」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:263 | confirmed |
| AliasAdminPanel | select | すべて / 作成 / 更新 / レビュー / 状態遷移 / 無効化 / 公開 | 「すべて / 作成 / 更新 / レビュー / 状態遷移 / 無効化 / 公開」を選ぶ選択項目。 | - | onChange=(event) => onUrlStateChange({ ...urlState, section: "alias", auditAction: event.target.va… | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:265 | confirmed |
| AliasAdminPanel | option | すべて | 「すべて」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:270 | confirmed |
| AliasAdminPanel | option | 作成 | 「作成」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:271 | confirmed |
| AliasAdminPanel | option | 更新 | 「更新」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:272 | confirmed |
| AliasAdminPanel | option | レビュー | 「レビュー」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:273 | confirmed |
| AliasAdminPanel | option | 状態遷移 | 「状態遷移」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:274 | confirmed |
| AliasAdminPanel | option | 無効化 | 「無効化」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:275 | confirmed |
| AliasAdminPanel | option | 公開 | 「公開」を表す option 要素。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:276 | confirmed |
| AliasAdminPanel | button | 次の監査ログを読み込む（残り / 件） | 「次の監査ログを読み込む（残り / 件）」を実行するボタン。 | 状態: disabled=loading | onClick=() => void onLoadMoreAudit() | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:306 | confirmed |
| AliasAdminPanel | label | 用語 | 「用語」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:381 | confirmed |
| AliasAdminPanel | input | 用語 | 「用語」を入力または選択する項目。 | - | onChange=(event) => setEditTerm(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:381 | confirmed |
| AliasAdminPanel | label | 展開語 | 「展開語」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:382 | confirmed |
| AliasAdminPanel | textarea | 展開語 | 「展開語」を複数行で入力する項目。 | - | onChange=(event) => setEditExpansions(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:382 | confirmed |
| ReasonField | label | 実行理由（必須） | 「実行理由（必須）」に紐づく入力ラベル。 | - | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:425 | confirmed |
| ReasonField | textarea | 実行理由（必須） | 「実行理由（必須）」を複数行で入力する項目。 | - | onChange=(event) => onChange(event.target.value) | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:427 | confirmed |
