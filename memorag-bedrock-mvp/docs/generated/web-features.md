# Web 機能一覧

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。

## 機能サマリ

| 機能 | feature | 関連画面 | コンポーネント数 | UI 操作要素数 |
| --- | --- | --- | --- | --- |
| 管理 | admin | admin | 1 | 37 |
| アプリケーション枠 | app | profile | 7 | 38 |
| 認証 | auth | - | 2 | 25 |
| 性能テスト | benchmark | benchmark | 1 | 18 |
| チャット | chat | chat | 10 | 44 |
| デバッグ | debug | - | 1 | 13 |
| ドキュメント | documents | documents | 1 | 25 |
| 履歴 | history | history, favorites | 1 | 11 |
| 担当者対応 | questions | assignee | 1 | 21 |
| 共通 | shared | - | 2 | 0 |

## UI 操作要素

| 機能 | コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| アプリケーション枠 | App | LoginPage | 未推定 | onLogin=login<br>onSignUp=signUp<br>onConfirmSignUp=confirmSignUp<br>onCompleteNewPassword=completeNewPassword | apps/web/src/App.tsx:10 | unknown |
| アプリケーション枠 | App | AppShell | 未推定 | onSignOut=logout | apps/web/src/App.tsx:19 | unknown |
| アプリケーション枠 | AppShell | RailNav | 未推定 | - | apps/web/src/app/AppShell.tsx:13 | unknown |
| アプリケーション枠 | PersonalSettingsView | button | チャットへ戻る | onClick=onBack | apps/web/src/app/components/PersonalSettingsView.tsx:25 | confirmed |
| アプリケーション枠 | PersonalSettingsView | label | 送信キー / Enterで送信 / Ctrl+Enterで送信 | - | apps/web/src/app/components/PersonalSettingsView.tsx:35 | confirmed |
| アプリケーション枠 | PersonalSettingsView | select | submitShortcut | onChange=(event) => onSetSubmitShortcut(event.target.value as SubmitShortcut) | apps/web/src/app/components/PersonalSettingsView.tsx:37 | confirmed |
| アプリケーション枠 | PersonalSettingsView | option | enter | - | apps/web/src/app/components/PersonalSettingsView.tsx:42 | confirmed |
| アプリケーション枠 | PersonalSettingsView | option | ctrlEnter | - | apps/web/src/app/components/PersonalSettingsView.tsx:43 | confirmed |
| アプリケーション枠 | PersonalSettingsView | button | サインアウト | onClick=onSignOut | apps/web/src/app/components/PersonalSettingsView.tsx:48 | confirmed |
| アプリケーション枠 | RailNav | a | ホーム | - | apps/web/src/app/components/RailNav.tsx:24 | confirmed |
| アプリケーション枠 | RailNav | button | チャット | onClick=() => onChangeView("chat") | apps/web/src/app/components/RailNav.tsx:28 | confirmed |
| アプリケーション枠 | RailNav | button | 担当者対応 | onClick=() => onChangeView("assignee") | apps/web/src/app/components/RailNav.tsx:33 | confirmed |
| アプリケーション枠 | RailNav | button | 履歴 | onClick=() => onChangeView("history") | apps/web/src/app/components/RailNav.tsx:38 | confirmed |
| アプリケーション枠 | RailNav | button | 性能テスト | onClick=() => onChangeView("benchmark") | apps/web/src/app/components/RailNav.tsx:43 | confirmed |
| アプリケーション枠 | RailNav | button | お気に入り | onClick=() => onChangeView("favorites") | apps/web/src/app/components/RailNav.tsx:48 | confirmed |
| アプリケーション枠 | RailNav | button | ドキュメント | onClick=() => onChangeView("documents") | apps/web/src/app/components/RailNav.tsx:53 | confirmed |
| アプリケーション枠 | RailNav | button | 管理者設定 | onClick=() => onChangeView("admin") | apps/web/src/app/components/RailNav.tsx:59 | confirmed |
| アプリケーション枠 | RailNav | button | 個人設定 | onClick=() => onChangeView("profile") | apps/web/src/app/components/RailNav.tsx:65 | confirmed |
| アプリケーション枠 | TopBar | label | モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku | - | apps/web/src/app/components/TopBar.tsx:49 | confirmed |
| アプリケーション枠 | TopBar | select | modelId | onChange=(event) => onModelChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:51 | confirmed |
| アプリケーション枠 | TopBar | option | amazon.nova-lite-v1:0 | - | apps/web/src/app/components/TopBar.tsx:52 | confirmed |
| アプリケーション枠 | TopBar | option | anthropic.claude-3-5-sonnet-20240620-v1:0 | - | apps/web/src/app/components/TopBar.tsx:53 | confirmed |
| アプリケーション枠 | TopBar | option | anthropic.claude-3-haiku-20240307-v1:0 | - | apps/web/src/app/components/TopBar.tsx:54 | confirmed |
| アプリケーション枠 | TopBar | label | ドキュメント | - | apps/web/src/app/components/TopBar.tsx:59 | confirmed |
| アプリケーション枠 | TopBar | select | デバッグ表示用の文書選択 | onChange=(event) => onDocumentChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:61 | confirmed |
| アプリケーション枠 | TopBar | option | all | - | apps/web/src/app/components/TopBar.tsx:62 | confirmed |
| アプリケーション枠 | TopBar | option | document.documentId | - | apps/web/src/app/components/TopBar.tsx:64 | confirmed |
| アプリケーション枠 | TopBar | select | 参照フォルダ | onChange=(event) => onGroupChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:69 | confirmed |
| アプリケーション枠 | TopBar | option | all | - | apps/web/src/app/components/TopBar.tsx:70 | confirmed |
| アプリケーション枠 | TopBar | option | group.groupId | - | apps/web/src/app/components/TopBar.tsx:72 | confirmed |
| アプリケーション枠 | TopBar | label | 実行ID | - | apps/web/src/app/components/TopBar.tsx:82 | confirmed |
| アプリケーション枠 | TopBar | select | selectedRunValue | onChange=(event) => onRunChange(event.target.value) | apps/web/src/app/components/TopBar.tsx:84 | confirmed |
| アプリケーション枠 | TopBar | option | __processing__ | - | apps/web/src/app/components/TopBar.tsx:89 | confirmed |
| アプリケーション枠 | TopBar | option | 未実行 | - | apps/web/src/app/components/TopBar.tsx:89 | confirmed |
| アプリケーション枠 | TopBar | option | run.runId | - | apps/web/src/app/components/TopBar.tsx:91 | confirmed |
| アプリケーション枠 | TopBar | label | デバッグモード | - | apps/web/src/app/components/TopBar.tsx:101 | confirmed |
| アプリケーション枠 | TopBar | input | 未推定 | onChange=(event) => onDebugModeChange(event.target.checked) | apps/web/src/app/components/TopBar.tsx:103 | unknown |
| アプリケーション枠 | TopBar | button | 新しい会話 | onClick=onNewConversation | apps/web/src/app/components/TopBar.tsx:108 | confirmed |
| 管理 | AdminWorkspace | button | チャットへ戻る | onClick=onBack | apps/web/src/features/admin/components/AdminWorkspace.tsx:108 | confirmed |
| 管理 | AdminWorkspace | button | ドキュメント管理 / 件 | onClick=onOpenDocuments | apps/web/src/features/admin/components/AdminWorkspace.tsx:120 | confirmed |
| 管理 | AdminWorkspace | button | 担当者対応 / 件が対応待ち | onClick=onOpenAssignee | apps/web/src/features/admin/components/AdminWorkspace.tsx:127 | confirmed |
| 管理 | AdminWorkspace | button | デバッグ / 評価 / 件の実行履歴 | onClick=onOpenDebug | apps/web/src/features/admin/components/AdminWorkspace.tsx:134 | confirmed |
| 管理 | AdminWorkspace | button | 性能テスト / 件の実行履歴 | onClick=onOpenBenchmark | apps/web/src/features/admin/components/AdminWorkspace.tsx:141 | confirmed |
| 管理 | AdminWorkspace | AliasAdminPanel | 未推定 | onCreate=onCreateAlias<br>onUpdate=onUpdateAlias<br>onReview=onReviewAlias<br>onDisable=onDisableAlias<br>onPublish=onPublishAliases | apps/web/src/features/admin/components/AdminWorkspace.tsx:186 | unknown |
| 管理 | AdminWorkspace | button | 更新 | onClick=() => void onRefreshAdminData() | apps/web/src/features/admin/components/AdminWorkspace.tsx:206 | confirmed |
| 管理 | AdminWorkspace | AdminCreateUserForm | 未推定 | onCreateUser=onCreateUser | apps/web/src/features/admin/components/AdminWorkspace.tsx:212 | unknown |
| 管理 | AdminWorkspace | ManagedUserRow | 未推定 | onAssignRoles=onAssignRoles<br>onSetStatus=onSetUserStatus | apps/web/src/features/admin/components/AdminWorkspace.tsx:225 | unknown |
| 管理 | AliasAdminPanel | button | 公開 | onClick=() => void onPublish() | apps/web/src/features/admin/components/AdminWorkspace.tsx:405 | confirmed |
| 管理 | AliasAdminPanel | form | 用語 / 展開語 / 部署 scope / 追加 | onSubmit=(event) => void onSubmit(event) | apps/web/src/features/admin/components/AdminWorkspace.tsx:413 | confirmed |
| 管理 | AliasAdminPanel | label | 用語 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:414 | confirmed |
| 管理 | AliasAdminPanel | input | pto | onChange=(event) => setTerm(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:416 | confirmed |
| 管理 | AliasAdminPanel | label | 展開語 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:418 | confirmed |
| 管理 | AliasAdminPanel | input | 有給休暇, 休暇申請 | onChange=(event) => setExpansions(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:420 | confirmed |
| 管理 | AliasAdminPanel | label | 部署 scope | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:422 | confirmed |
| 管理 | AliasAdminPanel | input | 任意 | onChange=(event) => setDepartment(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:424 | confirmed |
| 管理 | AliasAdminPanel | button | 追加 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:426 | confirmed |
| 管理 | AliasAdminPanel | button | 下書き化 | onClick=() => void onUpdate(alias.aliasId, { expansions: alias.expansions }) | apps/web/src/features/admin/components/AdminWorkspace.tsx:445 | confirmed |
| 管理 | AliasAdminPanel | button | 承認 | onClick=() => void onReview(alias.aliasId, "approve") | apps/web/src/features/admin/components/AdminWorkspace.tsx:449 | confirmed |
| 管理 | AliasAdminPanel | button | 差戻 | onClick=() => void onReview(alias.aliasId, "reject", "Rejected from UI") | apps/web/src/features/admin/components/AdminWorkspace.tsx:453 | confirmed |
| 管理 | AliasAdminPanel | button | 無効 | onClick=() => void onDisable(alias.aliasId) | apps/web/src/features/admin/components/AdminWorkspace.tsx:457 | confirmed |
| 管理 | AdminCreateUserForm | form | 管理対象ユーザー作成 | onSubmit=(event) => void submit(event) | apps/web/src/features/admin/components/AdminWorkspace.tsx:513 | confirmed |
| 管理 | AdminCreateUserForm | label | メール | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:514 | confirmed |
| 管理 | AdminCreateUserForm | input | new-user@example.com | onChange=(event) => setEmail(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:516 | confirmed |
| 管理 | AdminCreateUserForm | label | 表示名 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:518 | confirmed |
| 管理 | AdminCreateUserForm | input | 任意 | onChange=(event) => setDisplayName(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:520 | confirmed |
| 管理 | AdminCreateUserForm | label | 初期ロール | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:522 | confirmed |
| 管理 | AdminCreateUserForm | select | role | onChange=(event) => setRole(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:524 | confirmed |
| 管理 | AdminCreateUserForm | option | roleDefinition.role | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:526 | confirmed |
| 管理 | AdminCreateUserForm | button | 作成 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:530 | confirmed |
| 管理 | ManagedUserRow | select | selectedRole | onChange=(event) => setSelectedRole(event.target.value) | apps/web/src/features/admin/components/AdminWorkspace.tsx:576 | confirmed |
| 管理 | ManagedUserRow | option | role.role | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:578 | confirmed |
| 管理 | ManagedUserRow | button | 付与 | onClick=() => void onAssignRoles(user.userId, [selectedRole]) | apps/web/src/features/admin/components/AdminWorkspace.tsx:581 | confirmed |
| 管理 | ManagedUserRow | button | 再開 | onClick=() => void onSetStatus(user.userId, "unsuspend") | apps/web/src/features/admin/components/AdminWorkspace.tsx:591 | confirmed |
| 管理 | ManagedUserRow | button | 停止 | onClick=() => void onSetStatus(user.userId, "suspend") | apps/web/src/features/admin/components/AdminWorkspace.tsx:596 | confirmed |
| 管理 | ManagedUserRow | button | 削除 | onClick=() => void onSetStatus(user.userId, "delete") | apps/web/src/features/admin/components/AdminWorkspace.tsx:601 | confirmed |
| 認証 | LoginPage | form | 未推定 | onSubmit=onSubmit | apps/web/src/features/auth/components/LoginPage.tsx:213 | unknown |
| 認証 | LoginPage | label | 新しいパスワード | - | apps/web/src/features/auth/components/LoginPage.tsx:220 | confirmed |
| 認証 | LoginPage | input | 新しいパスワードを入力 | onChange=(e) => setNewPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:221 | confirmed |
| 認証 | LoginPage | label | 新しいパスワード（確認） | - | apps/web/src/features/auth/components/LoginPage.tsx:229 | confirmed |
| 認証 | LoginPage | input | 新しいパスワードを再入力 | onChange=(e) => setConfirmPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:230 | confirmed |
| 認証 | LoginPage | label | メールアドレス | - | apps/web/src/features/auth/components/LoginPage.tsx:240 | confirmed |
| 認証 | LoginPage | input | メールアドレスを入力 | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:241 | confirmed |
| 認証 | LoginPage | label | 確認コード | - | apps/web/src/features/auth/components/LoginPage.tsx:242 | confirmed |
| 認証 | LoginPage | input | 確認コードを入力 | onChange=(e) => setConfirmationCode(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:243 | confirmed |
| 認証 | LoginPage | label | メールアドレス | - | apps/web/src/features/auth/components/LoginPage.tsx:254 | confirmed |
| 認証 | LoginPage | input | メールアドレスを入力 | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:255 | confirmed |
| 認証 | LoginPage | label | パスワード | - | apps/web/src/features/auth/components/LoginPage.tsx:256 | confirmed |
| 認証 | LoginPage | input | パスワードを入力 | onChange=(e) => setPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:257 | confirmed |
| 認証 | LoginPage | label | パスワード（確認） | - | apps/web/src/features/auth/components/LoginPage.tsx:259 | confirmed |
| 認証 | LoginPage | input | パスワードを再入力 | onChange=(e) => setSignUpPasswordConfirm(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:260 | confirmed |
| 認証 | LoginPage | label | メールアドレス | - | apps/web/src/features/auth/components/LoginPage.tsx:270 | confirmed |
| 認証 | LoginPage | input | メールアドレスを入力 | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:271 | confirmed |
| 認証 | LoginPage | label | パスワード | - | apps/web/src/features/auth/components/LoginPage.tsx:272 | confirmed |
| 認証 | LoginPage | input | パスワードを入力 | onChange=(e) => setPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:273 | confirmed |
| 認証 | LoginPage | label | ログイン状態を保持 | - | apps/web/src/features/auth/components/LoginPage.tsx:277 | confirmed |
| 認証 | LoginPage | input | 未推定 | onChange=(e) => setRemember(e.target.checked) | apps/web/src/features/auth/components/LoginPage.tsx:277 | unknown |
| 認証 | LoginPage | button | 未推定 | - | apps/web/src/features/auth/components/LoginPage.tsx:281 | unknown |
| 認証 | LoginPage | button | アカウント作成 | onClick=() => switchMode("signUp") | apps/web/src/features/auth/components/LoginPage.tsx:289 | confirmed |
| 認証 | LoginPage | button | 確認コード入力 | onClick=() => switchMode("confirmSignUp") | apps/web/src/features/auth/components/LoginPage.tsx:290 | confirmed |
| 認証 | LoginPage | button | サインインへ戻る | onClick=() => switchMode("signIn") | apps/web/src/features/auth/components/LoginPage.tsx:293 | confirmed |
| 性能テスト | BenchmarkWorkspace | button | チャットへ戻る | onClick=onBack | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:57 | confirmed |
| 性能テスト | BenchmarkWorkspace | label | テスト種別 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:83 | confirmed |
| 性能テスト | BenchmarkWorkspace | select | suiteId | onChange=(event) => onSuiteChange(event.target.value) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:85 | confirmed |
| 性能テスト | BenchmarkWorkspace | option | suiteId | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:86 | confirmed |
| 性能テスト | BenchmarkWorkspace | option | suite.suiteId | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:88 | confirmed |
| 性能テスト | BenchmarkWorkspace | label | データセット | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:104 | confirmed |
| 性能テスト | BenchmarkWorkspace | input | selectedSuite?.datasetS3Key ?? "datasets/agent/standard-v1.jsonl" | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:106 | confirmed |
| 性能テスト | BenchmarkWorkspace | label | モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:108 | confirmed |
| 性能テスト | BenchmarkWorkspace | select | modelId | onChange=(event) => onModelChange(event.target.value) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:110 | confirmed |
| 性能テスト | BenchmarkWorkspace | option | amazon.nova-lite-v1:0 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:111 | confirmed |
| 性能テスト | BenchmarkWorkspace | option | anthropic.claude-3-5-sonnet-20240620-v1:0 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:112 | confirmed |
| 性能テスト | BenchmarkWorkspace | option | anthropic.claude-3-haiku-20240307-v1:0 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:113 | confirmed |
| 性能テスト | BenchmarkWorkspace | label | 並列数 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:116 | confirmed |
| 性能テスト | BenchmarkWorkspace | input | concurrency | onChange=(event) => onConcurrencyChange(Math.max(1, Math.min(20, Number(event.target.value) \|\| 1))) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:118 | confirmed |
| 性能テスト | BenchmarkWorkspace | button | 性能テストを実行 | onClick=onStart | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:127 | confirmed |
| 性能テスト | BenchmarkWorkspace | button | 更新 | onClick=onRefresh | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:131 | confirmed |
| 性能テスト | BenchmarkWorkspace | button | `${artifact.description}をダウンロード` | onClick=() => void downloadBenchmarkArtifact(run.runId, artifact.kind) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:183 | confirmed |
| 性能テスト | BenchmarkWorkspace | button | ジョブをキャンセル | onClick=() => void onCancel(run.runId) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:195 | confirmed |
| チャット | AssistantAnswer | a | 未推定 | - | apps/web/src/features/chat/components/AssistantAnswer.tsx:80 | unknown |
| チャット | AssistantAnswer | button | copyStatus === "answer" ? "回答をコピー済み" : "回答をコピー" | onClick=() => copyText(message.text) | apps/web/src/features/chat/components/AssistantAnswer.tsx:89 | confirmed |
| チャット | AssistantAnswer | button | option.reason ?? "この候補で質問する" | onClick=() => void onSubmitClarificationOption(option, message.sourceQuestion ?? message.text) | apps/web/src/features/chat/components/AssistantAnswer.tsx:110 | confirmed |
| チャット | AssistantAnswer | button | 自分で入力 | onClick=() => onStartClarificationFreeform(message.sourceQuestion ?? message.text, "例: 経費精算の申請期限は… | apps/web/src/features/chat/components/AssistantAnswer.tsx:120 | confirmed |
| チャット | AssistantAnswer | QuestionEscalationPanel | 未推定 | onCreateQuestion=onCreateQuestion | apps/web/src/features/chat/components/AssistantAnswer.tsx:131 | unknown |
| チャット | AssistantAnswer | QuestionAnswerPanel | 未推定 | onResolveQuestion=onResolveQuestion<br>onAdditionalQuestion=onAdditionalQuestion | apps/web/src/features/chat/components/AssistantAnswer.tsx:134 | unknown |
| チャット | ChatComposer | form | 未推定 | onSubmit=onAsk | apps/web/src/features/chat/components/ChatComposer.tsx:39 | unknown |
| チャット | ChatComposer | textarea | 質問 | onChange=(event) => onSetQuestion(event.target.value)<br>onKeyDown=(event) => { if (event.key !== "Enter") return if (submitShortcut === "enter") { if (!eve… | apps/web/src/features/chat/components/ChatComposer.tsx:40 | confirmed |
| チャット | ChatComposer | label | 資料を添付 | - | apps/web/src/features/chat/components/ChatComposer.tsx:71 | confirmed |
| チャット | ChatComposer | input | 未推定 | onChange=(event) => onSetFile(event.target.files?.[0] ?? null) | apps/web/src/features/chat/components/ChatComposer.tsx:73 | unknown |
| チャット | ChatComposer | button | 送信 | - | apps/web/src/features/chat/components/ChatComposer.tsx:76 | confirmed |
| チャット | ChatEmptyState | button | 未推定 | onClick=() => onSelectPrompt(prompt) | apps/web/src/features/chat/components/ChatEmptyState.tsx:21 | unknown |
| チャット | ChatView | MessageList | 未推定 | onSelectPrompt=onSetQuestion<br>onCreateQuestion=onCreateQuestion<br>onResolveQuestion=onResolveQuestion<br>onSubmitClarificationOption=onSubmitClarificationOption<br>onStartClarificationFreeform=onStartClarificationFreeform | apps/web/src/features/chat/components/ChatView.tsx:78 | unknown |
| チャット | ChatView | ChatComposer | 未推定 | onAsk=onAsk<br>onSetQuestion=onSetQuestion<br>onSetFile=onSetFile | apps/web/src/features/chat/components/ChatView.tsx:93 | unknown |
| チャット | ChatView | DebugPanel | 未推定 | onToggleAll=onToggleAllDebugSteps<br>onToggleStep=onToggleDebugStep | apps/web/src/features/chat/components/ChatView.tsx:111 | unknown |
| チャット | MessageItem | AssistantAnswer | 未推定 | onCreateQuestion=(input) => onCreateQuestion(messageIndex, message, input)<br>onResolveQuestion=onResolveQuestion<br>onAdditionalQuestion=onAdditionalQuestion<br>onSubmitClarificationOption=onSubmitClarificationOption<br>onStartClarificationFreeform=onStartClarificationFreeform | apps/web/src/features/chat/components/MessageItem.tsx:43 | unknown |
| チャット | MessageList | ChatEmptyState | 未推定 | onSelectPrompt=onSelectPrompt | apps/web/src/features/chat/components/MessageList.tsx:41 | unknown |
| チャット | MessageList | MessageItem | 未推定 | onCreateQuestion=onCreateQuestion<br>onResolveQuestion=onResolveQuestion<br>onAdditionalQuestion=onSelectPrompt<br>onSubmitClarificationOption=onSubmitClarificationOption<br>onStartClarificationFreeform=onStartClarificationFreeform | apps/web/src/features/chat/components/MessageList.tsx:43 | unknown |
| チャット | QuestionAnswerPanel | button | 解決した | onClick=() => onResolveQuestion(question.questionId) | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx:40 | confirmed |
| チャット | QuestionAnswerPanel | button | 追加で質問する | onClick=() => onAdditionalQuestion(`追加確認: ${question.title}\n`) | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx:44 | confirmed |
| チャット | QuestionEscalationPanel | form | 担当者へ質問 | onSubmit=onSubmit | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:56 | confirmed |
| チャット | QuestionEscalationPanel | label | 件名 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:63 | confirmed |
| チャット | QuestionEscalationPanel | input | title | onChange=(event) => setTitle(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:65 | confirmed |
| チャット | QuestionEscalationPanel | label | 質問内容 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:67 | confirmed |
| チャット | QuestionEscalationPanel | textarea | body | onChange=(event) => setBody(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:69 | confirmed |
| チャット | QuestionEscalationPanel | label | カテゴリ / その他の質問 / 手続き / 社内制度 / 資料確認 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:72 | confirmed |
| チャット | QuestionEscalationPanel | select | category | onChange=(event) => setCategory(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:74 | confirmed |
| チャット | QuestionEscalationPanel | option | その他の質問 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:75 | confirmed |
| チャット | QuestionEscalationPanel | option | 手続き | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:76 | confirmed |
| チャット | QuestionEscalationPanel | option | 社内制度 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:77 | confirmed |
| チャット | QuestionEscalationPanel | option | 資料確認 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:78 | confirmed |
| チャット | QuestionEscalationPanel | label | 優先度 / 通常 / 高 / 緊急 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:81 | confirmed |
| チャット | QuestionEscalationPanel | select | priority | onChange=(event) => setPriority(event.target.value as HumanQuestion["priority"]) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:83 | confirmed |
| チャット | QuestionEscalationPanel | option | normal | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:84 | confirmed |
| チャット | QuestionEscalationPanel | option | high | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:85 | confirmed |
| チャット | QuestionEscalationPanel | option | urgent | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:86 | confirmed |
| チャット | QuestionEscalationPanel | label | 担当部署 / 総務部 / 人事部 / 情報システム部 / 経理部 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:90 | confirmed |
| チャット | QuestionEscalationPanel | select | assigneeDepartment | onChange=(event) => setAssigneeDepartment(event.target.value) | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:92 | confirmed |
| チャット | QuestionEscalationPanel | option | 総務部 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:93 | confirmed |
| チャット | QuestionEscalationPanel | option | 人事部 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:94 | confirmed |
| チャット | QuestionEscalationPanel | option | 情報システム部 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:95 | confirmed |
| チャット | QuestionEscalationPanel | option | 経理部 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:96 | confirmed |
| チャット | QuestionEscalationPanel | button | 担当者へ送信 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:101 | confirmed |
| チャット | UserPromptBubble | button | copyStatus === "copied" ? "プロンプトをコピー済み" : "プロンプトをコピー" | onClick=copyPrompt | apps/web/src/features/chat/components/UserPromptBubble.tsx:47 | confirmed |
| デバッグ | DebugPanel | button | 保存済みJSONをダウンロード | onClick=() => void downloadDebugTrace(activeTrace) | apps/web/src/features/debug/components/DebugPanel.tsx:95 | confirmed |
| デバッグ | DebugPanel | button | 可視化JSONをダウンロード | onClick=() => downloadDebugReplayEnvelope(envelope) | apps/web/src/features/debug/components/DebugPanel.tsx:99 | confirmed |
| デバッグ | DebugPanel | label | JSONをアップロード | - | apps/web/src/features/debug/components/DebugPanel.tsx:103 | confirmed |
| デバッグ | DebugPanel | input | 未推定 | onChange=(event) => void onUploadDebugJson(event) | apps/web/src/features/debug/components/DebugPanel.tsx:106 | unknown |
| デバッグ | DebugPanel | button | アップロード表示を解除 | onClick=clearReplay | apps/web/src/features/debug/components/DebugPanel.tsx:109 | confirmed |
| デバッグ | DebugPanel | button | 未推定 | onClick=onToggleAll | apps/web/src/features/debug/components/DebugPanel.tsx:114 | unknown |
| デバッグ | DebugPanel | button | 拡大表示 | - | apps/web/src/features/debug/components/DebugPanel.tsx:116 | confirmed |
| デバッグ | DebugPanel | DebugFlowNodeButton | 未推定 | onSelect=() => setSelectedNodeId(node.id) | apps/web/src/features/debug/components/DebugPanel.tsx:128 | unknown |
| デバッグ | DebugPanel | DebugNodeDetailPanel | 未推定 | - | apps/web/src/features/debug/components/DebugPanel.tsx:137 | unknown |
| デバッグ | DebugPanel | AnswerSupportPanel | 未推定 | - | apps/web/src/features/debug/components/DebugPanel.tsx:142 | unknown |
| デバッグ | DebugPanel | ContextAssemblyPanel | 未推定 | - | apps/web/src/features/debug/components/DebugPanel.tsx:143 | unknown |
| デバッグ | DebugPanel | button | 未推定 | onClick=() => onToggleStep(step.id) | apps/web/src/features/debug/components/DebugPanel.tsx:154 | unknown |
| デバッグ | DebugFlowNodeButton | button | 未推定 | onClick=onSelect | apps/web/src/features/debug/components/DebugPanel.tsx:234 | unknown |
| ドキュメント | DocumentWorkspace | button | 管理者設定へ戻る | onClick=onBack | apps/web/src/features/documents/components/DocumentWorkspace.tsx:75 | confirmed |
| ドキュメント | DocumentWorkspace | form | 保存先フォルダ / フォルダなし / アップロード | onSubmit=onSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:88 | confirmed |
| ドキュメント | DocumentWorkspace | label | 保存先フォルダ / フォルダなし | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:89 | confirmed |
| ドキュメント | DocumentWorkspace | select | uploadGroupId | onChange=(event) => onUploadGroupChange(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:91 | confirmed |
| ドキュメント | DocumentWorkspace | option | フォルダなし | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:92 | confirmed |
| ドキュメント | DocumentWorkspace | option | group.groupId | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:94 | confirmed |
| ドキュメント | DocumentWorkspace | label | 未推定 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:98 | unknown |
| ドキュメント | DocumentWorkspace | input | 未推定 | onChange=(event) => setUploadFile(event.target.files?.[0] ?? null) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:101 | unknown |
| ドキュメント | DocumentWorkspace | button | アップロード | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:103 | confirmed |
| ドキュメント | DocumentWorkspace | form | 新規フォルダ / 作成 | onSubmit=onCreateGroupSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:112 | confirmed |
| ドキュメント | DocumentWorkspace | label | 新規フォルダ | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:113 | confirmed |
| ドキュメント | DocumentWorkspace | input | 社内規定 | onChange=(event) => setGroupName(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:115 | confirmed |
| ドキュメント | DocumentWorkspace | button | 作成 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:117 | confirmed |
| ドキュメント | DocumentWorkspace | form | 共有フォルダ / 選択してください / 共有 Cognito group / 共有更新 | onSubmit=onShareSubmit | apps/web/src/features/documents/components/DocumentWorkspace.tsx:119 | confirmed |
| ドキュメント | DocumentWorkspace | label | 共有フォルダ / 選択してください | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:120 | confirmed |
| ドキュメント | DocumentWorkspace | select | shareGroupId | onChange=(event) => setShareGroupId(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:122 | confirmed |
| ドキュメント | DocumentWorkspace | option | 選択してください | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:123 | confirmed |
| ドキュメント | DocumentWorkspace | option | group.groupId | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:125 | confirmed |
| ドキュメント | DocumentWorkspace | label | 共有 Cognito group | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:129 | confirmed |
| ドキュメント | DocumentWorkspace | input | CHAT_USER,RAG_GROUP_MANAGER | onChange=(event) => setShareGroups(event.target.value) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:131 | confirmed |
| ドキュメント | DocumentWorkspace | button | 共有更新 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:133 | confirmed |
| ドキュメント | DocumentWorkspace | button | `${document.fileName}の再インデックスをステージング` | onClick=() => void onStageReindex(document.documentId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:175 | confirmed |
| ドキュメント | DocumentWorkspace | button | `${document.fileName}を削除` | onClick=() => onDelete(document.documentId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:183 | confirmed |
| ドキュメント | DocumentWorkspace | button | 切替 | onClick=() => void onCutoverReindex(migration.migrationId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:217 | confirmed |
| ドキュメント | DocumentWorkspace | button | 戻す | onClick=() => void onRollbackReindex(migration.migrationId) | apps/web/src/features/documents/components/DocumentWorkspace.tsx:225 | confirmed |
| 履歴 | HistoryWorkspace | button | チャットへ戻る | onClick=onBack | apps/web/src/features/history/components/HistoryWorkspace.tsx:51 | confirmed |
| 履歴 | HistoryWorkspace | input | 履歴を検索 | onChange=(event) => setQuery(event.target.value) | apps/web/src/features/history/components/HistoryWorkspace.tsx:65 | confirmed |
| 履歴 | HistoryWorkspace | select | 履歴の並び順 | onChange=(event) => setSortOrder(event.target.value as "newest" \| "oldest" \| "messages") | apps/web/src/features/history/components/HistoryWorkspace.tsx:72 | confirmed |
| 履歴 | HistoryWorkspace | option | newest | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:73 | confirmed |
| 履歴 | HistoryWorkspace | option | oldest | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:74 | confirmed |
| 履歴 | HistoryWorkspace | option | messages | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:75 | confirmed |
| 履歴 | HistoryWorkspace | label | お気に入りのみ | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:77 | confirmed |
| 履歴 | HistoryWorkspace | input | 未推定 | onChange=(event) => setFavoritesOnly(event.target.checked) | apps/web/src/features/history/components/HistoryWorkspace.tsx:78 | unknown |
| 履歴 | HistoryWorkspace | button | item.isFavorite ? `${item.title}をお気に入りから外す` : `${item.title}をお気に入りに追加` | onClick=() => onToggleFavorite(item) | apps/web/src/features/history/components/HistoryWorkspace.tsx:91 | confirmed |
| 履歴 | HistoryWorkspace | button | 未推定 | onClick=() => onSelect(item) | apps/web/src/features/history/components/HistoryWorkspace.tsx:100 | unknown |
| 履歴 | HistoryWorkspace | button | 削除 | onClick=() => onDelete(item.id) | apps/web/src/features/history/components/HistoryWorkspace.tsx:108 | confirmed |
| 担当者対応 | AssigneeWorkspace | button | チャットへ戻る | onClick=onBack | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:113 | confirmed |
| 担当者対応 | AssigneeWorkspace | label | ステータス / すべて | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:126 | confirmed |
| 担当者対応 | AssigneeWorkspace | select | statusFilter | onChange=(event) => setStatusFilter(event.target.value as AssigneeLaneId \| "all") | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:128 | confirmed |
| 担当者対応 | AssigneeWorkspace | option | all | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:129 | confirmed |
| 担当者対応 | AssigneeWorkspace | option | lane.id | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:131 | confirmed |
| 担当者対応 | AssigneeWorkspace | label | 検索 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:135 | confirmed |
| 担当者対応 | AssigneeWorkspace | input | タイトル・名前・部署で検索 | onChange=(event) => setSearchQuery(event.target.value) | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:137 | confirmed |
| 担当者対応 | AssigneeWorkspace | button | / / （ / ） | onClick=() => onSelect(question.questionId) | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:161 | confirmed |
| 担当者対応 | AssigneeWorkspace | form | 回答作成 / 回答タイトル / 回答内容 / 参照資料 / 関連リンク / 内部メモ / 質問者へ通知する / 下書き保存 / 回答を送信 | onSubmit=onSubmit | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:205 | confirmed |
| 担当者対応 | AssigneeWorkspace | label | 回答タイトル | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:207 | confirmed |
| 担当者対応 | AssigneeWorkspace | input | answerTitle | onChange=(event) => { setAnswerTitle(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:209 | confirmed |
| 担当者対応 | AssigneeWorkspace | label | 回答内容 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:211 | confirmed |
| 担当者対応 | AssigneeWorkspace | textarea | answerBody | onChange=(event) => { setAnswerBody(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:213 | confirmed |
| 担当者対応 | AssigneeWorkspace | label | 参照資料 / 関連リンク | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:215 | confirmed |
| 担当者対応 | AssigneeWorkspace | input | 資料名、URL、またはナレッジリンク | onChange=(event) => { setReferences(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:217 | confirmed |
| 担当者対応 | AssigneeWorkspace | label | 内部メモ | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:219 | confirmed |
| 担当者対応 | AssigneeWorkspace | textarea | internalMemo | onChange=(event) => { setInternalMemo(event.target.value); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:221 | confirmed |
| 担当者対応 | AssigneeWorkspace | label | 質問者へ通知する | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:223 | confirmed |
| 担当者対応 | AssigneeWorkspace | input | 未推定 | onChange=(event) => { setNotifyRequester(event.target.checked); markDirty() } | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:224 | unknown |
| 担当者対応 | AssigneeWorkspace | button | 下書き保存 | onClick=onSaveDraft | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:231 | confirmed |
| 担当者対応 | AssigneeWorkspace | button | 回答を送信 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:232 | confirmed |
