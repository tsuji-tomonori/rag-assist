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
| 管理 | admin | 35 | 「チャットへ戻る」を実行するボタン。<br>「ドキュメント管理 / 件」を実行するボタン。<br>「担当者対応 / 件が対応待ち」を実行するボタン。<br>「デバッグ / 評価 / 件の実行履歴」を実行するボタン。 ほか 26 件 | [admin.md](web-features/admin.md) |
| アプリケーション枠 | app | 18 | 「チャットへ戻る」を実行するボタン。<br>「送信キー / Enterで送信 / Ctrl+Enterで送信」に紐づく入力ラベル。<br>「Enterで送信 / Ctrl+Enterで送信」を選ぶ選択項目。<br>「Enterで送信」を表す option 要素。 ほか 14 件 | [app.md](web-features/app.md) |
| 認証 | auth | 26 | 「title」を入力・送信するフォーム。<br>「新しいパスワード」に紐づく入力ラベル。<br>「新しいパスワード」を入力または選択する項目。<br>「新しいパスワード（確認）」に紐づく入力ラベル。 ほか 14 件 | [auth.md](web-features/auth.md) |
| 性能テスト | benchmark | 18 | 「チャットへ戻る」を実行するボタン。<br>「テスト種別」に紐づく入力ラベル。<br>「テスト種別」を選ぶ選択項目。<br>「benchmark suite を取得できません」を表す option 要素。 ほか 12 件 | [benchmark.md](web-features/benchmark.md) |
| チャット | chat | 41 | 「回答をコピー済み / 回答をコピー」を実行するボタン。<br>「この候補で質問する」を実行するボタン。<br>「自分で入力」を実行するボタン。<br>「追加質問候補」を実行するボタン。 ほか 36 件 | [chat.md](web-features/chat.md) |
| デバッグ | debug | 11 | 「拡大デバッグパネルを閉じる」を実行するボタン。<br>「保存JSON」を実行するボタン。<br>「可視化JSON」を実行するボタン。<br>「JSONをアップロード」に紐づく入力ラベル。 ほか 3 件 | [debug.md](web-features/debug.md) |
| ドキュメント | documents | 88 | 「管理者設定へ戻る」を実行するボタン。<br>「文書詳細を閉じる」を実行するボタン。<br>「この資料に質問する」を実行するボタン。<br>「再インデックス」を実行するボタン。 ほか 70 件 | [documents.md](web-features/documents.md) |
| 履歴 | history | 11 | 「チャットへ戻る」を実行するボタン。<br>「履歴を検索」を入力または選択する項目。<br>「履歴の並び順」を選ぶ選択項目。<br>「新しい順」を表す option 要素。 ほか 5 件 | [history.md](web-features/history.md) |
| 担当者対応 | questions | 21 | 「チャットへ戻る」を実行するボタン。<br>「ステータス / すべて」に紐づく入力ラベル。<br>「すべて」を選ぶ選択項目。<br>「すべて」を表す option 要素。 ほか 16 件 | [questions.md](web-features/questions.md) |
| 共通 | shared | 7 | 「キャンセル」を実行するボタン。<br>「label」を実行するボタン。 | [shared.md](web-features/shared.md) |

## UI 操作説明

| 機能 | コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | 場所 |
| --- | --- | --- | --- | --- | --- | --- |
| アプリケーション枠 | PersonalSettingsView | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | apps/web/src/app/components/PersonalSettingsView.tsx:25 |
| アプリケーション枠 | PersonalSettingsView | label | 送信キー / Enterで送信 / Ctrl+Enterで送信 | 「送信キー / Enterで送信 / Ctrl+Enterで送信」に紐づく入力ラベル。 | - | apps/web/src/app/components/PersonalSettingsView.tsx:35 |
| アプリケーション枠 | PersonalSettingsView | select | Enterで送信 / Ctrl+Enterで送信 | 「Enterで送信 / Ctrl+Enterで送信」を選ぶ選択項目。 | - | apps/web/src/app/components/PersonalSettingsView.tsx:37 |
| アプリケーション枠 | PersonalSettingsView | option | Enterで送信 | 「Enterで送信」を表す option 要素。 | - | apps/web/src/app/components/PersonalSettingsView.tsx:42 |
| アプリケーション枠 | PersonalSettingsView | option | Ctrl+Enterで送信 | 「Ctrl+Enterで送信」を表す option 要素。 | - | apps/web/src/app/components/PersonalSettingsView.tsx:43 |
| アプリケーション枠 | PersonalSettingsView | button | サインアウト | 「サインアウト」を実行するボタン。 | - | apps/web/src/app/components/PersonalSettingsView.tsx:48 |
| アプリケーション枠 | RailNav | a | ホーム | 「ホーム」へ移動するリンク。 | - | apps/web/src/app/components/RailNav.tsx:24 |
| アプリケーション枠 | RailNav | button | チャット | 「チャット」を実行するボタン。 | 状態: aria-current=activeView === "chat" ? "page" : undefined | apps/web/src/app/components/RailNav.tsx:28 |
| アプリケーション枠 | RailNav | button | 担当者対応 | 「担当者対応」を実行するボタン。 | 状態: aria-current=activeView === "assignee" ? "page" : undefined | apps/web/src/app/components/RailNav.tsx:33 |
| アプリケーション枠 | RailNav | button | 履歴 | 「履歴」を実行するボタン。 | 状態: aria-current=activeView === "history" ? "page" : undefined | apps/web/src/app/components/RailNav.tsx:38 |
| アプリケーション枠 | RailNav | button | 性能テスト | 「性能テスト」を実行するボタン。 | 状態: aria-current=activeView === "benchmark" ? "page" : undefined | apps/web/src/app/components/RailNav.tsx:43 |
| アプリケーション枠 | RailNav | button | お気に入り | 「お気に入り」を実行するボタン。 | 状態: aria-current=activeView === "favorites" ? "page" : undefined | apps/web/src/app/components/RailNav.tsx:48 |
| アプリケーション枠 | RailNav | button | ドキュメント | 「ドキュメント」を実行するボタン。 | 状態: aria-current=activeView === "documents" ? "page" : undefined | apps/web/src/app/components/RailNav.tsx:53 |
| アプリケーション枠 | RailNav | button | 管理者設定 | 「管理者設定」を実行するボタン。 | 状態: aria-current=activeView === "admin" ? "page" : undefined | apps/web/src/app/components/RailNav.tsx:59 |
| アプリケーション枠 | RailNav | button | 個人設定 | 「個人設定」を実行するボタン。 | 状態: aria-current=activeView === "profile" ? "page" : undefined | apps/web/src/app/components/RailNav.tsx:65 |
| アプリケーション枠 | TopBar | label | デバッグモード | 「デバッグモード」に紐づく入力ラベル。 | - | apps/web/src/app/components/TopBar.tsx:18 |
| アプリケーション枠 | TopBar | input | デバッグモード | 「デバッグモード」を入力または選択する項目。 | - | apps/web/src/app/components/TopBar.tsx:20 |
| アプリケーション枠 | TopBar | button | 新しい会話 | 「新しい会話」を実行するボタン。 | - | apps/web/src/app/components/TopBar.tsx:24 |
| 管理 | AdminWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:113 |
| 管理 | AdminOverviewGrid | button | ドキュメント管理 / 件 | 「ドキュメント管理 / 件」を実行するボタン。 | - | apps/web/src/features/admin/components/panels/AdminOverviewGrid.tsx:55 |
| 管理 | AdminOverviewGrid | button | 担当者対応 / 件が対応待ち | 「担当者対応 / 件が対応待ち」を実行するボタン。 | - | apps/web/src/features/admin/components/panels/AdminOverviewGrid.tsx:62 |
| 管理 | AdminOverviewGrid | button | デバッグ / 評価 / 件の実行履歴 | 「デバッグ / 評価 / 件の実行履歴」を実行するボタン。 | - | apps/web/src/features/admin/components/panels/AdminOverviewGrid.tsx:69 |
| 管理 | AdminOverviewGrid | button | 性能テスト / 件の実行履歴 | 「性能テスト / 件の実行履歴」を実行するボタン。 | - | apps/web/src/features/admin/components/panels/AdminOverviewGrid.tsx:76 |
| 管理 | AdminUserPanel | button | 更新 | 「更新」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:39 |
| 管理 | AdminUserPanel | AdminCreateUserForm | 未推定 | AdminCreateUserForm 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:45 |
| 管理 | AdminCreateUserForm | form | 管理対象ユーザー作成 | 「管理対象ユーザー作成」を入力・送信するフォーム。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:110 |
| 管理 | AdminCreateUserForm | label | メール | 「メール」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:111 |
| 管理 | AdminCreateUserForm | input | new-user@example.com | 「new-user@example.com」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:113 |
| 管理 | AdminCreateUserForm | label | 表示名 | 「表示名」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:115 |
| 管理 | AdminCreateUserForm | input | 任意 | 「任意」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:117 |
| 管理 | AdminCreateUserForm | label | 初期ロール | 「初期ロール」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:119 |
| 管理 | AdminCreateUserForm | select | 初期ロール | 「初期ロール」を選ぶ選択項目。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:121 |
| 管理 | AdminCreateUserForm | option | 初期ロール | 「初期ロール」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:123 |
| 管理 | AdminCreateUserForm | button | 作成 | 「作成」を実行するボタン。 | 状態: disabled=loading \|\| email.trim().length === 0 | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:127 |
| 管理 | ManagedUserRow | select | `${user.email}に付与するロール` | 「`${user.email}に付与するロール`」を選ぶ選択項目。 | 状態: disabled=!canAssignRoles \|\| loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:174 |
| 管理 | ManagedUserRow | option | role.role | 「role.role」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:176 |
| 管理 | ManagedUserRow | button | 付与 | 「付与」を実行するボタン。 | 状態: disabled=!canAssignRoles \|\| loading \|\| user.groups.includes(selectedRole) | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:179 |
| 管理 | ManagedUserRow | button | 再開 | 「再開」を実行するボタン。 | 状態: disabled=!canUnsuspend \|\| loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:189 |
| 管理 | ManagedUserRow | button | 停止 | 「停止」を実行するボタン。 | 状態: disabled=!canSuspend \|\| loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:194 |
| 管理 | ManagedUserRow | button | 削除 | 「削除」を実行するボタン。 | 状態: disabled=!canDelete \|\| loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:199 |
| 管理 | AliasAdminPanel | button | 公開 | 「公開」を実行するボタン。 | 状態: disabled=!canPublish \|\| loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:63 |
| 管理 | AliasAdminPanel | form | 用語 / 展開語 / 部署 scope / 追加 | 「用語 / 展開語 / 部署 scope / 追加」を入力・送信するフォーム。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:71 |
| 管理 | AliasAdminPanel | label | 用語 | 「用語」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:72 |
| 管理 | AliasAdminPanel | input | pto | 「pto」を入力または選択する項目。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:74 |
| 管理 | AliasAdminPanel | label | 展開語 | 「展開語」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:76 |
| 管理 | AliasAdminPanel | input | 有給休暇, 休暇申請 | 「有給休暇, 休暇申請」を入力または選択する項目。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:78 |
| 管理 | AliasAdminPanel | label | 部署 scope | 「部署 scope」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:80 |
| 管理 | AliasAdminPanel | input | 任意 | 「任意」を入力または選択する項目。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:82 |
| 管理 | AliasAdminPanel | button | 追加 | 「追加」を実行するボタン。 | 状態: disabled=loading \|\| !term.trim() \|\| parseExpansionList(expansions).length === 0 | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:84 |
| 管理 | AliasAdminPanel | button | 下書き化 | 「下書き化」を実行するボタン。 | 状態: disabled=!canWrite \|\| loading \|\| alias.status === "disabled" | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:103 |
| 管理 | AliasAdminPanel | button | 承認 | 「承認」を実行するボタン。 | 状態: disabled=!canReview \|\| loading \|\| alias.status === "disabled" | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:107 |
| 管理 | AliasAdminPanel | button | 差戻 | 「差戻」を実行するボタン。 | 状態: disabled=!canReview \|\| loading \|\| alias.status === "disabled" | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:111 |
| 管理 | AliasAdminPanel | button | 無効 | 「無効」を実行するボタン。 | 状態: disabled=!canDisable \|\| loading \|\| alias.status === "disabled" | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:115 |
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
| 性能テスト | BenchmarkWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:61 |
| 性能テスト | BenchmarkWorkspace | label | テスト種別 | 「テスト種別」に紐づく入力ラベル。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:87 |
| 性能テスト | BenchmarkWorkspace | select | テスト種別 | 「テスト種別」を選ぶ選択項目。 | 状態: disabled=!hasSuites | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:89 |
| 性能テスト | BenchmarkWorkspace | option | benchmark suite を取得できません | 「benchmark suite を取得できません」を表す option 要素。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:90 |
| 性能テスト | BenchmarkWorkspace | option | テスト種別 | 「テスト種別」を表す option 要素。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:92 |
| 性能テスト | BenchmarkWorkspace | label | データセット | 「データセット」に紐づく入力ラベル。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:108 |
| 性能テスト | BenchmarkWorkspace | input | データセット | 「データセット」を入力または選択する項目。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:110 |
| 性能テスト | BenchmarkWorkspace | label | モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku | 「モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku」に紐づく入力ラベル。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:112 |
| 性能テスト | BenchmarkWorkspace | select | Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku | 「Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku」を選ぶ選択項目。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:114 |
| 性能テスト | BenchmarkWorkspace | option | Nova Lite v1 | 「Nova Lite v1」を表す option 要素。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:115 |
| 性能テスト | BenchmarkWorkspace | option | Claude 3.5 Sonnet | 「Claude 3.5 Sonnet」を表す option 要素。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:116 |
| 性能テスト | BenchmarkWorkspace | option | Claude 3 Haiku | 「Claude 3 Haiku」を表す option 要素。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:117 |
| 性能テスト | BenchmarkWorkspace | label | 並列数 | 「並列数」に紐づく入力ラベル。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:120 |
| 性能テスト | BenchmarkWorkspace | input | 並列数 | 「並列数」を入力または選択する項目。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:122 |
| 性能テスト | BenchmarkWorkspace | button | 性能テストを実行 | 「性能テストを実行」を実行するボタン。 | 状態: disabled=loading \|\| !canRun \|\| !selectedSuite | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:131 |
| 性能テスト | BenchmarkWorkspace | button | 更新 | 「更新」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:135 |
| 性能テスト | BenchmarkWorkspace | button | `${artifact.description}をダウンロード` | 「`${artifact.description}をダウンロード`」を実行するボタン。 | 状態: disabled=!canDownload \|\| !canDownloadArtifact(run, artifact.kind) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:187 |
| 性能テスト | BenchmarkWorkspace | button | `${run.runId}のジョブをキャンセル` | 「`${run.runId}のジョブをキャンセル`」を実行するボタン。 | 状態: disabled=!canCancel \|\| loading \|\| !["queued", "running"].includes(run.status) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:199 |
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
| デバッグ | DebugFlowNodeButton | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-pressed=selected | apps/web/src/features/debug/components/panel/DebugPanelBody.tsx:127 |
| デバッグ | DebugStepList | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-expanded=expandedStep | apps/web/src/features/debug/components/panel/DebugPanelBody.tsx:200 |
| デバッグ | DebugPanelHeader | button | 保存JSON | 「保存JSON」を実行するボタン。 | 状態: disabled=!activeTrace \|\| pending \|\| Boolean(replayEnvelope) | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:39 |
| デバッグ | DebugPanelHeader | button | 可視化JSON | 「可視化JSON」を実行するボタン。 | 状態: disabled=!envelope \|\| pending | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:43 |
| デバッグ | DebugPanelHeader | label | JSONをアップロード | 「JSONをアップロード」に紐づく入力ラベル。 | - | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:47 |
| デバッグ | DebugPanelHeader | input | JSONをアップロード | 「JSONをアップロード」を入力または選択する項目。 | - | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:50 |
| デバッグ | DebugPanelHeader | button | 解除 | 「解除」を実行するボタン。 | - | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:53 |
| デバッグ | DebugPanelHeader | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-expanded=allExpanded | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:58 |
| デバッグ | DebugPanelHeader | button | デバッグパネルを拡大表示 | 「デバッグパネルを拡大表示」を実行するボタン。 | - | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:60 |
| ドキュメント | DocumentWorkspace | button | 管理者設定へ戻る | 「管理者設定へ戻る」を実行するボタン。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:391 |
| ドキュメント | DocumentDetailDrawer | button | 文書詳細を閉じる | 「文書詳細を閉じる」を実行するボタン。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:55 |
| ドキュメント | DocumentDetailDrawer | button | この資料に質問する | 「この資料に質問する」を実行するボタン。 | 状態: disabled=!onAskDocument | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:80 |
| ドキュメント | DocumentDetailDrawer | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:84 |
| ドキュメント | DocumentDetailDrawer | button | 再インデックス | 「再インデックス」を実行するボタン。 | 状態: disabled=!canReindex | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:88 |
| ドキュメント | DocumentDetailDrawer | button | 削除 | 「削除」を実行するボタン。 | 状態: disabled=!canDelete | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:92 |
| ドキュメント | DocumentDetailPanel | form | 共有フォルダ / 選択してください / 共有 Cognito group / 既存 shared group 候補 / 追加: / 削除: / 変更なし: / 共有更新 | 「共有フォルダ / 選択してください / 共有 Cognito group / 既存 shared group 候補 / 追加: / 削除: / 変更なし: / 共有更新」を入力・送信するフォーム。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:160 |
| ドキュメント | DocumentDetailPanel | label | 共有フォルダ / 選択してください | 「共有フォルダ / 選択してください」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:161 |
| ドキュメント | DocumentDetailPanel | select | 選択してください | 「選択してください」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:163 |
| ドキュメント | DocumentDetailPanel | option | 選択してください | 「選択してください」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:164 |
| ドキュメント | DocumentDetailPanel | option | 共有フォルダ / 選択してください | 「共有フォルダ / 選択してください」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:166 |
| ドキュメント | DocumentDetailPanel | label | 共有 Cognito group | 「共有 Cognito group」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:170 |
| ドキュメント | DocumentDetailPanel | input | Cognito group をカンマ区切りで入力 | 「Cognito group をカンマ区切りで入力」を入力または選択する項目。 | 説明参照: share-groups-validation share-groups-diff<br>状態: aria-invalid=shareHasValidationError \|\| undefined, disabled=!canWrite \|\| operationState.sharingGroupId !== null | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:172 |
| ドキュメント | DocumentDetailPanel | label | 未推定 | label 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:196 |
| ドキュメント | DocumentDetailPanel | input | 未推定 | input 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:197 |
| ドキュメント | DocumentDetailPanel | label | 既存共有をすべて削除することを確認しました | 「既存共有をすべて削除することを確認しました」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:216 |
| ドキュメント | DocumentDetailPanel | input | 既存共有をすべて削除することを確認しました | 「既存共有をすべて削除することを確認しました」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:217 |
| ドキュメント | DocumentDetailPanel | button | 共有更新 | 「共有更新」を実行するボタン。 | 状態: disabled=!canWrite \|\| !shareTargetGroupId \|\| shareHasValidationError \|\| !shareHasChanges \|\| (share… | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:226 |
| ドキュメント | DocumentDetailPanel | form | 保存先フォルダ / 保存先を選択 / アップロード | 「保存先フォルダ / 保存先を選択 / アップロード」を入力・送信するフォーム。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:252 |
| ドキュメント | DocumentDetailPanel | label | 保存先フォルダ / 保存先を選択 | 「保存先フォルダ / 保存先を選択」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:253 |
| ドキュメント | DocumentDetailPanel | select | 保存先を選択 | 「保存先を選択」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.isUploading | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:255 |
| ドキュメント | DocumentDetailPanel | option | 保存先を選択 | 「保存先を選択」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:256 |
| ドキュメント | DocumentDetailPanel | option | 保存先フォルダ / 保存先を選択 | 「保存先フォルダ / 保存先を選択」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:258 |
| ドキュメント | DocumentDetailPanel | label | 文書アップロード | 「文書アップロード」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:262 |
| ドキュメント | DocumentDetailPanel | input | アップロードする文書を選択 | 「アップロードする文書を選択」を入力または選択する項目。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:265 |
| ドキュメント | DocumentDetailPanel | button | アップロード | 「アップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| !uploadFile \|\| operationState.isUploading | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:268 |
| ドキュメント | DocumentDetailPanel | form | 新規フォルダ名 / 説明 / 親フォルダ / 親フォルダなし / 公開範囲 / 非公開 / 指定 group 共有 / 組織全体 / 初期 shared groups / 既存 shared gro… | 「新規フォルダ名 / 説明 / 親フォルダ / 親フォルダなし / 公開範囲 / 非公開 / 指定 group 共有 / 組織全体 / 初期 shared groups / 既存 shared gro…」を入力・送信するフォーム。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:276 |
| ドキュメント | DocumentDetailPanel | label | 新規フォルダ名 | 「新規フォルダ名」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:277 |
| ドキュメント | DocumentDetailPanel | input | フォルダ名 | 「フォルダ名」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:279 |
| ドキュメント | DocumentDetailPanel | label | 説明 | 「説明」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:281 |
| ドキュメント | DocumentDetailPanel | textarea | フォルダの用途や対象資料 | 「フォルダの用途や対象資料」を複数行で入力する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:283 |
| ドキュメント | DocumentDetailPanel | label | 親フォルダ / 親フォルダなし | 「親フォルダ / 親フォルダなし」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:285 |
| ドキュメント | DocumentDetailPanel | select | 親フォルダなし | 「親フォルダなし」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:287 |
| ドキュメント | DocumentDetailPanel | option | 親フォルダなし | 「親フォルダなし」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:288 |
| ドキュメント | DocumentDetailPanel | option | 親フォルダ / 親フォルダなし | 「親フォルダ / 親フォルダなし」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:290 |
| ドキュメント | DocumentDetailPanel | label | 公開範囲 / 非公開 / 指定 group 共有 / 組織全体 | 「公開範囲 / 非公開 / 指定 group 共有 / 組織全体」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:294 |
| ドキュメント | DocumentDetailPanel | select | 非公開 / 指定 group 共有 / 組織全体 | 「非公開 / 指定 group 共有 / 組織全体」を選ぶ選択項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:296 |
| ドキュメント | DocumentDetailPanel | option | 非公開 | 「非公開」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:297 |
| ドキュメント | DocumentDetailPanel | option | 指定 group 共有 | 「指定 group 共有」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:298 |
| ドキュメント | DocumentDetailPanel | option | 組織全体 | 「組織全体」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:299 |
| ドキュメント | DocumentDetailPanel | label | 初期 shared groups | 「初期 shared groups」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:302 |
| ドキュメント | DocumentDetailPanel | input | Cognito group をカンマ区切りで入力 | 「Cognito group をカンマ区切りで入力」を入力または選択する項目。 | 説明参照: create-group-validation create-group-preview<br>状態: aria-invalid=(validatesCreateSharedGroups && (createSharedDraft.hasEmptyToken \|\| createSharedDraft.dup…, disabled=!canWrite \|\| operationState.creatingGroup \|\| groupVisibility !== "shared" | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:304 |
| ドキュメント | DocumentDetailPanel | label | 未推定 | label 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:322 |
| ドキュメント | DocumentDetailPanel | input | 未推定 | input 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup \|\| groupVisibility !== "shared" | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:323 |
| ドキュメント | DocumentDetailPanel | label | 管理者 user IDs | 「管理者 user IDs」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:336 |
| ドキュメント | DocumentDetailPanel | input | User ID をカンマ区切りで入力 | 「User ID をカンマ区切りで入力」を入力または選択する項目。 | 説明参照: create-group-validation create-group-preview<br>状態: aria-invalid=(createManagerDraft.hasEmptyToken \|\| createManagerDraft.duplicates.length > 0) \|\| undefin…, disabled=!canWrite \|\| operationState.creatingGroup | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:338 |
| ドキュメント | DocumentDetailPanel | label | 作成後にこのフォルダへ移動 | 「作成後にこのフォルダへ移動」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:347 |
| ドキュメント | DocumentDetailPanel | input | 作成後にこのフォルダへ移動 | 「作成後にこのフォルダへ移動」を入力または選択する項目。 | 状態: disabled=!canWrite \|\| operationState.creatingGroup | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:348 |
| ドキュメント | DocumentDetailPanel | button | 新規フォルダ | 「新規フォルダ」を実行するボタン。 | 状態: disabled=!canWrite \|\| !groupName.trim() \|\| createHasValidationError \|\| operationState.creatingGroup | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:365 |
| ドキュメント | DocumentFilePanel | button | このフォルダにアップロード / 保存先を選択してアップロード | 「このフォルダにアップロード / 保存先を選択してアップロード」を実行するボタン。 | 状態: disabled=!canUploadToDestination \|\| operationState.isUploading | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:110 |
| ドキュメント | DocumentFilePanel | button | 共有設定を編集 | 「共有設定を編集」を実行するボタン。 | 状態: disabled=!canWrite \|\| operationState.sharingGroupId !== null | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:119 |
| ドキュメント | DocumentFilePanel | label | ファイル名検索 | 「ファイル名検索」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:132 |
| ドキュメント | DocumentFilePanel | input | ファイル名 | 「ファイル名」を入力または選択する項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:134 |
| ドキュメント | DocumentFilePanel | label | 種別 / すべて | 「種別 / すべて」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:136 |
| ドキュメント | DocumentFilePanel | select | すべて | 「すべて」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:138 |
| ドキュメント | DocumentFilePanel | option | すべて | 「すべて」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:139 |
| ドキュメント | DocumentFilePanel | option | 種別 / すべて | 「種別 / すべて」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:141 |
| ドキュメント | DocumentFilePanel | label | 状態 / すべて | 「状態 / すべて」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:145 |
| ドキュメント | DocumentFilePanel | select | すべて | 「すべて」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:147 |
| ドキュメント | DocumentFilePanel | option | すべて | 「すべて」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:148 |
| ドキュメント | DocumentFilePanel | option | 状態 / すべて | 「状態 / すべて」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:150 |
| ドキュメント | DocumentFilePanel | label | 所属フォルダ / すべて / 未設定 | 「所属フォルダ / すべて / 未設定」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:154 |
| ドキュメント | DocumentFilePanel | select | すべて / 未設定 | 「すべて / 未設定」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:156 |
| ドキュメント | DocumentFilePanel | option | すべて | 「すべて」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:157 |
| ドキュメント | DocumentFilePanel | option | 未設定 | 「未設定」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:158 |
| ドキュメント | DocumentFilePanel | option | 所属フォルダ / すべて / 未設定 | 「所属フォルダ / すべて / 未設定」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:160 |
| ドキュメント | DocumentFilePanel | label | 並び替え / 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順 | 「並び替え / 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:164 |
| ドキュメント | DocumentFilePanel | select | 更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順 | 「更新日 新しい順 / 更新日 古い順 / ファイル名順 / チャンク数順 / 種別順」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:166 |
| ドキュメント | DocumentFilePanel | option | 更新日 新しい順 | 「更新日 新しい順」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:167 |
| ドキュメント | DocumentFilePanel | option | 更新日 古い順 | 「更新日 古い順」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:168 |
| ドキュメント | DocumentFilePanel | option | ファイル名順 | 「ファイル名順」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:169 |
| ドキュメント | DocumentFilePanel | option | チャンク数順 | 「チャンク数順」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:170 |
| ドキュメント | DocumentFilePanel | option | 種別順 | 「種別順」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:171 |
| ドキュメント | DocumentFilePanel | button | ファイルをアップロード | 「ファイルをアップロード」を実行するボタン。 | 状態: disabled=!canWrite \|\| !uploadGroupId | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:190 |
| ドキュメント | DocumentFilePanel | button | `${document.fileName}の再インデックスをステージング` | 「`${document.fileName}の再インデックスをステージング`」を実行するボタン。 | 状態: disabled=!canReindex \|\| operationState.stagingReindexDocumentId === document.documentId | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:226 |
| ドキュメント | DocumentFilePanel | button | `${document.fileName}を削除` | 「`${document.fileName}を削除`」を実行するボタン。 | 状態: disabled=!canDelete \|\| operationState.deletingDocumentId === document.documentId | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:238 |
| ドキュメント | DocumentFilePanel | label | 表示件数 | 「表示件数」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:269 |
| ドキュメント | DocumentFilePanel | select | 表示件数 | 「表示件数」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:271 |
| ドキュメント | DocumentFilePanel | option | 件 | 「件」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:273 |
| ドキュメント | DocumentFilePanel | button | 前のページ | 「前のページ」を実行するボタン。 | 状態: disabled=documentPage <= 1 \|\| filteredDocumentsCount === 0 | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:277 |
| ドキュメント | DocumentFilePanel | button | 次のページ | 「次のページ」を実行するボタン。 | 状態: disabled=documentPage >= documentPageCount \|\| filteredDocumentsCount === 0 | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:286 |
| ドキュメント | ReindexMigrationStrip | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.cutoverMigrationId === migration.migrationId \|\| migration.status !== "stag… | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:335 |
| ドキュメント | ReindexMigrationStrip | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.rollbackMigrationId === migration.migrationId \|\| migration.status !== "cut… | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:338 |
| ドキュメント | DocumentFolderTree | label | フォルダを検索 | 「フォルダを検索」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:27 |
| ドキュメント | DocumentFolderTree | input | フォルダを検索 | 「フォルダを検索」を入力または選択する項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:28 |
| ドキュメント | DocumentFolderTree | button | フォルダ検索をクリア | 「フォルダ検索をクリア」を実行するボタン。 | 状態: disabled=!folderSearch | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:36 |
| ドキュメント | DocumentFolderTree | button | すべてのドキュメント | 「すべてのドキュメント」を実行するボタン。 | 状態: aria-current=selectedFolderId === "all" ? "true" : undefined | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:41 |
| ドキュメント | DocumentFolderTree | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=selectedFolder.id === folder.id ? "true" : undefined | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:58 |
| 履歴 | HistoryWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:53 |
| 履歴 | HistoryWorkspace | input | 履歴を検索 | 「履歴を検索」を入力または選択する項目。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:67 |
| 履歴 | HistoryWorkspace | select | 履歴の並び順 | 「履歴の並び順」を選ぶ選択項目。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:74 |
| 履歴 | HistoryWorkspace | option | 新しい順 | 「新しい順」を表す option 要素。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:75 |
| 履歴 | HistoryWorkspace | option | 古い順 | 「古い順」を表す option 要素。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:76 |
| 履歴 | HistoryWorkspace | option | メッセージ数順 | 「メッセージ数順」を表す option 要素。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:77 |
| 履歴 | HistoryWorkspace | label | お気に入りのみ | 「お気に入りのみ」に紐づく入力ラベル。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:79 |
| 履歴 | HistoryWorkspace | input | お気に入りのみ | 「お気に入りのみ」を入力または選択する項目。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:80 |
| 履歴 | HistoryWorkspace | button | item.isFavorite ? `${item.title}をお気に入りから外す` : `${item.title}をお気に入りに追加` | 「item.isFavorite ? `${item.title}をお気に入りから外す` : `${item.title}をお気に入りに追加`」を実行するボタン。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:93 |
| 履歴 | HistoryWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:102 |
| 履歴 | HistoryWorkspace | button | 削除 | 「削除」を実行するボタン。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:110 |
| 担当者対応 | AssigneeWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:117 |
| 担当者対応 | AssigneeWorkspace | label | ステータス / すべて | 「ステータス / すべて」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:130 |
| 担当者対応 | AssigneeWorkspace | select | すべて | 「すべて」を選ぶ選択項目。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:132 |
| 担当者対応 | AssigneeWorkspace | option | すべて | 「すべて」を表す option 要素。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:133 |
| 担当者対応 | AssigneeWorkspace | option | ステータス / すべて | 「ステータス / すべて」を表す option 要素。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:135 |
| 担当者対応 | AssigneeWorkspace | label | 検索 | 「検索」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:139 |
| 担当者対応 | AssigneeWorkspace | input | タイトル・名前・部署で検索 | 「タイトル・名前・部署で検索」を入力または選択する項目。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:141 |
| 担当者対応 | AssigneeWorkspace | button | `${question.title}を選択` | 「`${question.title}を選択`」を実行するボタン。 | 状態: aria-pressed=selected?.questionId === question.questionId | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:165 |
| 担当者対応 | AssigneeWorkspace | form | 回答作成 / 回答タイトル / 回答内容 / 参照資料 / 関連リンク / 内部メモ / 質問者へ通知する / 下書き保存 / 回答を送信 | 「回答作成 / 回答タイトル / 回答内容 / 参照資料 / 関連リンク / 内部メモ / 質問者へ通知する / 下書き保存 / 回答を送信」を入力・送信するフォーム。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:211 |
| 担当者対応 | AssigneeWorkspace | label | 回答タイトル | 「回答タイトル」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:213 |
| 担当者対応 | AssigneeWorkspace | input | 回答タイトル | 「回答タイトル」を入力または選択する項目。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:215 |
| 担当者対応 | AssigneeWorkspace | label | 回答内容 | 「回答内容」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:217 |
| 担当者対応 | AssigneeWorkspace | textarea | 回答内容 | 「回答内容」を複数行で入力する項目。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:219 |
| 担当者対応 | AssigneeWorkspace | label | 参照資料 / 関連リンク | 「参照資料 / 関連リンク」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:221 |
| 担当者対応 | AssigneeWorkspace | input | 資料名、URL、またはナレッジリンク | 「資料名、URL、またはナレッジリンク」を入力または選択する項目。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:223 |
| 担当者対応 | AssigneeWorkspace | label | 内部メモ | 「内部メモ」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:225 |
| 担当者対応 | AssigneeWorkspace | textarea | 内部メモ | 「内部メモ」を複数行で入力する項目。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:227 |
| 担当者対応 | AssigneeWorkspace | label | 質問者へ通知する | 「質問者へ通知する」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:229 |
| 担当者対応 | AssigneeWorkspace | input | 質問者へ通知する | 「質問者へ通知する」を入力または選択する項目。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:230 |
| 担当者対応 | AssigneeWorkspace | button | 下書き保存 | 「下書き保存」を実行するボタン。 | 状態: disabled=loading \|\| !isDirty | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:237 |
| 担当者対応 | AssigneeWorkspace | button | 回答を送信 | 「回答を送信」を実行するボタン。 | 状態: disabled=loading \|\| !answerTitle.trim() \|\| !answerBody.trim() | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:238 |
| 共通 | ConfirmDialog | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=busy | apps/web/src/shared/components/ConfirmDialog.tsx:67 |
| 共通 | ConfirmDialog | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=busy | apps/web/src/shared/components/ConfirmDialog.tsx:68 |
| 共通 | Icon | svg | 未推定 | svg 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/shared/components/Icon.tsx:27 |
| 共通 | Button | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/shared/ui/Button.tsx:19 |
| 共通 | ConfirmDialog | button | キャンセル | 「キャンセル」を実行するボタン。 | 状態: disabled=busy | apps/web/src/shared/ui/ConfirmDialog.tsx:105 |
| 共通 | ConfirmDialog | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=busy | apps/web/src/shared/ui/ConfirmDialog.tsx:106 |
| 共通 | IconButton | button | label | 「label」を実行するボタン。 | - | apps/web/src/shared/ui/IconButton.tsx:14 |

## 仕様書での読み替え

| 抽出値 | この資料での意味 |
| --- | --- |
| アクセシブル名 | ボタンや入力項目が利用者にどう説明されるか。 |
| 説明参照 | 補足、制約、エラー、リスク説明がどの UI と結びつくか。 |
| 状態属性 | 現在地、展開状態、選択状態、処理中、無効状態など、操作時の状態。 |
| 場所 | 説明の元になった JSX のファイルと行番号。 |
