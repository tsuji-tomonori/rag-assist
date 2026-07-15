# Web UI 操作説明一覧

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## この資料で分かること

- 各ボタン、リンク、フォーム、入力項目が何をする UI なのか。
- 支援技術へ伝わる名前、説明参照、現在地、展開状態、選択状態、無効状態など。
- 初めてプロジェクトを見る人が、画面を開かずに主要操作の意味を把握するための一覧。

静的解析のため、実行時に組み立てる label や条件付き表示は推定を含みます。実画面での読み上げ確認が必要な場合は、この一覧を入口にしてください。

## 機能別サマリ

| 機能 | feature | 操作要素 | 主な UI 説明 | 詳細 |
| --- | --- | --- | --- | --- |
| 管理 | admin | 38 | 「チャットへ戻る」を実行するボタン。<br>「更新」を実行するボタン。<br>「管理対象ユーザー作成」を入力・送信するフォーム。<br>「メール」に紐づく入力ラベル。 ほか 24 件 | [admin.md](web-features/admin.md) |
| agents | agents | 4 | 「チャットへ戻る」を実行するボタン。<br>「非同期エージェント情報を更新」を実行するボタン。<br>「キャンセル」を実行するボタン。 | [agents.md](web-features/agents.md) |
| アプリケーション枠 | app | 15 | 「チャットへ戻る」を実行するボタン。<br>「送信キー / Enterで送信 / Ctrl+Enterで送信」に紐づく入力ラベル。<br>「Enterで送信 / Ctrl+Enterで送信」を選ぶ選択項目。<br>「Enterで送信」を表す option 要素。 ほか 8 件 | [app.md](web-features/app.md) |
| 認証 | auth | 26 | 「title」を入力・送信するフォーム。<br>「新しいパスワード」に紐づく入力ラベル。<br>「新しいパスワード」を入力または選択する項目。<br>「新しいパスワード（確認）」に紐づく入力ラベル。 ほか 14 件 | [auth.md](web-features/auth.md) |
| 性能テスト | benchmark | 18 | 「チャットへ戻る」を実行するボタン。<br>「テスト種別」に紐づく入力ラベル。<br>「テスト種別」を選ぶ選択項目。<br>「benchmark suite を取得できません」を表す option 要素。 ほか 12 件 | [benchmark.md](web-features/benchmark.md) |
| チャット | chat | 41 | 「回答をコピー済み / 回答をコピー」を実行するボタン。<br>「この候補で質問する」を実行するボタン。<br>「自分で入力」を実行するボタン。<br>「追加質問候補」を実行するボタン。 ほか 36 件 | [chat.md](web-features/chat.md) |
| デバッグ | debug | 11 | 「拡大デバッグパネルを閉じる」を実行するボタン。<br>「保存JSON」を実行するボタン。<br>「可視化JSON」を実行するボタン。<br>「JSONをアップロード」に紐づく入力ラベル。 ほか 3 件 | [debug.md](web-features/debug.md) |
| ドキュメント | documents | 143 | 「前の画面へ戻る」を実行するボタン。<br>「フォルダ設定を閉じる」を実行するボタン。<br>「ファイル名: / 現在の権限: / 継承: / 共有先種別 / 共有先ID / 権限 / 理由 / 保存」を入力・送信するフォーム。<br>「削除」を実行するボタン。 ほか 110 件 | [documents.md](web-features/documents.md) |
| favorites | favorites | 1 | 「チャットへ戻る」を実行するボタン。 | [favorites.md](web-features/favorites.md) |
| 履歴 | history | 11 | 「チャットへ戻る」を実行するボタン。<br>「履歴を検索」を入力または選択する項目。<br>「履歴の並び順」を選ぶ選択項目。<br>「新しい順」を表す option 要素。 ほか 5 件 | [history.md](web-features/history.md) |
| 担当者対応 | questions | 21 | 「チャットへ戻る」を実行するボタン。<br>「ステータス / すべて」に紐づく入力ラベル。<br>「すべて」を選ぶ選択項目。<br>「すべて」を表す option 要素。 ほか 16 件 | [questions.md](web-features/questions.md) |
| 共通 | shared | 11 | 「キャンセル」を実行するボタン。<br>「label」を実行するボタン。<br>「処理中」を実行するボタン。<br>「戻る」を実行するボタン。 ほか 1 件 | [shared.md](web-features/shared.md) |

## UI 操作説明

| 機能 | コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | 場所 |
| --- | --- | --- | --- | --- | --- | --- |
| アプリケーション枠 | PersonalSettingsView | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | apps/web/src/app/components/PersonalSettingsView.tsx:25 |
| アプリケーション枠 | PersonalSettingsView | label | 送信キー / Enterで送信 / Ctrl+Enterで送信 | 「送信キー / Enterで送信 / Ctrl+Enterで送信」に紐づく入力ラベル。 | - | apps/web/src/app/components/PersonalSettingsView.tsx:35 |
| アプリケーション枠 | PersonalSettingsView | select | Enterで送信 / Ctrl+Enterで送信 | 「Enterで送信 / Ctrl+Enterで送信」を選ぶ選択項目。 | - | apps/web/src/app/components/PersonalSettingsView.tsx:37 |
| アプリケーション枠 | PersonalSettingsView | option | Enterで送信 | 「Enterで送信」を表す option 要素。 | - | apps/web/src/app/components/PersonalSettingsView.tsx:42 |
| アプリケーション枠 | PersonalSettingsView | option | Ctrl+Enterで送信 | 「Ctrl+Enterで送信」を表す option 要素。 | - | apps/web/src/app/components/PersonalSettingsView.tsx:43 |
| アプリケーション枠 | PersonalSettingsView | button | サインアウト | 「サインアウト」を実行するボタン。 | - | apps/web/src/app/components/PersonalSettingsView.tsx:48 |
| アプリケーション枠 | RailNav | a | ホーム | 「ホーム」へ移動するリンク。 | - | apps/web/src/app/components/RailNav.tsx:82 |
| アプリケーション枠 | RailNav | AccountButton | 未推定 | AccountButton 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/app/components/RailNav.tsx:90 |
| アプリケーション枠 | RailNav | button | メニューを閉じる / メニューを開く | 「メニューを閉じる / メニューを開く」を実行するボタン。 | 状態: aria-expanded=mobileMenuOpen, aria-controls=mobileMenuId | apps/web/src/app/components/RailNav.tsx:97 |
| アプリケーション枠 | RailNav | AccountButton | 未推定 | AccountButton 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/app/components/RailNav.tsx:115 |
| アプリケーション枠 | DestinationButtons | button | destination.label | 「destination.label」を実行するボタン。 | 状態: aria-current=activeView === destination.view ? "page" : undefined | apps/web/src/app/components/RailNav.tsx:137 |
| アプリケーション枠 | AccountButton | button | 個人設定 | 「個人設定」を実行するボタン。 | 状態: aria-current=active ? "page" : undefined | apps/web/src/app/components/RailNav.tsx:163 |
| アプリケーション枠 | TopBar | label | デバッグモード | 「デバッグモード」に紐づく入力ラベル。 | - | apps/web/src/app/components/TopBar.tsx:18 |
| アプリケーション枠 | TopBar | input | デバッグモード | 「デバッグモード」を入力または選択する項目。 | - | apps/web/src/app/components/TopBar.tsx:20 |
| アプリケーション枠 | TopBar | button | 新しい会話 | 「新しい会話」を実行するボタン。 | - | apps/web/src/app/components/TopBar.tsx:24 |
| 管理 | AdminWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:142 |
| 管理 | AdminWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=resolvedActiveSection === section.id ? "page" : undefined | apps/web/src/features/admin/components/AdminWorkspace.tsx:155 |
| 管理 | AdminOverviewGrid | button | `${card.label}を開く` | 「`${card.label}を開く`」を実行するボタン。 | - | apps/web/src/features/admin/components/panels/AdminOverviewGrid.tsx:191 |
| 管理 | AdminUserPanel | button | 更新 | 「更新」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:45 |
| 管理 | AdminUserPanel | AdminCreateUserForm | 未推定 | AdminCreateUserForm 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:51 |
| 管理 | AdminCreateUserForm | form | 管理対象ユーザー作成 | 「管理対象ユーザー作成」を入力・送信するフォーム。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:129 |
| 管理 | AdminCreateUserForm | label | メール | 「メール」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:130 |
| 管理 | AdminCreateUserForm | input | new-user@example.com | 「new-user@example.com」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:132 |
| 管理 | AdminCreateUserForm | label | 表示名 | 「表示名」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:134 |
| 管理 | AdminCreateUserForm | input | 任意 | 「任意」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:136 |
| 管理 | AdminCreateUserForm | label | 初期ロール | 「初期ロール」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:138 |
| 管理 | AdminCreateUserForm | select | 初期ロール | 「初期ロール」を選ぶ選択項目。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:145 |
| 管理 | AdminCreateUserForm | option | 初期ロール | 「初期ロール」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:147 |
| 管理 | AdminCreateUserForm | button | 作成 | 「作成」を実行するボタン。 | 状態: disabled=loading \|\| email.trim().length === 0 | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:152 |
| 管理 | ManagedUserRow | select | `${user.email}に付与するロール` | 「`${user.email}に付与するロール`」を選ぶ選択項目。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:237 |
| 管理 | ManagedUserRow | option | role.role | 「role.role」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:239 |
| 管理 | ManagedUserRow | button | 付与 | 「付与」を実行するボタン。 | 状態: disabled=loading \|\| !roleChanged \|\| roleReason.trim().length === 0 | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:242 |
| 管理 | ManagedUserRow | input | `${user.email}のロール変更理由` | 「`${user.email}のロール変更理由`」を入力または選択する項目。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:246 |
| 管理 | ManagedUserRow | button | 再開 | 「再開」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:265 |
| 管理 | ManagedUserRow | button | 停止 | 「停止」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:270 |
| 管理 | ManagedUserRow | button | 削除 | 「削除」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:275 |
| 管理 | ManagedUserRow | label | 後継管理者 | 「後継管理者」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:321 |
| 管理 | ManagedUserRow | select | `${user.email}の後継管理者` | 「`${user.email}の後継管理者`」を選ぶ選択項目。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:323 |
| 管理 | ManagedUserRow | option | 選択してください | 「選択してください」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:331 |
| 管理 | ManagedUserRow | option | candidate.userId | 「candidate.userId」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:333 |
| 管理 | AliasAdminPanel | button | 公開 | 「公開」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:68 |
| 管理 | AliasAdminPanel | form | 用語 / 展開語 / 部署 scope / 追加 | 「用語 / 展開語 / 部署 scope / 追加」を入力・送信するフォーム。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:77 |
| 管理 | AliasAdminPanel | label | 用語 | 「用語」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:78 |
| 管理 | AliasAdminPanel | input | pto | 「pto」を入力または選択する項目。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:80 |
| 管理 | AliasAdminPanel | label | 展開語 | 「展開語」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:82 |
| 管理 | AliasAdminPanel | input | 有給休暇, 休暇申請 | 「有給休暇, 休暇申請」を入力または選択する項目。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:84 |
| 管理 | AliasAdminPanel | label | 部署 scope | 「部署 scope」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:86 |
| 管理 | AliasAdminPanel | input | 任意 | 「任意」を入力または選択する項目。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:88 |
| 管理 | AliasAdminPanel | button | 追加 | 「追加」を実行するボタン。 | 状態: disabled=loading \|\| !term.trim() \|\| parseExpansionList(expansions).length === 0 | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:90 |
| 管理 | AliasAdminPanel | button | 下書き化 | 「下書き化」を実行するボタン。 | 状態: disabled=!canWrite \|\| loading \|\| alias.status === "disabled" | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:114 |
| 管理 | AliasAdminPanel | button | 承認 | 「承認」を実行するボタン。 | 状態: disabled=!canReview \|\| loading \|\| alias.status === "disabled" | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:118 |
| 管理 | AliasAdminPanel | button | 差戻 | 「差戻」を実行するボタン。 | 状態: disabled=!canReview \|\| loading \|\| alias.status === "disabled" | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:122 |
| 管理 | AliasAdminPanel | button | 無効 | 「無効」を実行するボタン。 | 状態: disabled=!canDisable \|\| loading \|\| alias.status === "disabled" | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:126 |
| agents | AsyncAgentWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | apps/web/src/features/agents/components/AsyncAgentWorkspace.tsx:33 |
| agents | AsyncAgentWorkspace | button | 非同期エージェント情報を更新 | 「非同期エージェント情報を更新」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/agents/components/AsyncAgentWorkspace.tsx:47 |
| agents | AsyncAgentWorkspace | button | `${run.agentRunId}の詳細` | 「`${run.agentRunId}の詳細`」を実行するボタン。 | 状態: aria-current=selectedRun?.agentRunId === run.agentRunId ? "true" : undefined | apps/web/src/features/agents/components/AsyncAgentWorkspace.tsx:84 |
| agents | AsyncAgentWorkspace | button | キャンセル | 「キャンセル」を実行するボタン。 | 状態: disabled=!canCancel \|\| !["queued", "preparing_workspace", "running", "waiting_for_approval"].inclu… | apps/web/src/features/agents/components/AsyncAgentWorkspace.tsx:116 |
| 認証 | LoginHeroGraphic | svg | 未推定 | svg 要素。静的解析では具体的な操作名を推定できません。 | role: img | apps/web/src/features/auth/components/LoginHeroGraphic.tsx:3 |
| 認証 | LoginPage | form | title | 「title」を入力・送信するフォーム。 | 説明参照: error ? "login-error" : notice ? "login-notice" : undefined | apps/web/src/features/auth/components/LoginPage.tsx:213 |
| 認証 | LoginPage | label | 新しいパスワード | 「新しいパスワード」に紐づく入力ラベル。 | - | apps/web/src/features/auth/components/LoginPage.tsx:220 |
| 認証 | LoginPage | input | 新しいパスワード | 「新しいパスワード」を入力または選択する項目。 | 状態: disabled=isSubmitting | apps/web/src/features/auth/components/LoginPage.tsx:221 |
| 認証 | LoginPage | label | 新しいパスワード（確認） | 「新しいパスワード（確認）」に紐づく入力ラベル。 | - | apps/web/src/features/auth/components/LoginPage.tsx:230 |
| 認証 | LoginPage | input | 新しいパスワード（確認） | 「新しいパスワード（確認）」を入力または選択する項目。 | 状態: disabled=isSubmitting | apps/web/src/features/auth/components/LoginPage.tsx:231 |
| 認証 | LoginPage | label | メールアドレス | 「メールアドレス」に紐づく入力ラベル。 | - | apps/web/src/features/auth/components/LoginPage.tsx:242 |
| 認証 | LoginPage | input | メールアドレス | 「メールアドレス」を入力または選択する項目。 | 状態: disabled=isSubmitting | apps/web/src/features/auth/components/LoginPage.tsx:243 |
| 認証 | LoginPage | label | 確認コード | 「確認コード」に紐づく入力ラベル。 | - | apps/web/src/features/auth/components/LoginPage.tsx:244 |
| 認証 | LoginPage | input | 確認コード | 「確認コード」を入力または選択する項目。 | 状態: disabled=isSubmitting | apps/web/src/features/auth/components/LoginPage.tsx:245 |
| 認証 | LoginPage | label | メールアドレス | 「メールアドレス」に紐づく入力ラベル。 | - | apps/web/src/features/auth/components/LoginPage.tsx:257 |
| 認証 | LoginPage | input | メールアドレス | 「メールアドレス」を入力または選択する項目。 | 状態: disabled=isSubmitting | apps/web/src/features/auth/components/LoginPage.tsx:258 |
| 認証 | LoginPage | label | パスワード | 「パスワード」に紐づく入力ラベル。 | - | apps/web/src/features/auth/components/LoginPage.tsx:259 |
| 認証 | LoginPage | input | パスワード | 「パスワード」を入力または選択する項目。 | 状態: disabled=isSubmitting | apps/web/src/features/auth/components/LoginPage.tsx:260 |
| 認証 | LoginPage | label | パスワード（確認） | 「パスワード（確認）」に紐づく入力ラベル。 | - | apps/web/src/features/auth/components/LoginPage.tsx:262 |
| 認証 | LoginPage | input | パスワード（確認） | 「パスワード（確認）」を入力または選択する項目。 | 状態: disabled=isSubmitting | apps/web/src/features/auth/components/LoginPage.tsx:263 |
| 認証 | LoginPage | label | メールアドレス | 「メールアドレス」に紐づく入力ラベル。 | - | apps/web/src/features/auth/components/LoginPage.tsx:274 |
| 認証 | LoginPage | input | メールアドレス | 「メールアドレス」を入力または選択する項目。 | 状態: disabled=isSubmitting | apps/web/src/features/auth/components/LoginPage.tsx:275 |
| 認証 | LoginPage | label | パスワード | 「パスワード」に紐づく入力ラベル。 | - | apps/web/src/features/auth/components/LoginPage.tsx:276 |
| 認証 | LoginPage | input | パスワード | 「パスワード」を入力または選択する項目。 | 状態: disabled=isSubmitting | apps/web/src/features/auth/components/LoginPage.tsx:277 |
| 認証 | LoginPage | label | ログイン状態を保持 | 「ログイン状態を保持」に紐づく入力ラベル。 | - | apps/web/src/features/auth/components/LoginPage.tsx:281 |
| 認証 | LoginPage | input | ログイン状態を保持 | 「ログイン状態を保持」を入力または選択する項目。 | 状態: disabled=isSubmitting | apps/web/src/features/auth/components/LoginPage.tsx:281 |
| 認証 | LoginPage | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=isSubmitting \|\| !isCurrentPasswordValid | apps/web/src/features/auth/components/LoginPage.tsx:285 |
| 認証 | LoginPage | button | アカウント作成 | 「アカウント作成」を実行するボタン。 | 状態: disabled=isSubmitting | apps/web/src/features/auth/components/LoginPage.tsx:293 |
| 認証 | LoginPage | button | 確認コード入力 | 「確認コード入力」を実行するボタン。 | 状態: disabled=isSubmitting | apps/web/src/features/auth/components/LoginPage.tsx:294 |
| 認証 | LoginPage | button | サインインへ戻る | 「サインインへ戻る」を実行するボタン。 | 状態: disabled=isSubmitting | apps/web/src/features/auth/components/LoginPage.tsx:297 |
| 性能テスト | BenchmarkWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:78 |
| 性能テスト | BenchmarkWorkspace | label | テスト種別 | 「テスト種別」に紐づく入力ラベル。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:105 |
| 性能テスト | BenchmarkWorkspace | select | テスト種別 | 「テスト種別」を選ぶ選択項目。 | 状態: disabled=!hasSuites \|\| !hasSuitesResult | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:107 |
| 性能テスト | BenchmarkWorkspace | option | benchmark suite を取得できません | 「benchmark suite を取得できません」を表す option 要素。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:108 |
| 性能テスト | BenchmarkWorkspace | option | テスト種別 | 「テスト種別」を表す option 要素。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:110 |
| 性能テスト | BenchmarkWorkspace | label | データセット | 「データセット」に紐づく入力ラベル。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:126 |
| 性能テスト | BenchmarkWorkspace | input | データセット | 「データセット」を入力または選択する項目。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:128 |
| 性能テスト | BenchmarkWorkspace | label | モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku | 「モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku」に紐づく入力ラベル。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:130 |
| 性能テスト | BenchmarkWorkspace | select | Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku | 「Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku」を選ぶ選択項目。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:132 |
| 性能テスト | BenchmarkWorkspace | option | Nova Lite v1 | 「Nova Lite v1」を表す option 要素。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:133 |
| 性能テスト | BenchmarkWorkspace | option | Claude 3.5 Sonnet | 「Claude 3.5 Sonnet」を表す option 要素。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:134 |
| 性能テスト | BenchmarkWorkspace | option | Claude 3 Haiku | 「Claude 3 Haiku」を表す option 要素。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:135 |
| 性能テスト | BenchmarkWorkspace | label | 並列数 | 「並列数」に紐づく入力ラベル。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:138 |
| 性能テスト | BenchmarkWorkspace | input | 並列数 | 「並列数」を入力または選択する項目。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:140 |
| 性能テスト | BenchmarkWorkspace | button | 性能テストを実行 | 「性能テストを実行」を実行するボタン。 | 状態: disabled=loading \|\| !canRun \|\| !selectedSuite \|\| !hasSuitesResult | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:149 |
| 性能テスト | BenchmarkWorkspace | button | 更新 | 「更新」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:153 |
| 性能テスト | BenchmarkWorkspace | button | `${artifact.description}をダウンロード` | 「`${artifact.description}をダウンロード`」を実行するボタン。 | 状態: disabled=!canDownload \|\| !canDownloadArtifact(run, artifact.kind) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:205 |
| 性能テスト | BenchmarkWorkspace | button | `${run.runId}のジョブをキャンセル` | 「`${run.runId}のジョブをキャンセル`」を実行するボタン。 | 状態: disabled=!canCancel \|\| loading \|\| !["queued", "running"].includes(run.status) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:217 |
| チャット | AnswerCopyAction | button | 回答をコピー済み / 回答をコピー | 「回答をコピー済み / 回答をコピー」を実行するボタン。 | 状態: disabled=!canCopy | apps/web/src/features/chat/components/answer/AnswerCopyAction.tsx:18 |
| チャット | CitationList | a | 未推定 | a 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/chat/components/answer/CitationList.tsx:13 |
| チャット | ClarificationOptions | button | この候補で質問する | 「この候補で質問する」を実行するボタン。 | 状態: disabled=disabled | apps/web/src/features/chat/components/answer/ClarificationOptions.tsx:19 |
| チャット | ClarificationOptions | button | 自分で入力 | 「自分で入力」を実行するボタン。 | 状態: disabled=disabled | apps/web/src/features/chat/components/answer/ClarificationOptions.tsx:29 |
| チャット | FollowupSuggestions | button | 追加質問候補 | 「追加質問候補」を実行するボタン。 | 状態: disabled=disabled | apps/web/src/features/chat/components/answer/FollowupSuggestions.tsx:17 |
| チャット | ChatComposer | form | 質問入力 | 「質問入力」を入力・送信するフォーム。 | - | apps/web/src/features/chat/components/ChatComposer.tsx:50 |
| チャット | ChatComposer | textarea | 質問 | 「質問」を複数行で入力する項目。 | 説明参照: chat-composer-shortcut<br>状態: disabled=loading | apps/web/src/features/chat/components/ChatComposer.tsx:51 |
| チャット | ChatComposer | input | ファイルをアップロード | 「ファイルをアップロード」を入力または選択する項目。 | 状態: disabled=loading | apps/web/src/features/chat/components/ChatComposer.tsx:83 |
| チャット | ChatComposer | button | 資料を添付 | 「資料を添付」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/chat/components/ChatComposer.tsx:92 |
| チャット | ChatComposer | button | ファイルをアップロード | 「ファイルをアップロード」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/chat/components/ChatComposer.tsx:107 |
| チャット | ChatComposer | label | モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku | 「モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku」に紐づく入力ラベル。 | - | apps/web/src/features/chat/components/ChatComposer.tsx:119 |
| チャット | ChatComposer | select | モデルを選択 | 「モデルを選択」を選ぶ選択項目。 | 状態: disabled=loading | apps/web/src/features/chat/components/ChatComposer.tsx:121 |
| チャット | ChatComposer | option | Nova Lite v1 | 「Nova Lite v1」を表す option 要素。 | - | apps/web/src/features/chat/components/ChatComposer.tsx:122 |
| チャット | ChatComposer | option | Claude 3.5 Sonnet | 「Claude 3.5 Sonnet」を表す option 要素。 | - | apps/web/src/features/chat/components/ChatComposer.tsx:123 |
| チャット | ChatComposer | option | Claude 3 Haiku | 「Claude 3 Haiku」を表す option 要素。 | - | apps/web/src/features/chat/components/ChatComposer.tsx:124 |
| チャット | ChatComposer | button | 対象文書を解除 | 「対象文書を解除」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/chat/components/ChatComposer.tsx:131 |
| チャット | ChatComposer | button | 質問を送信 | 「質問を送信」を実行するボタン。 | 状態: disabled=!canAsk | apps/web/src/features/chat/components/ChatComposer.tsx:145 |
| チャット | ChatEmptyState | button | 質問例 | 「質問例」を実行するボタン。 | - | apps/web/src/features/chat/components/ChatEmptyState.tsx:21 |
| チャット | ChatRunIdBar | button | 実行IDをコピー済み / 実行IDをコピー | 「実行IDをコピー済み / 実行IDをコピー」を実行するボタン。 | 状態: disabled=!canCopy | apps/web/src/features/chat/components/ChatRunIdBar.tsx:52 |
| チャット | QuestionAnswerPanel | button | 解決した | 「解決した」を実行するボタン。 | 状態: disabled=loading \|\| question.status === "resolved" | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx:40 |
| チャット | QuestionAnswerPanel | button | 追加で質問する | 「追加で質問する」を実行するボタン。 | - | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx:44 |
| チャット | QuestionEscalationPanel | form | 担当者へ質問 | 「担当者へ質問」を入力・送信するフォーム。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:60 |
| チャット | QuestionEscalationPanel | label | 件名 | 「件名」に紐づく入力ラベル。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:67 |
| チャット | QuestionEscalationPanel | input | 件名 | 「件名」を入力または選択する項目。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:69 |
| チャット | QuestionEscalationPanel | label | 質問内容 | 「質問内容」に紐づく入力ラベル。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:71 |
| チャット | QuestionEscalationPanel | textarea | 質問内容 | 「質問内容」を複数行で入力する項目。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:73 |
| チャット | QuestionEscalationPanel | label | カテゴリ / その他の質問 / 手続き / 社内制度 / 資料確認 | 「カテゴリ / その他の質問 / 手続き / 社内制度 / 資料確認」に紐づく入力ラベル。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:76 |
| チャット | QuestionEscalationPanel | select | その他の質問 / 手続き / 社内制度 / 資料確認 | 「その他の質問 / 手続き / 社内制度 / 資料確認」を選ぶ選択項目。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:78 |
| チャット | QuestionEscalationPanel | option | その他の質問 | 「その他の質問」を表す option 要素。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:79 |
| チャット | QuestionEscalationPanel | option | 手続き | 「手続き」を表す option 要素。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:80 |
| チャット | QuestionEscalationPanel | option | 社内制度 | 「社内制度」を表す option 要素。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:81 |
| チャット | QuestionEscalationPanel | option | 資料確認 | 「資料確認」を表す option 要素。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:82 |
| チャット | QuestionEscalationPanel | label | 優先度 / 通常 / 高 / 緊急 | 「優先度 / 通常 / 高 / 緊急」に紐づく入力ラベル。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:85 |
| チャット | QuestionEscalationPanel | select | 通常 / 高 / 緊急 | 「通常 / 高 / 緊急」を選ぶ選択項目。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:87 |
| チャット | QuestionEscalationPanel | option | 通常 | 「通常」を表す option 要素。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:88 |
| チャット | QuestionEscalationPanel | option | 高 | 「高」を表す option 要素。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:89 |
| チャット | QuestionEscalationPanel | option | 緊急 | 「緊急」を表す option 要素。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:90 |
| チャット | QuestionEscalationPanel | label | 担当部署 | 「担当部署」に紐づく入力ラベル。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:94 |
| チャット | QuestionEscalationPanel | input | 担当部署を入力 | 「担当部署を入力」を入力または選択する項目。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:96 |
| チャット | QuestionEscalationPanel | button | 担当者へ送信 | 「担当者へ送信」を実行するボタン。 | 状態: disabled=loading \|\| !title.trim() \|\| !body.trim() | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:100 |
| チャット | UserPromptBubble | button | プロンプトをコピー済み / プロンプトをコピー | 「プロンプトをコピー済み / プロンプトをコピー」を実行するボタン。 | 状態: disabled=!canCopyPrompt | apps/web/src/features/chat/components/UserPromptBubble.tsx:47 |
| デバッグ | DebugExpandedDialog | button | 拡大デバッグパネルを閉じる | 「拡大デバッグパネルを閉じる」を実行するボタン。 | - | apps/web/src/features/debug/components/panel/DebugExpandedDialog.tsx:32 |
| デバッグ | DebugPanelBody | DebugFlowNodeButton | 未推定 | DebugFlowNodeButton 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/debug/components/panel/DebugPanelBody.tsx:50 |
| デバッグ | DebugFlowNodeButton | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-pressed=selected | apps/web/src/features/debug/components/panel/DebugPanelBody.tsx:143 |
| デバッグ | DebugStepList | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-expanded=expandedStep | apps/web/src/features/debug/components/panel/DebugPanelBody.tsx:216 |
| デバッグ | DebugPanelHeader | button | 保存JSON | 「保存JSON」を実行するボタン。 | 状態: disabled=!activeTrace \|\| pending \|\| Boolean(replayEnvelope) | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:39 |
| デバッグ | DebugPanelHeader | button | 可視化JSON | 「可視化JSON」を実行するボタン。 | 状態: disabled=!envelope \|\| pending | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:43 |
| デバッグ | DebugPanelHeader | label | JSONをアップロード | 「JSONをアップロード」に紐づく入力ラベル。 | - | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:47 |
| デバッグ | DebugPanelHeader | input | JSONをアップロード | 「JSONをアップロード」を入力または選択する項目。 | - | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:50 |
| デバッグ | DebugPanelHeader | button | 解除 | 「解除」を実行するボタン。 | - | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:53 |
| デバッグ | DebugPanelHeader | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-expanded=allExpanded | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:58 |
| デバッグ | DebugPanelHeader | button | デバッグパネルを拡大表示 | 「デバッグパネルを拡大表示」を実行するボタン。 | - | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:60 |
| ドキュメント | DocumentWorkspace | button | 前の画面へ戻る | 「前の画面へ戻る」を実行するボタン。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:833 |
| ドキュメント | DocumentWorkspace | button | フォルダ設定を閉じる | 「フォルダ設定を閉じる」を実行するボタン。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:991 |
| ドキュメント | DocumentWorkspace | form | ファイル名: / 現在の権限: / 継承: / 共有先種別 / 共有先ID / 権限 / 理由 / 保存 | 「ファイル名: / 現在の権限: / 継承: / 共有先種別 / 共有先ID / 権限 / 理由 / 保存」を入力・送信するフォーム。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1095 |
| ドキュメント | DocumentWorkspace | button | 削除 | 「削除」を実行するボタン。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1110 |
| ドキュメント | DocumentWorkspace | label | 共有先種別 | 「共有先種別」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1119 |
| ドキュメント | DocumentWorkspace | select | user / group | 「user / group」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1121 |
| ドキュメント | DocumentWorkspace | option | user | 「user」を表す option 要素。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1122 |
| ドキュメント | DocumentWorkspace | option | group | 「group」を表す option 要素。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1123 |
| ドキュメント | DocumentWorkspace | label | 共有先ID | 「共有先ID」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1126 |
| ドキュメント | DocumentWorkspace | input | 共有先ID | 「共有先ID」を入力または選択する項目。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1126 |
| ドキュメント | DocumentWorkspace | label | 権限 | 「権限」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1127 |
| ドキュメント | DocumentWorkspace | select | deny / readOnly / full | 「deny / readOnly / full」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1129 |
| ドキュメント | DocumentWorkspace | option | deny | 「deny」を表す option 要素。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1130 |
| ドキュメント | DocumentWorkspace | option | readOnly | 「readOnly」を表す option 要素。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1131 |
| ドキュメント | DocumentWorkspace | option | full | 「full」を表す option 要素。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1132 |
| ドキュメント | DocumentWorkspace | label | 理由 | 「理由」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1135 |
| ドキュメント | DocumentWorkspace | textarea | 理由 | 「理由」を複数行で入力する項目。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1135 |
| ドキュメント | DocumentWorkspace | button | 保存 | 「保存」を実行するボタン。 | 状態: disabled=documentShareLoading \|\| documentShareInfo === null \|\| !documentShareReason.trim() \|\| oper… | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1136 |
| ドキュメント | DocumentWorkspace | form | ファイル名: / 移動先フォルダ / 選択してください / 移動後の表示名 / 直接共有は維持され、継承共有は移動先フォルダの設定に変わります。 / 理由 / 移動 | 「ファイル名: / 移動先フォルダ / 選択してください / 移動後の表示名 / 直接共有は維持され、継承共有は移動先フォルダの設定に変わります。 / 理由 / 移動」を入力・送信するフォーム。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1142 |
| ドキュメント | DocumentWorkspace | label | 移動先フォルダ / 選択してください | 「移動先フォルダ / 選択してください」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1144 |
| ドキュメント | DocumentWorkspace | select | 選択してください | 「選択してください」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1146 |
| ドキュメント | DocumentWorkspace | option | 選択してください | 「選択してください」を表す option 要素。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1147 |
| ドキュメント | DocumentWorkspace | option | 移動先フォルダ / 選択してください | 「移動先フォルダ / 選択してください」を表す option 要素。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1149 |
| ドキュメント | DocumentWorkspace | label | 移動後の表示名 | 「移動後の表示名」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1153 |
| ドキュメント | DocumentWorkspace | input | 移動後の表示名 | 「移動後の表示名」を入力または選択する項目。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1153 |
| ドキュメント | DocumentWorkspace | label | 理由 | 「理由」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1156 |
| ドキュメント | DocumentWorkspace | textarea | 理由 | 「理由」を複数行で入力する項目。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1156 |
| ドキュメント | DocumentWorkspace | button | 移動 | 「移動」を実行するボタン。 | 状態: disabled=!documentMoveDestinationId \|\| documentMoveNameConflict \|\| !documentMoveReason.trim() \|\| o… | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1157 |
| ドキュメント | WorkspaceModal | button | `${title}を閉じる` | 「`${title}を閉じる`」を実行するボタン。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1226 |
| ドキュメント | DocumentAddDialog | button | ドキュメント追加を閉じる | 「ドキュメント追加を閉じる」を実行するボタン。 | - | apps/web/src/features/documents/components/workspace/DocumentAddDialog.tsx:143 |
| ドキュメント | DocumentAddDialog | label | 保存先フォルダ（必須） / 選択してください | 「保存先フォルダ（必須） / 選択してください」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentAddDialog.tsx:161 |
| ドキュメント | DocumentAddDialog | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=operationState.isUploading | apps/web/src/features/documents/components/workspace/DocumentAddDialog.tsx:163 |
| ドキュメント | DocumentAddDialog | option | 選択してください | 「選択してください」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentAddDialog.tsx:169 |
| ドキュメント | DocumentAddDialog | option | 保存先フォルダ（必須） / 選択してください | 「保存先フォルダ（必須） / 選択してください」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentAddDialog.tsx:171 |
| ドキュメント | DocumentAddDialog | button | 新しいフォルダを作る | 「新しいフォルダを作る」を実行するボタン。 | - | apps/web/src/features/documents/components/workspace/DocumentAddDialog.tsx:178 |
| ドキュメント | DocumentAddDialog | form | 新しいフォルダ名（必須） / ルート直下へ非公開で作成します。説明や共有設定はフォルダ設定から後で変更できます。 / フォルダを作成 | 「新しいフォルダ名（必須） / ルート直下へ非公開で作成します。説明や共有設定はフォルダ設定から後で変更できます。 / フォルダを作成」を入力・送信するフォーム。 | - | apps/web/src/features/documents/components/workspace/DocumentAddDialog.tsx:185 |
| ドキュメント | DocumentAddDialog | label | 新しいフォルダ名（必須） | 「新しいフォルダ名（必須）」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentAddDialog.tsx:186 |
| ドキュメント | DocumentAddDialog | input | 新しいフォルダ名（必須） | 「新しいフォルダ名（必須）」を入力または選択する項目。 | 説明参照: document-quick-folder-help<br>状態: disabled=operationState.creatingGroup | apps/web/src/features/documents/components/workspace/DocumentAddDialog.tsx:188 |
| ドキュメント | DocumentAddDialog | button | キャンセル | 「キャンセル」を実行するボタン。 | - | apps/web/src/features/documents/components/workspace/DocumentAddDialog.tsx:202 |
| ドキュメント | DocumentAddDialog | button | フォルダを作成 | 「フォルダを作成」を実行するボタン。 | 状態: disabled=!quickGroupName.trim() \|\| operationState.creatingGroup | apps/web/src/features/documents/components/workspace/DocumentAddDialog.tsx:204 |
| ドキュメント | DocumentAddDialog | form | 保存先 / アップロード | 「保存先 / アップロード」を入力・送信するフォーム。 | - | apps/web/src/features/documents/components/workspace/DocumentAddDialog.tsx:229 |
| ドキュメント | DocumentAddDialog | label | 未推定 | label 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/documents/components/workspace/DocumentAddDialog.tsx:234 |
| ドキュメント | DocumentAddDialog | input | アップロードする文書を選択 | 「アップロードする文書を選択」を入力または選択する項目。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | apps/web/src/features/documents/components/workspace/DocumentAddDialog.tsx:237 |
| ドキュメント | DocumentAddDialog | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| !uploadFile \|\| operationState.isUploading | apps/web/src/features/documents/components/workspace/DocumentAddDialog.tsx:247 |
| ドキュメント | DocumentConfirmDialog | label | 削除理由 | 「削除理由」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentConfirmDialog.tsx:41 |
| ドキュメント | DocumentConfirmDialog | textarea | 削除理由 | 「削除理由」を複数行で入力する項目。 | 状態: disabled=loading | apps/web/src/features/documents/components/workspace/DocumentConfirmDialog.tsx:43 |
| ドキュメント | DocumentDetailDrawer | button | 文書詳細を閉じる | 「文書詳細を閉じる」を実行するボタン。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:67 |
| ドキュメント | DocumentDetailDrawer | button | この資料に質問する | 「この資料に質問する」を実行するボタン。 | 状態: disabled=!onAskDocument | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:96 |
| ドキュメント | DocumentDetailDrawer | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=isDownloading | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:100 |
| ドキュメント | DocumentDetailDrawer | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:104 |
| ドキュメント | DocumentDetailDrawer | button | 再インデックス | 「再インデックス」を実行するボタン。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:108 |
| ドキュメント | DocumentDetailDrawer | button | 削除 | 「削除」を実行するボタン。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:112 |
| ドキュメント | DocumentDetailPanel | form | 共有フォルダ / 選択してください / 共有 resource group ID / 現行 policy の readOnly resource group / 追加: / 削除: / 変更なし: … | 「共有フォルダ / 選択してください / 共有 resource group ID / 現行 policy の readOnly resource group / 追加: / 削除: / 変更なし: …」を入力・送信するフォーム。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:210 |
| ドキュメント | DocumentDetailPanel | label | 共有フォルダ / 選択してください | 「共有フォルダ / 選択してください」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:211 |
| ドキュメント | DocumentDetailPanel | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=!canShareGroups \|\| operationState.sharingGroupId !== null | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:213 |
| ドキュメント | DocumentDetailPanel | option | 選択してください | 「選択してください」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:214 |
| ドキュメント | DocumentDetailPanel | option | 共有フォルダ / 選択してください | 「共有フォルダ / 選択してください」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:216 |
| ドキュメント | DocumentDetailPanel | label | 共有 resource group ID | 「共有 resource group ID」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:227 |
| ドキュメント | DocumentDetailPanel | input | resource group ID をカンマ区切りで入力 | 「resource group ID をカンマ区切りで入力」を入力または選択する項目。 | 説明参照: share-groups-validation share-groups-diff<br>状態: aria-invalid=shareHasValidationError \|\| undefined, disabled=!canShareGroups \|\| folderShareLoading \|\| !folderSharePolicyVersion \|\| operationState.shar… | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:229 |
| ドキュメント | DocumentDetailPanel | label | 未推定 | label 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:253 |
| ドキュメント | DocumentDetailPanel | input | 未推定 | input 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=!canShareGroups \|\| folderShareLoading \|\| !folderSharePolicyVersion \|\| operationState.shar… | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:254 |
| ドキュメント | DocumentDetailPanel | label | 既存共有をすべて削除することを確認しました | 「既存共有をすべて削除することを確認しました」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:273 |
| ドキュメント | DocumentDetailPanel | input | 既存共有をすべて削除することを確認しました | 「既存共有をすべて削除することを確認しました」を入力または選択する項目。 | 状態: disabled=!canShareGroups \|\| folderShareLoading \|\| !folderSharePolicyVersion \|\| operationState.shar… | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:274 |
| ドキュメント | DocumentDetailPanel | label | 変更理由 | 「変更理由」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:283 |
| ドキュメント | DocumentDetailPanel | textarea | 共有 policy を変更する理由 | 「共有 policy を変更する理由」を複数行で入力する項目。 | 状態: disabled=!canShareGroups \|\| folderShareLoading \|\| !folderSharePolicyVersion \|\| operationState.shar… | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:285 |
| ドキュメント | DocumentDetailPanel | button | 共有更新 | 「共有更新」を実行するボタン。 | 状態: disabled=!canSubmitShare | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:293 |
| ドキュメント | DocumentDetailPanel | form | 編集後フォルダ名 / 移動先フォルダ / ルート / 編集後説明 / フォルダ移動理由 / 現在 path: / 移動先: / folder version: / path 更新: / 説明更新: … | 「編集後フォルダ名 / 移動先フォルダ / ルート / 編集後説明 / フォルダ移動理由 / 現在 path: / 移動先: / folder version: / path 更新: / 説明更新: …」を入力・送信するフォーム。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:321 |
| ドキュメント | DocumentDetailPanel | label | 編集後フォルダ名 | 「編集後フォルダ名」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:322 |
| ドキュメント | DocumentDetailPanel | input | フォルダ名 | 「フォルダ名」を入力または選択する項目。 | 説明参照: edit-folder-validation edit-folder-preview<br>状態: aria-invalid=(Boolean(editTargetGroup) && !editGroupName.trim()) \|\| undefined, disabled=!canMoveGroups \|\| !editTargetGroup \|\| editBusy | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:324 |
| ドキュメント | DocumentDetailPanel | label | 移動先フォルダ / ルート | 「移動先フォルダ / ルート」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:333 |
| ドキュメント | DocumentDetailPanel | select | ルート | 「ルート」を選ぶ選択項目。 | 説明参照: edit-folder-validation edit-folder-preview<br>状態: aria-invalid=editParentInvalid \|\| undefined, disabled=!canMoveGroups \|\| !editTargetGroup \|\| editBusy | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:335 |
| ドキュメント | DocumentDetailPanel | option | ルート | 「ルート」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:342 |
| ドキュメント | DocumentDetailPanel | option | 移動先フォルダ / ルート | 「移動先フォルダ / ルート」を表す option 要素。 | 状態: disabled=group.effectivePermission !== "full" | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:344 |
| ドキュメント | DocumentDetailPanel | label | 編集後説明 | 「編集後説明」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:354 |
| ドキュメント | DocumentDetailPanel | textarea | フォルダの用途や対象資料 | 「フォルダの用途や対象資料」を複数行で入力する項目。 | 説明参照: edit-folder-preview<br>状態: disabled=!canShareGroups \|\| !editTargetGroup \|\| editBusy | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:356 |
| ドキュメント | DocumentDetailPanel | label | フォルダ移動理由 | 「フォルダ移動理由」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:364 |
| ドキュメント | DocumentDetailPanel | textarea | 名前または格納先を変更する理由 | 「名前または格納先を変更する理由」を複数行で入力する項目。 | 説明参照: edit-folder-validation<br>状態: disabled=!canMoveGroups \|\| !editTargetGroup \|\| !editPathHasChanges \|\| editBusy | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:366 |
| ドキュメント | DocumentDetailPanel | button | フォルダ更新 | 「フォルダ更新」を実行するボタン。 | 状態: disabled=!editCanSubmit | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:391 |
| ドキュメント | DocumentDetailPanel | form | 保存先フォルダ / 保存先を選択 / アップロード | 「保存先フォルダ / 保存先を選択 / アップロード」を入力・送信するフォーム。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:401 |
| ドキュメント | DocumentDetailPanel | label | 保存先フォルダ / 保存先を選択 | 「保存先フォルダ / 保存先を選択」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:402 |
| ドキュメント | DocumentDetailPanel | select | 保存先を選択 | 「保存先を選択」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.isUploading | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:404 |
| ドキュメント | DocumentDetailPanel | option | 保存先を選択 | 「保存先を選択」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:405 |
| ドキュメント | DocumentDetailPanel | option | 保存先フォルダ / 保存先を選択 | 「保存先フォルダ / 保存先を選択」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:407 |
| ドキュメント | DocumentDetailPanel | label | 文書アップロード | 「文書アップロード」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:411 |
| ドキュメント | DocumentDetailPanel | input | アップロードする文書を選択 | 「アップロードする文書を選択」を入力または選択する項目。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:414 |
| ドキュメント | DocumentDetailPanel | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| !uploadFile \|\| operationState.isUploading | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:417 |
| ドキュメント | DocumentDetailPanel | form | 新規フォルダ名 / 説明 / 親フォルダ / 親フォルダなし / 作成後にこのフォルダへ移動 / 新規フォルダは作成者が管理する非公開状態で作成されます。共有は作成後に共有設定から更新してください。… | 「新規フォルダ名 / 説明 / 親フォルダ / 親フォルダなし / 作成後にこのフォルダへ移動 / 新規フォルダは作成者が管理する非公開状態で作成されます。共有は作成後に共有設定から更新してください。…」を入力・送信するフォーム。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:433 |
| ドキュメント | DocumentDetailPanel | label | 新規フォルダ名 | 「新規フォルダ名」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:434 |
| ドキュメント | DocumentDetailPanel | input | フォルダ名 | 「フォルダ名」を入力または選択する項目。 | 状態: disabled=!canCreateGroups \|\| operationState.creatingGroup | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:436 |
| ドキュメント | DocumentDetailPanel | label | 説明 | 「説明」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:438 |
| ドキュメント | DocumentDetailPanel | textarea | フォルダの用途や対象資料 | 「フォルダの用途や対象資料」を複数行で入力する項目。 | 状態: disabled=!canCreateGroups \|\| operationState.creatingGroup | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:440 |
| ドキュメント | DocumentDetailPanel | label | 親フォルダ / 親フォルダなし | 「親フォルダ / 親フォルダなし」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:442 |
| ドキュメント | DocumentDetailPanel | select | 親フォルダなし | 「親フォルダなし」を選ぶ選択項目。 | 状態: disabled=!canCreateGroups \|\| operationState.creatingGroup | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:444 |
| ドキュメント | DocumentDetailPanel | option | 親フォルダなし | 「親フォルダなし」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:445 |
| ドキュメント | DocumentDetailPanel | option | 親フォルダ / 親フォルダなし | 「親フォルダ / 親フォルダなし」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:447 |
| ドキュメント | DocumentDetailPanel | label | 作成後にこのフォルダへ移動 | 「作成後にこのフォルダへ移動」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:451 |
| ドキュメント | DocumentDetailPanel | input | 作成後にこのフォルダへ移動 | 「作成後にこのフォルダへ移動」を入力または選択する項目。 | 状態: disabled=!canCreateGroups \|\| operationState.creatingGroup | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:452 |
| ドキュメント | DocumentDetailPanel | button | 新規フォルダ | 「新規フォルダ」を実行するボタン。 | 状態: disabled=!canCreateGroup | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:466 |
| ドキュメント | UploadProgressPanel | button | 詳細を開く | 「詳細を開く」を実行するボタン。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:565 |
| ドキュメント | UploadProgressPanel | button | この資料に質問する | 「この資料に質問する」を実行するボタン。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:566 |
| ドキュメント | UploadProgressPanel | button | フォルダ内で表示 | 「フォルダ内で表示」を実行するボタン。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:567 |
| ドキュメント | DocumentFilePanel | button | ドキュメントを追加 | 「ドキュメントを追加」を実行するボタン。 | 説明参照: addDocumentDisabledReason ? "document-add-disabled-reason" : undefined<br>状態: disabled=!canOpenDocumentAdd | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:135 |
| ドキュメント | DocumentFilePanel | button | フォルダ設定を開く | 「フォルダ設定を開く」を実行するボタン。 | 状態: disabled=(!canShareGroups && !canMoveGroups && !canCreateGroups && !canWrite) \|\| operationState.sh… | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:146 |
| ドキュメント | DocumentFilePanel | label | ファイル名検索 | 「ファイル名検索」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:162 |
| ドキュメント | DocumentFilePanel | input | ファイル名 | 「ファイル名」を入力または選択する項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:164 |
| ドキュメント | DocumentFilePanel | label | 種別 / すべて | 「種別 / すべて」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:166 |
| ドキュメント | DocumentFilePanel | select | すべて | 「すべて」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:168 |
| ドキュメント | DocumentFilePanel | option | すべて | 「すべて」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:169 |
| ドキュメント | DocumentFilePanel | option | 種別 / すべて | 「種別 / すべて」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:171 |
| ドキュメント | DocumentFilePanel | label | 状態 / すべて | 「状態 / すべて」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:175 |
| ドキュメント | DocumentFilePanel | select | すべて | 「すべて」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:177 |
| ドキュメント | DocumentFilePanel | option | すべて | 「すべて」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:178 |
| ドキュメント | DocumentFilePanel | option | 状態 / すべて | 「状態 / すべて」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:180 |
| ドキュメント | DocumentFilePanel | label | 所属フォルダ / すべて / 未設定 | 「所属フォルダ / すべて / 未設定」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:184 |
| ドキュメント | DocumentFilePanel | select | すべて / 未設定 | 「すべて / 未設定」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:186 |
| ドキュメント | DocumentFilePanel | option | すべて | 「すべて」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:187 |
| ドキュメント | DocumentFilePanel | option | 未設定 | 「未設定」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:188 |
| ドキュメント | DocumentFilePanel | option | 所属フォルダ / すべて / 未設定 | 「所属フォルダ / すべて / 未設定」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:190 |
| ドキュメント | DocumentFilePanel | label | 並び替え / 更新日 新しい順 / 更新日 古い順 / ファイル名順 / 種別順 | 「並び替え / 更新日 新しい順 / 更新日 古い順 / ファイル名順 / 種別順」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:194 |
| ドキュメント | DocumentFilePanel | select | 更新日 新しい順 / 更新日 古い順 / ファイル名順 / 種別順 | 「更新日 新しい順 / 更新日 古い順 / ファイル名順 / 種別順」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:196 |
| ドキュメント | DocumentFilePanel | option | 更新日 新しい順 | 「更新日 新しい順」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:197 |
| ドキュメント | DocumentFilePanel | option | 更新日 古い順 | 「更新日 古い順」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:198 |
| ドキュメント | DocumentFilePanel | option | ファイル名順 | 「ファイル名順」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:199 |
| ドキュメント | DocumentFilePanel | option | チャンク数順 | 「チャンク数順」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:200 |
| ドキュメント | DocumentFilePanel | option | 種別順 | 「種別順」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:201 |
| ドキュメント | DocumentFilePanel | button | ドキュメントを追加 | 「ドキュメントを追加」を実行するボタン。 | 状態: disabled=!canOpenDocumentAdd | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:229 |
| ドキュメント | DocumentFilePanel | button | 条件をクリア | 「条件をクリア」を実行するボタン。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:236 |
| ドキュメント | DocumentFilePanel | button | `${document.fileName}を共有` | 「`${document.fileName}を共有`」を実行するボタン。 | 状態: disabled=operationState.sharingDocumentId === document.documentId | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:272 |
| ドキュメント | DocumentFilePanel | button | `${document.fileName}を移動` | 「`${document.fileName}を移動`」を実行するボタン。 | 状態: disabled=operationState.movingDocumentId === document.documentId | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:286 |
| ドキュメント | DocumentFilePanel | button | `${document.fileName}の再インデックスをステージング` | 「`${document.fileName}の再インデックスをステージング`」を実行するボタン。 | 状態: disabled=!canReindexRow \|\| operationState.stagingReindexDocumentId === document.documentId | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:299 |
| ドキュメント | DocumentFilePanel | button | `${document.fileName}を削除` | 「`${document.fileName}を削除`」を実行するボタン。 | 状態: disabled=!canDeleteRow \|\| operationState.deletingDocumentId === document.documentId | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:312 |
| ドキュメント | DocumentFilePanel | label | 表示件数 | 「表示件数」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:344 |
| ドキュメント | DocumentFilePanel | select | 表示件数 | 「表示件数」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:346 |
| ドキュメント | DocumentFilePanel | option | 件 | 「件」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:348 |
| ドキュメント | DocumentFilePanel | button | 前のページ | 「前のページ」を実行するボタン。 | 状態: disabled=documentPage <= 1 \|\| filteredDocumentsCount === 0 | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:352 |
| ドキュメント | DocumentFilePanel | button | 次のページ | 「次のページ」を実行するボタン。 | 状態: disabled=documentPage >= documentPageCount \|\| filteredDocumentsCount === 0 | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:361 |
| ドキュメント | ReindexMigrationStrip | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.cutoverMigrationId === migration.migrationId \|\| migration.status !== "stag… | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:410 |
| ドキュメント | ReindexMigrationStrip | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.rollbackMigrationId === migration.migrationId \|\| migration.status !== "cut… | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:413 |
| ドキュメント | DocumentFolderTree | label | フォルダを検索 | 「フォルダを検索」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:27 |
| ドキュメント | DocumentFolderTree | input | フォルダを検索 | 「フォルダを検索」を入力または選択する項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:28 |
| ドキュメント | DocumentFolderTree | button | フォルダ検索をクリア | 「フォルダ検索をクリア」を実行するボタン。 | 状態: disabled=!folderSearch | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:36 |
| ドキュメント | DocumentFolderTree | button | すべてのドキュメント | 「すべてのドキュメント」を実行するボタン。 | 状態: aria-current=selectedFolderId === "all" ? "true" : undefined | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:41 |
| ドキュメント | DocumentFolderTree | button | `${folder.path} ${folder.count}件` | 「`${folder.path} ${folder.count}件`」を実行するボタン。 | 状態: aria-current=selectedFolder.id === folder.id ? "true" : undefined | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:58 |
| favorites | FavoritesWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | apps/web/src/features/favorites/components/FavoritesWorkspace.tsx:49 |
| 履歴 | HistoryWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:68 |
| 履歴 | HistoryWorkspace | input | 履歴を検索 | 「履歴を検索」を入力または選択する項目。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:91 |
| 履歴 | HistoryWorkspace | select | 履歴の並び順 | 「履歴の並び順」を選ぶ選択項目。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:98 |
| 履歴 | HistoryWorkspace | option | 新しい順 | 「新しい順」を表す option 要素。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:99 |
| 履歴 | HistoryWorkspace | option | 古い順 | 「古い順」を表す option 要素。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:100 |
| 履歴 | HistoryWorkspace | option | メッセージ数順 | 「メッセージ数順」を表す option 要素。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:101 |
| 履歴 | HistoryWorkspace | label | お気に入りのみ | 「お気に入りのみ」に紐づく入力ラベル。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:103 |
| 履歴 | HistoryWorkspace | input | お気に入りのみ | 「お気に入りのみ」を入力または選択する項目。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:104 |
| 履歴 | HistoryWorkspace | button | item.isFavorite ? `${item.title}をお気に入りから外す` : `${item.title}をお気に入りに追加` | 「item.isFavorite ? `${item.title}をお気に入りから外す` : `${item.title}をお気に入りに追加`」を実行するボタン。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:117 |
| 履歴 | HistoryWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:126 |
| 履歴 | HistoryWorkspace | button | 削除 | 「削除」を実行するボタン。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:134 |
| 担当者対応 | AssigneeWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:133 |
| 担当者対応 | AssigneeWorkspace | label | ステータス / すべて | 「ステータス / すべて」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:155 |
| 担当者対応 | AssigneeWorkspace | select | すべて | 「すべて」を選ぶ選択項目。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:157 |
| 担当者対応 | AssigneeWorkspace | option | すべて | 「すべて」を表す option 要素。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:158 |
| 担当者対応 | AssigneeWorkspace | option | ステータス / すべて | 「ステータス / すべて」を表す option 要素。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:160 |
| 担当者対応 | AssigneeWorkspace | label | 検索 | 「検索」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:164 |
| 担当者対応 | AssigneeWorkspace | input | タイトル・名前・部署で検索 | 「タイトル・名前・部署で検索」を入力または選択する項目。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:166 |
| 担当者対応 | AssigneeWorkspace | button | `${question.title}を選択` | 「`${question.title}を選択`」を実行するボタン。 | 状態: aria-pressed=selected?.questionId === question.questionId | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:190 |
| 担当者対応 | AssigneeWorkspace | form | 回答作成 / 回答タイトル / 回答内容 / 参照資料 / 関連リンク / 内部メモ / 質問者へ通知する / 下書き保存 / 回答を送信 | 「回答作成 / 回答タイトル / 回答内容 / 参照資料 / 関連リンク / 内部メモ / 質問者へ通知する / 下書き保存 / 回答を送信」を入力・送信するフォーム。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:236 |
| 担当者対応 | AssigneeWorkspace | label | 回答タイトル | 「回答タイトル」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:238 |
| 担当者対応 | AssigneeWorkspace | input | 回答タイトル | 「回答タイトル」を入力または選択する項目。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:240 |
| 担当者対応 | AssigneeWorkspace | label | 回答内容 | 「回答内容」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:242 |
| 担当者対応 | AssigneeWorkspace | textarea | 回答内容 | 「回答内容」を複数行で入力する項目。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:244 |
| 担当者対応 | AssigneeWorkspace | label | 参照資料 / 関連リンク | 「参照資料 / 関連リンク」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:246 |
| 担当者対応 | AssigneeWorkspace | input | 資料名、URL、またはナレッジリンク | 「資料名、URL、またはナレッジリンク」を入力または選択する項目。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:248 |
| 担当者対応 | AssigneeWorkspace | label | 内部メモ | 「内部メモ」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:250 |
| 担当者対応 | AssigneeWorkspace | textarea | 内部メモ | 「内部メモ」を複数行で入力する項目。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:252 |
| 担当者対応 | AssigneeWorkspace | label | 質問者へ通知する | 「質問者へ通知する」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:254 |
| 担当者対応 | AssigneeWorkspace | input | 質問者へ通知する | 「質問者へ通知する」を入力または選択する項目。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:255 |
| 担当者対応 | AssigneeWorkspace | button | 下書き保存 | 「下書き保存」を実行するボタン。 | 状態: disabled=loading \|\| !isDirty | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:262 |
| 担当者対応 | AssigneeWorkspace | button | 回答を送信 | 「回答を送信」を実行するボタン。 | 状態: disabled=loading \|\| !answerTitle.trim() \|\| !answerBody.trim() | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:263 |
| 共通 | ConfirmDialog | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=busy | apps/web/src/shared/components/ConfirmDialog.tsx:72 |
| 共通 | ConfirmDialog | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=busy \|\| confirmDisabled | apps/web/src/shared/components/ConfirmDialog.tsx:73 |
| 共通 | Icon | svg | 未推定 | svg 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/shared/components/Icon.tsx:29 |
| 共通 | Button | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/shared/ui/Button.tsx:19 |
| 共通 | ConfirmDialog | button | キャンセル | 「キャンセル」を実行するボタン。 | 状態: disabled=busy | apps/web/src/shared/ui/ConfirmDialog.tsx:107 |
| 共通 | ConfirmDialog | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=busy \|\| confirmDisabled | apps/web/src/shared/ui/ConfirmDialog.tsx:108 |
| 共通 | IconButton | button | label | 「label」を実行するボタン。 | - | apps/web/src/shared/ui/IconButton.tsx:14 |
| 共通 | ResourceStatePanel | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-controls=state.target.regionId | apps/web/src/shared/ui/ResourceState.tsx:175 |
| 共通 | ResourceStatePanel | button | 処理中 | 「処理中」を実行するボタン。 | 状態: aria-controls=state.target.regionId, disabled=true | apps/web/src/shared/ui/ResourceState.tsx:177 |
| 共通 | ResourceStatePanel | button | 戻る | 「戻る」を実行するボタン。 | - | apps/web/src/shared/ui/ResourceState.tsx:178 |
| 共通 | ResourceStatePanel | button | サポート情報 | 「サポート情報」を実行するボタン。 | - | apps/web/src/shared/ui/ResourceState.tsx:179 |

## 仕様書での読み替え

| 抽出値 | この資料での意味 |
| --- | --- |
| アクセシブル名 | ボタンや入力項目が利用者にどう説明されるか。 |
| 説明参照 | 補足、制約、エラー、リスク説明がどの UI と結びつくか。 |
| 状態属性 | 現在地、展開状態、選択状態、処理中、無効状態など、操作時の状態。 |
| 場所 | 説明の元になった JSX のファイルと行番号。 |
