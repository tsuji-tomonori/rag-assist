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
| 管理 | admin | 134 | 「チャットへ戻る」を実行するボタン。<br>「管理操作履歴を絞り込む」を入力・送信するフォーム。<br>「対象・実行者を検索」に紐づく入力ラベル。<br>「対象・実行者を検索」を入力または選択する項目。 ほか 93 件 | [admin.md](web-features/admin.md) |
| agents | agents | 4 | 「チャットへ戻る」を実行するボタン。<br>「非同期エージェント情報を更新」を実行するボタン。<br>「キャンセル」を実行するボタン。 | [agents.md](web-features/agents.md) |
| アプリケーション枠 | app | 15 | 「チャットへ戻る」を実行するボタン。<br>「送信キー / Enterで送信 / Ctrl+Enterで送信」に紐づく入力ラベル。<br>「Enterで送信 / Ctrl+Enterで送信」を選ぶ選択項目。<br>「Enterで送信」を表す option 要素。 ほか 8 件 | [app.md](web-features/app.md) |
| 認証 | auth | 26 | 「title」を入力・送信するフォーム。<br>「新しいパスワード」に紐づく入力ラベル。<br>「新しいパスワード」を入力または選択する項目。<br>「新しいパスワード（確認）」に紐づく入力ラベル。 ほか 14 件 | [auth.md](web-features/auth.md) |
| 性能テスト | benchmark | 18 | 「チャットへ戻る」を実行するボタン。<br>「テスト種別」に紐づく入力ラベル。<br>「テスト種別」を選ぶ選択項目。<br>「テスト設定を取得できません」を表す option 要素。 ほか 12 件 | [benchmark.md](web-features/benchmark.md) |
| チャット | chat | 41 | 「回答をコピー済み / 回答をコピー」を実行するボタン。<br>「この候補で質問する」を実行するボタン。<br>「自分で入力」を実行するボタン。<br>「追加質問候補」を実行するボタン。 ほか 36 件 | [chat.md](web-features/chat.md) |
| デバッグ | debug | 11 | 「拡大デバッグパネルを閉じる」を実行するボタン。<br>「保存JSON」を実行するボタン。<br>「可視化JSON」を実行するボタン。<br>「JSONをアップロード」に紐づく入力ラベル。 ほか 3 件 | [debug.md](web-features/debug.md) |
| ドキュメント | documents | 145 | 「前の画面へ戻る」を実行するボタン。<br>「フォルダ設定を閉じる」を実行するボタン。<br>「ファイル名: / 現在の権限: / 継承: / 共有先種別 / ユーザー / グループ / 共有先識別子（管理者向け） / 権限 / 権限なし / 閲覧のみ / 管理可能 / 理由 / 保存」を入力・送信するフォーム。<br>「削除」を実行するボタン。 ほか 112 件 | [documents.md](web-features/documents.md) |
| favorites | favorites | 1 | 「チャットへ戻る」を実行するボタン。 | [favorites.md](web-features/favorites.md) |
| 履歴 | history | 11 | 「チャットへ戻る」を実行するボタン。<br>「履歴を検索」を入力または選択する項目。<br>「履歴の並び順」を選ぶ選択項目。<br>「新しい順」を表す option 要素。 ほか 5 件 | [history.md](web-features/history.md) |
| 担当者対応 | questions | 21 | 「チャットへ戻る」を実行するボタン。<br>「ステータス / すべて」に紐づく入力ラベル。<br>「すべて」を選ぶ選択項目。<br>「すべて」を表す option 要素。 ほか 16 件 | [questions.md](web-features/questions.md) |
| 共通 | shared | 11 | 「キャンセル」を表す Button 要素。<br>「label」を実行するボタン。<br>「処理中」を実行するボタン。<br>「戻る」を実行するボタン。 ほか 1 件 | [shared.md](web-features/shared.md) |

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
| アプリケーション枠 | RailNav | AccountButton | 未推定 | AccountButton 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/app/components/RailNav.tsx:116 |
| アプリケーション枠 | DestinationButtons | button | destination.label | 「destination.label」を実行するボタン。 | 状態: aria-current=activeView === destination.view ? "page" : undefined | apps/web/src/app/components/RailNav.tsx:138 |
| アプリケーション枠 | AccountButton | button | 個人設定 | 「個人設定」を実行するボタン。 | 状態: aria-current=active ? "page" : undefined | apps/web/src/app/components/RailNav.tsx:165 |
| アプリケーション枠 | TopBar | label | デバッグモード | 「デバッグモード」に紐づく入力ラベル。 | - | apps/web/src/app/components/TopBar.tsx:18 |
| アプリケーション枠 | TopBar | input | デバッグモード | 「デバッグモード」を入力または選択する項目。 | - | apps/web/src/app/components/TopBar.tsx:20 |
| アプリケーション枠 | TopBar | button | 新しい会話 | 「新しい会話」を実行するボタン。 | - | apps/web/src/app/components/TopBar.tsx:24 |
| 管理 | AdminPanelDataStatus | button | `${label}を更新` | 「`${label}を更新`」を実行するボタン。 | 状態: disabled=loading \|\| isBusy | apps/web/src/features/admin/components/AdminPanelDataStatus.tsx:39 |
| 管理 | AdminWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | apps/web/src/features/admin/components/AdminWorkspace.tsx:216 |
| 管理 | AdminWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-current=resolvedActiveSection === section.id ? "page" : undefined | apps/web/src/features/admin/components/AdminWorkspace.tsx:229 |
| 管理 | AdminAuditPanel | form | 管理操作履歴を絞り込む | 「管理操作履歴を絞り込む」を入力・送信するフォーム。 | role: search | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:62 |
| 管理 | AdminAuditPanel | label | 対象・実行者を検索 | 「対象・実行者を検索」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:63 |
| 管理 | AdminAuditPanel | input | 対象・実行者を検索 | 「対象・実行者を検索」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:65 |
| 管理 | AdminAuditPanel | label | 操作 / すべて | 「操作 / すべて」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:67 |
| 管理 | AdminAuditPanel | select | すべて | 「すべて」を選ぶ選択項目。 | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:69 |
| 管理 | AdminAuditPanel | option | すべて | 「すべて」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:77 |
| 管理 | AdminAuditPanel | option | 操作 / すべて | 「操作 / すべて」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:78 |
| 管理 | AdminAuditPanel | button | 検索 | 「検索」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:81 |
| 管理 | AdminAuditPanel | button | 条件を解除 | 「条件を解除」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:83 |
| 管理 | AdminAuditPanel | form | 現在の監査条件を export | 「現在の監査条件を export」を入力・送信するフォーム。 | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:90 |
| 管理 | AdminAuditPanel | label | export 理由（必須） | 「export 理由（必須）」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:104 |
| 管理 | AdminAuditPanel | input | export 理由（必須） | 「export 理由（必須）」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:104 |
| 管理 | AdminAuditPanel | button | 現在の条件を export | 「現在の条件を export」を実行するボタン。 | 状態: disabled=loading \|\| exportReason.trim().length === 0 | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:105 |
| 管理 | AdminAuditPanel | a | 有効期限内に取得 | 「有効期限内に取得」へ移動するリンク。 | - | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:110 |
| 管理 | AdminAuditPanel | button | 次の履歴を読み込む（残り / 件） | 「次の履歴を読み込む（残り / 件）」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx:140 |
| 管理 | AdminCostPanel | UsageQueryForm | 未推定 | UsageQueryForm 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:30 |
| 管理 | AdminCostPanel | form | 現在のコスト条件を export | 「現在のコスト条件を export」を入力・送信するフォーム。 | - | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:38 |
| 管理 | AdminCostPanel | label | export 理由（必須） | 「export 理由（必須）」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:43 |
| 管理 | AdminCostPanel | input | export 理由（必須） | 「export 理由（必須）」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:43 |
| 管理 | AdminCostPanel | button | 同じ条件の全ページを export | 「同じ条件の全ページを export」を実行するボタン。 | 状態: disabled=loading \|\| !exportReason.trim() | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:44 |
| 管理 | AdminCostPanel | a | 有効期限内に取得 | 「有効期限内に取得」へ移動するリンク。 | - | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:47 |
| 管理 | AdminCostPanel | button | 次の cost item を読み込む | 「次の cost item を読み込む」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminCostPanel.tsx:56 |
| 管理 | AdminOverviewGrid | button | `${card.label}を開く` | 「`${card.label}を開く`」を実行するボタン。 | - | apps/web/src/features/admin/components/panels/AdminOverviewGrid.tsx:205 |
| 管理 | AdminOverviewGrid | button | `${card.label}を開く` | 「`${card.label}を開く`」を実行するボタン。 | - | apps/web/src/features/admin/components/panels/AdminOverviewGrid.tsx:212 |
| 管理 | AdminRolePanel | summary | 権限 ID / 件を表示 | 「権限 ID / 件を表示」の詳細を開閉する要素。 | - | apps/web/src/features/admin/components/panels/AdminRolePanel.tsx:55 |
| 管理 | AdminUsagePanel | UsageQueryForm | 未推定 | UsageQueryForm 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:53 |
| 管理 | AdminUsagePanel | form | 現在の利用状況条件を export | 「現在の利用状況条件を export」を入力・送信するフォーム。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:56 |
| 管理 | AdminUsagePanel | label | export 理由（必須） | 「export 理由（必須）」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:57 |
| 管理 | AdminUsagePanel | input | export 理由（必須） | 「export 理由（必須）」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:57 |
| 管理 | AdminUsagePanel | button | 同じ条件の全ページを export | 「同じ条件の全ページを export」を実行するボタン。 | 状態: disabled=loading \|\| !exportReason.trim() | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:58 |
| 管理 | AdminUsagePanel | a | 有効期限内に取得 | 「有効期限内に取得」へ移動するリンク。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:61 |
| 管理 | AdminUsagePanel | button | 次の usage event を読み込む | 「次の usage event を読み込む」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:78 |
| 管理 | UsageQueryForm | form | 利用量とコストを絞り込む | 「利用量とコストを絞り込む」を入力・送信するフォーム。 | role: search | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:84 |
| 管理 | UsageQueryForm | label | 期間開始（ISO 8601） | 「期間開始（ISO 8601）」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:85 |
| 管理 | UsageQueryForm | input | 期間開始（ISO 8601） | 「期間開始（ISO 8601）」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:85 |
| 管理 | UsageQueryForm | label | 期間終了（ISO 8601・含まない） | 「期間終了（ISO 8601・含まない）」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:86 |
| 管理 | UsageQueryForm | input | 期間終了（ISO 8601・含まない） | 「期間終了（ISO 8601・含まない）」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:86 |
| 管理 | UsageQueryForm | label | subject | 「subject」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:87 |
| 管理 | UsageQueryForm | input | subject | 「subject」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:87 |
| 管理 | UsageQueryForm | label | run | 「run」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:88 |
| 管理 | UsageQueryForm | input | run | 「run」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:88 |
| 管理 | UsageQueryForm | label | model | 「model」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:89 |
| 管理 | UsageQueryForm | input | model | 「model」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:89 |
| 管理 | UsageQueryForm | label | feature | 「feature」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:90 |
| 管理 | UsageQueryForm | input | feature | 「feature」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:90 |
| 管理 | UsageQueryForm | label | provider | 「provider」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:91 |
| 管理 | UsageQueryForm | input | provider | 「provider」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:91 |
| 管理 | UsageQueryForm | button | 条件を適用 | 「条件を適用」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx:92 |
| 管理 | AdminUserPanel | form | 管理対象ユーザーを絞り込む | 「管理対象ユーザーを絞り込む」を入力・送信するフォーム。 | role: search | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:84 |
| 管理 | AdminUserPanel | label | ユーザー・ロールを検索 | 「ユーザー・ロールを検索」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:88 |
| 管理 | AdminUserPanel | input | ユーザー・ロールを検索 | 「ユーザー・ロールを検索」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:88 |
| 管理 | AdminUserPanel | label | 状態 / すべて / 有効 / 停止中 | 「状態 / すべて / 有効 / 停止中」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:89 |
| 管理 | AdminUserPanel | select | すべて / 有効 / 停止中 | 「すべて / 有効 / 停止中」を選ぶ選択項目。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:89 |
| 管理 | AdminUserPanel | option | すべて | 「すべて」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:90 |
| 管理 | AdminUserPanel | option | 有効 | 「有効」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:90 |
| 管理 | AdminUserPanel | option | 停止中 | 「停止中」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:90 |
| 管理 | AdminUserPanel | label | 並び順 / メール昇順 / 更新日時の新しい順 | 「並び順 / メール昇順 / 更新日時の新しい順」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:92 |
| 管理 | AdminUserPanel | select | メール昇順 / 更新日時の新しい順 | 「メール昇順 / 更新日時の新しい順」を選ぶ選択項目。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:92 |
| 管理 | AdminUserPanel | option | メール昇順 | 「メール昇順」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:93 |
| 管理 | AdminUserPanel | option | 更新日時の新しい順 | 「更新日時の新しい順」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:93 |
| 管理 | AdminUserPanel | button | 検索 | 「検索」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:95 |
| 管理 | AdminUserPanel | AdminCreateUserForm | 未推定 | AdminCreateUserForm 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:98 |
| 管理 | AdminUserPanel | button | 次のユーザーを読み込む（残り / 人） | 「次のユーザーを読み込む（残り / 人）」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:143 |
| 管理 | AdminCreateUserForm | form | 管理対象ユーザー作成 | 「管理対象ユーザー作成」を入力・送信するフォーム。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:189 |
| 管理 | AdminCreateUserForm | label | メール | 「メール」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:190 |
| 管理 | AdminCreateUserForm | input | new-user@example.com | 「new-user@example.com」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:192 |
| 管理 | AdminCreateUserForm | label | 表示名 | 「表示名」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:194 |
| 管理 | AdminCreateUserForm | input | 任意 | 「任意」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:196 |
| 管理 | AdminCreateUserForm | label | 初期ロール | 「初期ロール」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:198 |
| 管理 | AdminCreateUserForm | select | 初期ロール | 「初期ロール」を選ぶ選択項目。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:205 |
| 管理 | AdminCreateUserForm | option | ( / ) | 「( / )」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:207 |
| 管理 | AdminCreateUserForm | button | 作成 | 「作成」を実行するボタン。 | 状態: disabled=loading \|\| email.trim().length === 0 | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:212 |
| 管理 | ManagedUserRow | label | 未推定 | label 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:330 |
| 管理 | ManagedUserRow | input | 未推定 | input 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:331 |
| 管理 | ManagedUserRow | label | 変更理由（必須） | 「変更理由（必須）」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:344 |
| 管理 | ManagedUserRow | textarea | `${user.email}のロール変更理由` | 「`${user.email}のロール変更理由`」を複数行で入力する項目。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:346 |
| 管理 | ManagedUserRow | button | `${user.email}のロール変更を確認` | 「`${user.email}のロール変更を確認`」を実行するボタン。 | 状態: disabled=loading \|\| !roleChanged \|\| nextGroups.length === 0 \|\| roleReason.trim().length === 0 | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:355 |
| 管理 | ManagedUserRow | button | `${user.email}の利用を再開` | 「`${user.email}の利用を再開`」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:376 |
| 管理 | ManagedUserRow | button | `${user.email}の利用を停止` | 「`${user.email}の利用を停止`」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:381 |
| 管理 | ManagedUserRow | button | `${user.email}を削除` | 「`${user.email}を削除`」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:386 |
| 管理 | ManagedUserRow | label | 後継管理者 | 「後継管理者」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:434 |
| 管理 | ManagedUserRow | select | `${user.email}の後継管理者` | 「`${user.email}の後継管理者`」を選ぶ選択項目。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:436 |
| 管理 | ManagedUserRow | option | 選択してください | 「選択してください」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:444 |
| 管理 | ManagedUserRow | option | candidate.userId | 「candidate.userId」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AdminUserPanel.tsx:446 |
| 管理 | AliasAdminPanel | button | 承認済み用語展開を公開 | 「承認済み用語展開を公開」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:129 |
| 管理 | AliasAdminPanel | form | 用語展開を絞り込む | 「用語展開を絞り込む」を入力・送信するフォーム。 | role: search | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:138 |
| 管理 | AliasAdminPanel | label | 用語・展開語を検索 | 「用語・展開語を検索」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:139 |
| 管理 | AliasAdminPanel | input | 用語・展開語を検索 | 「用語・展開語を検索」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:141 |
| 管理 | AliasAdminPanel | label | 状態 / すべて / 下書き / 承認済み / 無効 | 「状態 / すべて / 下書き / 承認済み / 無効」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:143 |
| 管理 | AliasAdminPanel | select | すべて / 下書き / 承認済み / 無効 | 「すべて / 下書き / 承認済み / 無効」を選ぶ選択項目。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:145 |
| 管理 | AliasAdminPanel | option | すべて | 「すべて」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:151 |
| 管理 | AliasAdminPanel | option | 下書き | 「下書き」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:152 |
| 管理 | AliasAdminPanel | option | 承認済み | 「承認済み」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:153 |
| 管理 | AliasAdminPanel | option | 無効 | 「無効」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:154 |
| 管理 | AliasAdminPanel | label | 並び順 / 更新が新しい順 / 用語順 | 「並び順 / 更新が新しい順 / 用語順」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:157 |
| 管理 | AliasAdminPanel | select | 更新が新しい順 / 用語順 | 「更新が新しい順 / 用語順」を選ぶ選択項目。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:159 |
| 管理 | AliasAdminPanel | option | 更新が新しい順 | 「更新が新しい順」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:165 |
| 管理 | AliasAdminPanel | option | 用語順 | 「用語順」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:166 |
| 管理 | AliasAdminPanel | button | 検索 | 「検索」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:169 |
| 管理 | AliasAdminPanel | button | 条件を解除 | 「条件を解除」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:171 |
| 管理 | AliasAdminPanel | form | 用語 / 展開語（カンマまたは改行区切り） / 適用部署（任意） / 下書きを追加 | 「用語 / 展開語（カンマまたは改行区切り） / 適用部署（任意） / 下書きを追加」を入力・送信するフォーム。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:185 |
| 管理 | AliasAdminPanel | label | 用語 | 「用語」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:186 |
| 管理 | AliasAdminPanel | input | 用語 | 「用語」を入力または選択する項目。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:188 |
| 管理 | AliasAdminPanel | label | 展開語（カンマまたは改行区切り） | 「展開語（カンマまたは改行区切り）」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:190 |
| 管理 | AliasAdminPanel | textarea | 展開語（カンマまたは改行区切り） | 「展開語（カンマまたは改行区切り）」を複数行で入力する項目。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:192 |
| 管理 | AliasAdminPanel | label | 適用部署（任意） | 「適用部署（任意）」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:194 |
| 管理 | AliasAdminPanel | input | 適用部署（任意） | 「適用部署（任意）」を入力または選択する項目。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:196 |
| 管理 | AliasAdminPanel | button | 下書きを追加 | 「下書きを追加」を実行するボタン。 | 状態: disabled=loading \|\| !term.trim() \|\| parseExpansionList(expansions).length === 0 | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:198 |
| 管理 | AliasAdminPanel | button | 全件表示へ戻す / 絞り込む | 「全件表示へ戻す / 絞り込む」を実行するボタン。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:225 |
| 管理 | AliasAdminPanel | button | `${alias.term}を編集` | 「`${alias.term}を編集`」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:233 |
| 管理 | AliasAdminPanel | button | `${alias.term}を承認` | 「`${alias.term}を承認`」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:237 |
| 管理 | AliasAdminPanel | button | `${alias.term}を差し戻し` | 「`${alias.term}を差し戻し`」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:238 |
| 管理 | AliasAdminPanel | button | `${alias.term}を下書きへ戻す` | 「`${alias.term}を下書きへ戻す`」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:242 |
| 管理 | AliasAdminPanel | button | `${alias.term}を無効化` | 「`${alias.term}を無効化`」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:245 |
| 管理 | AliasAdminPanel | button | 次の用語展開を読み込む（残り / 件） | 「次の用語展開を読み込む（残り / 件）」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:253 |
| 管理 | AliasAdminPanel | label | 監査操作 / すべて / 作成 / 更新 / レビュー / 状態遷移 / 無効化 / 公開 | 「監査操作 / すべて / 作成 / 更新 / レビュー / 状態遷移 / 無効化 / 公開」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:263 |
| 管理 | AliasAdminPanel | select | すべて / 作成 / 更新 / レビュー / 状態遷移 / 無効化 / 公開 | 「すべて / 作成 / 更新 / レビュー / 状態遷移 / 無効化 / 公開」を選ぶ選択項目。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:265 |
| 管理 | AliasAdminPanel | option | すべて | 「すべて」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:270 |
| 管理 | AliasAdminPanel | option | 作成 | 「作成」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:271 |
| 管理 | AliasAdminPanel | option | 更新 | 「更新」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:272 |
| 管理 | AliasAdminPanel | option | レビュー | 「レビュー」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:273 |
| 管理 | AliasAdminPanel | option | 状態遷移 | 「状態遷移」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:274 |
| 管理 | AliasAdminPanel | option | 無効化 | 「無効化」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:275 |
| 管理 | AliasAdminPanel | option | 公開 | 「公開」を表す option 要素。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:276 |
| 管理 | AliasAdminPanel | button | 次の監査ログを読み込む（残り / 件） | 「次の監査ログを読み込む（残り / 件）」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:306 |
| 管理 | AliasAdminPanel | label | 用語 | 「用語」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:381 |
| 管理 | AliasAdminPanel | input | 用語 | 「用語」を入力または選択する項目。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:381 |
| 管理 | AliasAdminPanel | label | 展開語 | 「展開語」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:382 |
| 管理 | AliasAdminPanel | textarea | 展開語 | 「展開語」を複数行で入力する項目。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:382 |
| 管理 | ReasonField | label | 実行理由（必須） | 「実行理由（必須）」に紐づく入力ラベル。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:425 |
| 管理 | ReasonField | textarea | 実行理由（必須） | 「実行理由（必須）」を複数行で入力する項目。 | - | apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx:427 |
| agents | AsyncAgentWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | apps/web/src/features/agents/components/AsyncAgentWorkspace.tsx:40 |
| agents | AsyncAgentWorkspace | button | 非同期エージェント情報を更新 | 「非同期エージェント情報を更新」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/agents/components/AsyncAgentWorkspace.tsx:54 |
| agents | AsyncAgentWorkspace | button | `${providerDisplayName(run)}の非同期実行（${formatDateTime(run.updatedAt)}、識別子: ${run.agentRunId… | 「`${providerDisplayName(run)}の非同期実行（${formatDateTime(run.updatedAt)}、識別子: ${run.agentRunId…」を実行するボタン。 | 状態: aria-current=selectedRun?.agentRunId === run.agentRunId ? "true" : undefined | apps/web/src/features/agents/components/AsyncAgentWorkspace.tsx:91 |
| agents | AsyncAgentWorkspace | button | キャンセル | 「キャンセル」を実行するボタン。 | 状態: disabled=!canCancel \|\| !["queued", "preparing_workspace", "running", "waiting_for_approval"].inclu… | apps/web/src/features/agents/components/AsyncAgentWorkspace.tsx:124 |
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
| 性能テスト | BenchmarkWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:97 |
| 性能テスト | BenchmarkWorkspace | label | テスト種別 | 「テスト種別」に紐づく入力ラベル。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:130 |
| 性能テスト | BenchmarkWorkspace | select | テスト種別 | 「テスト種別」を選ぶ選択項目。 | 状態: disabled=!hasSuites \|\| !hasSuitesResult | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:132 |
| 性能テスト | BenchmarkWorkspace | option | テスト設定を取得できません | 「テスト設定を取得できません」を表す option 要素。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:133 |
| 性能テスト | BenchmarkWorkspace | option | テスト種別 | 「テスト種別」を表す option 要素。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:135 |
| 性能テスト | BenchmarkWorkspace | label | データセット | 「データセット」に紐づく入力ラベル。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:151 |
| 性能テスト | BenchmarkWorkspace | input | データセット | 「データセット」を入力または選択する項目。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:153 |
| 性能テスト | BenchmarkWorkspace | label | モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku | 「モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku」に紐づく入力ラベル。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:155 |
| 性能テスト | BenchmarkWorkspace | select | Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku | 「Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku」を選ぶ選択項目。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:157 |
| 性能テスト | BenchmarkWorkspace | option | Nova Lite v1 | 「Nova Lite v1」を表す option 要素。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:158 |
| 性能テスト | BenchmarkWorkspace | option | Claude 3.5 Sonnet | 「Claude 3.5 Sonnet」を表す option 要素。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:159 |
| 性能テスト | BenchmarkWorkspace | option | Claude 3 Haiku | 「Claude 3 Haiku」を表す option 要素。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:160 |
| 性能テスト | BenchmarkWorkspace | label | 並列数 | 「並列数」に紐づく入力ラベル。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:163 |
| 性能テスト | BenchmarkWorkspace | input | 並列数 | 「並列数」を入力または選択する項目。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:165 |
| 性能テスト | BenchmarkWorkspace | button | 性能テストを実行 | 「性能テストを実行」を実行するボタン。 | 状態: disabled=loading \|\| !canRun \|\| !selectedSuite \|\| !hasSuitesResult | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:174 |
| 性能テスト | BenchmarkWorkspace | button | 更新 | 「更新」を実行するボタン。 | 状態: disabled=loading | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:178 |
| 性能テスト | BenchmarkWorkspace | button | `${artifact.description}をダウンロード` | 「`${artifact.description}をダウンロード`」を実行するボタン。 | 状態: disabled=!canDownload \|\| !canDownloadArtifact(run, artifact.kind) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:235 |
| 性能テスト | BenchmarkWorkspace | button | `${run.runId}のジョブをキャンセル` | 「`${run.runId}のジョブをキャンセル`」を実行するボタン。 | 状態: disabled=!canCancel \|\| loading \|\| !["queued", "running"].includes(run.status) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:247 |
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
| チャット | QuestionAnswerPanel | button | 解決した | 「解決した」を実行するボタン。 | 状態: disabled=loading \|\| question.status === "resolved" | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx:67 |
| チャット | QuestionAnswerPanel | button | 追加で質問する | 「追加で質問する」を実行するボタン。 | - | apps/web/src/features/chat/components/QuestionAnswerPanel.tsx:71 |
| チャット | QuestionEscalationPanel | form | 担当者へ質問 | 「担当者へ質問」を入力・送信するフォーム。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:86 |
| チャット | QuestionEscalationPanel | label | 件名 | 「件名」に紐づく入力ラベル。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:94 |
| チャット | QuestionEscalationPanel | input | 件名 | 「件名」を入力または選択する項目。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:96 |
| チャット | QuestionEscalationPanel | label | 質問内容 | 「質問内容」に紐づく入力ラベル。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:98 |
| チャット | QuestionEscalationPanel | textarea | 質問内容 | 「質問内容」を複数行で入力する項目。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:100 |
| チャット | QuestionEscalationPanel | label | カテゴリ / その他の質問 / 手続き / 社内制度 / 資料確認 | 「カテゴリ / その他の質問 / 手続き / 社内制度 / 資料確認」に紐づく入力ラベル。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:103 |
| チャット | QuestionEscalationPanel | select | その他の質問 / 手続き / 社内制度 / 資料確認 | 「その他の質問 / 手続き / 社内制度 / 資料確認」を選ぶ選択項目。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:105 |
| チャット | QuestionEscalationPanel | option | その他の質問 | 「その他の質問」を表す option 要素。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:106 |
| チャット | QuestionEscalationPanel | option | 手続き | 「手続き」を表す option 要素。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:107 |
| チャット | QuestionEscalationPanel | option | 社内制度 | 「社内制度」を表す option 要素。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:108 |
| チャット | QuestionEscalationPanel | option | 資料確認 | 「資料確認」を表す option 要素。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:109 |
| チャット | QuestionEscalationPanel | label | 優先度 / 通常 / 高 / 緊急 | 「優先度 / 通常 / 高 / 緊急」に紐づく入力ラベル。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:112 |
| チャット | QuestionEscalationPanel | select | 通常 / 高 / 緊急 | 「通常 / 高 / 緊急」を選ぶ選択項目。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:114 |
| チャット | QuestionEscalationPanel | option | 通常 | 「通常」を表す option 要素。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:115 |
| チャット | QuestionEscalationPanel | option | 高 | 「高」を表す option 要素。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:116 |
| チャット | QuestionEscalationPanel | option | 緊急 | 「緊急」を表す option 要素。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:117 |
| チャット | QuestionEscalationPanel | label | 担当部署 | 「担当部署」に紐づく入力ラベル。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:121 |
| チャット | QuestionEscalationPanel | input | 担当部署を入力 | 「担当部署を入力」を入力または選択する項目。 | - | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:123 |
| チャット | QuestionEscalationPanel | button | 担当者へ送信 | 「担当者へ送信」を実行するボタン。 | 状態: disabled=loading \|\| !title.trim() \|\| !body.trim() | apps/web/src/features/chat/components/QuestionEscalationPanel.tsx:127 |
| チャット | UserPromptBubble | button | プロンプトをコピー済み / プロンプトをコピー | 「プロンプトをコピー済み / プロンプトをコピー」を実行するボタン。 | 状態: disabled=!canCopyPrompt | apps/web/src/features/chat/components/UserPromptBubble.tsx:47 |
| デバッグ | DebugExpandedDialog | button | 拡大デバッグパネルを閉じる | 「拡大デバッグパネルを閉じる」を実行するボタン。 | - | apps/web/src/features/debug/components/panel/DebugExpandedDialog.tsx:32 |
| デバッグ | DebugPanelBody | DebugFlowNodeButton | 未推定 | DebugFlowNodeButton 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/debug/components/panel/DebugPanelBody.tsx:59 |
| デバッグ | DebugFlowNodeButton | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-pressed=selected | apps/web/src/features/debug/components/panel/DebugPanelBody.tsx:152 |
| デバッグ | DebugStepList | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-expanded=expandedStep | apps/web/src/features/debug/components/panel/DebugPanelBody.tsx:226 |
| デバッグ | DebugPanelHeader | button | 保存JSON | 「保存JSON」を実行するボタン。 | 状態: disabled=!activeTrace \|\| pending \|\| Boolean(replayEnvelope) | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:39 |
| デバッグ | DebugPanelHeader | button | 可視化JSON | 「可視化JSON」を実行するボタン。 | 状態: disabled=!envelope \|\| pending | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:43 |
| デバッグ | DebugPanelHeader | label | JSONをアップロード | 「JSONをアップロード」に紐づく入力ラベル。 | - | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:47 |
| デバッグ | DebugPanelHeader | input | JSONをアップロード | 「JSONをアップロード」を入力または選択する項目。 | - | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:50 |
| デバッグ | DebugPanelHeader | button | 解除 | 「解除」を実行するボタン。 | - | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:53 |
| デバッグ | DebugPanelHeader | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-expanded=allExpanded | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:58 |
| デバッグ | DebugPanelHeader | button | デバッグパネルを拡大表示 | 「デバッグパネルを拡大表示」を実行するボタン。 | - | apps/web/src/features/debug/components/panel/DebugPanelHeader.tsx:60 |
| ドキュメント | DocumentWorkspace | button | 前の画面へ戻る | 「前の画面へ戻る」を実行するボタン。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1006 |
| ドキュメント | DocumentWorkspace | button | フォルダ設定を閉じる | 「フォルダ設定を閉じる」を実行するボタン。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1193 |
| ドキュメント | DocumentWorkspace | form | ファイル名: / 現在の権限: / 継承: / 共有先種別 / ユーザー / グループ / 共有先識別子（管理者向け） / 権限 / 権限なし / 閲覧のみ / 管理可能 / 理由 / 保存 | 「ファイル名: / 現在の権限: / 継承: / 共有先種別 / ユーザー / グループ / 共有先識別子（管理者向け） / 権限 / 権限なし / 閲覧のみ / 管理可能 / 理由 / 保存」を入力・送信するフォーム。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1297 |
| ドキュメント | DocumentWorkspace | button | 削除 | 「削除」を実行するボタン。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1312 |
| ドキュメント | DocumentWorkspace | label | 共有先種別 / ユーザー / グループ | 「共有先種別 / ユーザー / グループ」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1321 |
| ドキュメント | DocumentWorkspace | select | ユーザー / グループ | 「ユーザー / グループ」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1323 |
| ドキュメント | DocumentWorkspace | option | ユーザー | 「ユーザー」を表す option 要素。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1324 |
| ドキュメント | DocumentWorkspace | option | グループ | 「グループ」を表す option 要素。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1325 |
| ドキュメント | DocumentWorkspace | label | 共有先識別子（管理者向け） | 「共有先識別子（管理者向け）」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1328 |
| ドキュメント | DocumentWorkspace | input | 共有先識別子（管理者向け） | 「共有先識別子（管理者向け）」を入力または選択する項目。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1328 |
| ドキュメント | DocumentWorkspace | label | 権限 / 権限なし / 閲覧のみ / 管理可能 | 「権限 / 権限なし / 閲覧のみ / 管理可能」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1329 |
| ドキュメント | DocumentWorkspace | select | 権限なし / 閲覧のみ / 管理可能 | 「権限なし / 閲覧のみ / 管理可能」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1331 |
| ドキュメント | DocumentWorkspace | option | 権限なし | 「権限なし」を表す option 要素。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1332 |
| ドキュメント | DocumentWorkspace | option | 閲覧のみ | 「閲覧のみ」を表す option 要素。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1333 |
| ドキュメント | DocumentWorkspace | option | 管理可能 | 「管理可能」を表す option 要素。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1334 |
| ドキュメント | DocumentWorkspace | label | 理由 | 「理由」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1337 |
| ドキュメント | DocumentWorkspace | textarea | 理由 | 「理由」を複数行で入力する項目。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1337 |
| ドキュメント | DocumentWorkspace | button | 保存 | 「保存」を実行するボタン。 | 状態: disabled=documentShareLoading \|\| documentShareInfo === null \|\| !documentShareReason.trim() \|\| oper… | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1338 |
| ドキュメント | DocumentWorkspace | form | ファイル名: / 移動先フォルダ / 選択してください / 移動後の表示名 / 直接共有は維持され、継承共有は移動先フォルダの設定に変わります。 / 理由 / 移動 | 「ファイル名: / 移動先フォルダ / 選択してください / 移動後の表示名 / 直接共有は維持され、継承共有は移動先フォルダの設定に変わります。 / 理由 / 移動」を入力・送信するフォーム。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1344 |
| ドキュメント | DocumentWorkspace | label | 移動先フォルダ / 選択してください | 「移動先フォルダ / 選択してください」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1346 |
| ドキュメント | DocumentWorkspace | select | 選択してください | 「選択してください」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1348 |
| ドキュメント | DocumentWorkspace | option | 選択してください | 「選択してください」を表す option 要素。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1349 |
| ドキュメント | DocumentWorkspace | option | 移動先フォルダ / 選択してください | 「移動先フォルダ / 選択してください」を表す option 要素。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1351 |
| ドキュメント | DocumentWorkspace | label | 移動後の表示名 | 「移動後の表示名」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1355 |
| ドキュメント | DocumentWorkspace | input | 移動後の表示名 | 「移動後の表示名」を入力または選択する項目。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1355 |
| ドキュメント | DocumentWorkspace | label | 理由 | 「理由」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1358 |
| ドキュメント | DocumentWorkspace | textarea | 理由 | 「理由」を複数行で入力する項目。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1358 |
| ドキュメント | DocumentWorkspace | button | 移動 | 「移動」を実行するボタン。 | 状態: disabled=!documentMoveDestinationId \|\| documentMoveNameConflict \|\| !documentMoveReason.trim() \|\| o… | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1359 |
| ドキュメント | WorkspaceModal | button | `${title}を閉じる` | 「`${title}を閉じる`」を実行するボタン。 | - | apps/web/src/features/documents/components/DocumentWorkspace.tsx:1467 |
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
| ドキュメント | DocumentConfirmDialog | label | 削除理由 | 「削除理由」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentConfirmDialog.tsx:42 |
| ドキュメント | DocumentConfirmDialog | textarea | 削除理由 | 「削除理由」を複数行で入力する項目。 | 状態: disabled=loading | apps/web/src/features/documents/components/workspace/DocumentConfirmDialog.tsx:44 |
| ドキュメント | DocumentDetailDrawer | button | 文書詳細を閉じる | 「文書詳細を閉じる」を実行するボタン。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:129 |
| ドキュメント | DocumentDetailDrawer | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-expanded=technicalExpanded, aria-controls=technicalRegionId | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:147 |
| ドキュメント | DocumentDetailDrawer | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:172 |
| ドキュメント | DocumentDetailDrawer | button | この資料に質問する | 「この資料に質問する」を実行するボタン。 | 状態: disabled=!onAskDocument | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:181 |
| ドキュメント | DocumentDetailDrawer | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=isDownloading | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:185 |
| ドキュメント | DocumentDetailDrawer | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-expanded=managementExpanded, aria-controls=managementRegionId | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:193 |
| ドキュメント | DocumentDetailDrawer | button | 共有 | 「共有」を実行するボタン。 | 状態: disabled=shareBusy | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:205 |
| ドキュメント | DocumentDetailDrawer | button | 移動 | 「移動」を実行するボタン。 | 状態: disabled=moveBusy | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:206 |
| ドキュメント | DocumentDetailDrawer | button | 再インデックス | 「再インデックス」を実行するボタン。 | 状態: disabled=reindexBusy | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:210 |
| ドキュメント | DocumentDetailDrawer | button | 削除 | 「削除」を実行するボタン。 | 状態: disabled=deleteBusy | apps/web/src/features/documents/components/workspace/DocumentDetailDrawer.tsx:214 |
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
| ドキュメント | DocumentDetailPanel | textarea | 共有設定を変更する理由 | 「共有設定を変更する理由」を複数行で入力する項目。 | 状態: disabled=!canShareGroups \|\| folderShareLoading \|\| !folderSharePolicyVersion \|\| operationState.shar… | apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx:285 |
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
| ドキュメント | DocumentFilePanel | button | ドキュメントを追加 | 「ドキュメントを追加」を実行するボタン。 | 説明参照: addDocumentDisabledReason ? "document-add-disabled-reason" : undefined<br>状態: disabled=!canOpenDocumentAdd | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:140 |
| ドキュメント | DocumentFilePanel | button | フォルダ設定を開く | 「フォルダ設定を開く」を実行するボタン。 | 状態: disabled=(!canShareGroups && !canMoveGroups && !canCreateGroups && !canWrite) \|\| operationState.sh… | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:151 |
| ドキュメント | DocumentFilePanel | button | 絞り込みをリセット | 「絞り込みをリセット」を実行するボタン。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:182 |
| ドキュメント | DocumentFilePanel | label | ファイル名検索 | 「ファイル名検索」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:187 |
| ドキュメント | DocumentFilePanel | input | ファイル名 | 「ファイル名」を入力または選択する項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:189 |
| ドキュメント | DocumentFilePanel | label | 種別 / すべて | 「種別 / すべて」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:191 |
| ドキュメント | DocumentFilePanel | select | すべて | 「すべて」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:193 |
| ドキュメント | DocumentFilePanel | option | すべて | 「すべて」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:194 |
| ドキュメント | DocumentFilePanel | option | 種別 / すべて | 「種別 / すべて」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:196 |
| ドキュメント | DocumentFilePanel | label | 状態 / すべて | 「状態 / すべて」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:200 |
| ドキュメント | DocumentFilePanel | select | すべて | 「すべて」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:202 |
| ドキュメント | DocumentFilePanel | option | すべて | 「すべて」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:203 |
| ドキュメント | DocumentFilePanel | option | 状態 / すべて | 「状態 / すべて」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:205 |
| ドキュメント | DocumentFilePanel | label | 所属フォルダ / すべて / 未設定 | 「所属フォルダ / すべて / 未設定」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:209 |
| ドキュメント | DocumentFilePanel | select | すべて / 未設定 | 「すべて / 未設定」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:211 |
| ドキュメント | DocumentFilePanel | option | すべて | 「すべて」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:212 |
| ドキュメント | DocumentFilePanel | option | 未設定 | 「未設定」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:213 |
| ドキュメント | DocumentFilePanel | option | 所属フォルダ / すべて / 未設定 | 「所属フォルダ / すべて / 未設定」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:215 |
| ドキュメント | DocumentFilePanel | label | 並び替え / 更新日 新しい順 / 更新日 古い順 / ファイル名順 / 種別順 | 「並び替え / 更新日 新しい順 / 更新日 古い順 / ファイル名順 / 種別順」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:219 |
| ドキュメント | DocumentFilePanel | select | 更新日 新しい順 / 更新日 古い順 / ファイル名順 / 種別順 | 「更新日 新しい順 / 更新日 古い順 / ファイル名順 / 種別順」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:221 |
| ドキュメント | DocumentFilePanel | option | 更新日 新しい順 | 「更新日 新しい順」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:222 |
| ドキュメント | DocumentFilePanel | option | 更新日 古い順 | 「更新日 古い順」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:223 |
| ドキュメント | DocumentFilePanel | option | ファイル名順 | 「ファイル名順」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:224 |
| ドキュメント | DocumentFilePanel | option | チャンク数順 | 「チャンク数順」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:225 |
| ドキュメント | DocumentFilePanel | option | 種別順 | 「種別順」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:226 |
| ドキュメント | DocumentFilePanel | button | ドキュメントを追加 | 「ドキュメントを追加」を実行するボタン。 | 状態: disabled=!canOpenDocumentAdd | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:259 |
| ドキュメント | DocumentFilePanel | button | 条件をクリア | 「条件をクリア」を実行するボタン。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:266 |
| ドキュメント | DocumentFilePanel | button | `${document.fileName}の詳細を表示` | 「`${document.fileName}の詳細を表示`」を実行するボタン。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:288 |
| ドキュメント | DocumentFilePanel | label | 表示件数 | 「表示件数」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:313 |
| ドキュメント | DocumentFilePanel | select | 表示件数 | 「表示件数」を選ぶ選択項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:315 |
| ドキュメント | DocumentFilePanel | option | 件 | 「件」を表す option 要素。 | - | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:317 |
| ドキュメント | DocumentFilePanel | button | 前のページ | 「前のページ」を実行するボタン。 | 状態: disabled=documentPage <= 1 \|\| filteredDocumentsCount === 0 | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:321 |
| ドキュメント | DocumentFilePanel | button | 次のページ | 「次のページ」を実行するボタン。 | 状態: disabled=documentPage >= documentPageCount \|\| filteredDocumentsCount === 0 | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:330 |
| ドキュメント | ReindexMigrationStrip | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.cutoverMigrationId === migration.migrationId \|\| migration.status !== "stag… | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:387 |
| ドキュメント | ReindexMigrationStrip | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=operationState.rollbackMigrationId === migration.migrationId \|\| migration.status !== "cut… | apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx:390 |
| ドキュメント | DocumentFolderTree | label | フォルダを検索 | 「フォルダを検索」に紐づく入力ラベル。 | - | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:27 |
| ドキュメント | DocumentFolderTree | input | フォルダを検索 | 「フォルダを検索」を入力または選択する項目。 | - | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:28 |
| ドキュメント | DocumentFolderTree | button | フォルダ検索をクリア | 「フォルダ検索をクリア」を実行するボタン。 | 状態: disabled=!folderSearch | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:36 |
| ドキュメント | DocumentFolderTree | button | すべてのドキュメント | 「すべてのドキュメント」を実行するボタン。 | 状態: aria-current=selectedFolderId === "all" ? "true" : undefined | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:41 |
| ドキュメント | DocumentFolderTree | button | `${folder.path} ${folder.count}件` | 「`${folder.path} ${folder.count}件`」を実行するボタン。 | 状態: aria-current=selectedFolder.id === folder.id ? "true" : undefined | apps/web/src/features/documents/components/workspace/DocumentFolderTree.tsx:58 |
| favorites | FavoritesWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | apps/web/src/features/favorites/components/FavoritesWorkspace.tsx:49 |
| 履歴 | HistoryWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:79 |
| 履歴 | HistoryWorkspace | input | 履歴を検索 | 「履歴を検索」を入力または選択する項目。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:103 |
| 履歴 | HistoryWorkspace | select | 履歴の並び順 | 「履歴の並び順」を選ぶ選択項目。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:110 |
| 履歴 | HistoryWorkspace | option | 新しい順 | 「新しい順」を表す option 要素。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:111 |
| 履歴 | HistoryWorkspace | option | 古い順 | 「古い順」を表す option 要素。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:112 |
| 履歴 | HistoryWorkspace | option | メッセージ数順 | 「メッセージ数順」を表す option 要素。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:113 |
| 履歴 | HistoryWorkspace | label | お気に入りのみ | 「お気に入りのみ」に紐づく入力ラベル。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:115 |
| 履歴 | HistoryWorkspace | input | お気に入りのみ | 「お気に入りのみ」を入力または選択する項目。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:116 |
| 履歴 | HistoryWorkspace | button | item.isFavorite ? `${item.title}をお気に入りから外す` : `${item.title}をお気に入りに追加` | 「item.isFavorite ? `${item.title}をお気に入りから外す` : `${item.title}をお気に入りに追加`」を実行するボタン。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:134 |
| 履歴 | HistoryWorkspace | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/features/history/components/HistoryWorkspace.tsx:143 |
| 履歴 | HistoryWorkspace | button | 削除 | 「削除」を実行するボタン。 | 状態: disabled=deleteFeedback?.status === "processing" | apps/web/src/features/history/components/HistoryWorkspace.tsx:162 |
| 担当者対応 | AssigneeWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:168 |
| 担当者対応 | AssigneeWorkspace | label | ステータス / すべて | 「ステータス / すべて」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:191 |
| 担当者対応 | AssigneeWorkspace | select | すべて | 「すべて」を選ぶ選択項目。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:193 |
| 担当者対応 | AssigneeWorkspace | option | すべて | 「すべて」を表す option 要素。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:194 |
| 担当者対応 | AssigneeWorkspace | option | ステータス / すべて | 「ステータス / すべて」を表す option 要素。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:196 |
| 担当者対応 | AssigneeWorkspace | label | 検索 | 「検索」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:200 |
| 担当者対応 | AssigneeWorkspace | input | タイトル・名前・部署で検索 | 「タイトル・名前・部署で検索」を入力または選択する項目。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:202 |
| 担当者対応 | AssigneeWorkspace | button | `${question.title}を選択` | 「`${question.title}を選択`」を実行するボタン。 | 状態: aria-pressed=selected?.questionId === question.questionId | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:228 |
| 担当者対応 | AssigneeWorkspace | form | 回答作成 / 回答タイトル / 回答内容 / 参照資料 / 関連リンク / 内部メモ / 質問者へ通知する / 入力を一時保持 / 回答を送信 | 「回答作成 / 回答タイトル / 回答内容 / 参照資料 / 関連リンク / 内部メモ / 質問者へ通知する / 入力を一時保持 / 回答を送信」を入力・送信するフォーム。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:278 |
| 担当者対応 | AssigneeWorkspace | label | 回答タイトル | 「回答タイトル」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:280 |
| 担当者対応 | AssigneeWorkspace | input | 回答タイトル | 「回答タイトル」を入力または選択する項目。 | 状態: disabled=!answerWritable \|\| loading | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:282 |
| 担当者対応 | AssigneeWorkspace | label | 回答内容 | 「回答内容」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:284 |
| 担当者対応 | AssigneeWorkspace | textarea | 回答内容 | 「回答内容」を複数行で入力する項目。 | 状態: disabled=!answerWritable \|\| loading | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:286 |
| 担当者対応 | AssigneeWorkspace | label | 参照資料 / 関連リンク | 「参照資料 / 関連リンク」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:288 |
| 担当者対応 | AssigneeWorkspace | input | 資料名、URL、またはナレッジリンク | 「資料名、URL、またはナレッジリンク」を入力または選択する項目。 | 状態: disabled=!answerWritable \|\| loading | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:290 |
| 担当者対応 | AssigneeWorkspace | label | 内部メモ | 「内部メモ」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:292 |
| 担当者対応 | AssigneeWorkspace | textarea | 内部メモ | 「内部メモ」を複数行で入力する項目。 | 状態: disabled=!answerWritable \|\| loading | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:294 |
| 担当者対応 | AssigneeWorkspace | label | 質問者へ通知する | 「質問者へ通知する」に紐づく入力ラベル。 | - | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:296 |
| 担当者対応 | AssigneeWorkspace | input | 質問者へ通知する | 「質問者へ通知する」を入力または選択する項目。 | 状態: disabled=!answerWritable \|\| loading | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:297 |
| 担当者対応 | AssigneeWorkspace | button | 入力を一時保持 | 「入力を一時保持」を実行するボタン。 | 状態: disabled=loading \|\| !answerWritable \|\| !isDirty | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:310 |
| 担当者対応 | AssigneeWorkspace | button | 回答を送信 | 「回答を送信」を実行するボタン。 | 状態: disabled=loading \|\| !answerWritable \|\| !answerTitle.trim() \|\| !answerBody.trim() | apps/web/src/features/questions/components/AssigneeWorkspace.tsx:311 |
| 共通 | ConfirmDialog | Button | 未推定 | Button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=busy | apps/web/src/shared/components/ConfirmDialog.tsx:111 |
| 共通 | ConfirmDialog | Button | 未推定 | Button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=busy \|\| confirmDisabled | apps/web/src/shared/components/ConfirmDialog.tsx:112 |
| 共通 | Icon | svg | 未推定 | svg 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/shared/components/Icon.tsx:29 |
| 共通 | Button | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | - | apps/web/src/shared/ui/Button.tsx:19 |
| 共通 | ConfirmDialog | Button | キャンセル | 「キャンセル」を表す Button 要素。 | 状態: disabled=busy | apps/web/src/shared/ui/ConfirmDialog.tsx:108 |
| 共通 | ConfirmDialog | Button | 未推定 | Button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=busy \|\| confirmDisabled | apps/web/src/shared/ui/ConfirmDialog.tsx:109 |
| 共通 | IconButton | button | label | 「label」を実行するボタン。 | - | apps/web/src/shared/ui/IconButton.tsx:14 |
| 共通 | ResourceStatePanel | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: aria-controls=state.target.regionId | apps/web/src/shared/ui/ResourceState.tsx:179 |
| 共通 | ResourceStatePanel | button | 処理中 | 「処理中」を実行するボタン。 | 状態: aria-controls=state.target.regionId, disabled=true | apps/web/src/shared/ui/ResourceState.tsx:181 |
| 共通 | ResourceStatePanel | button | 戻る | 「戻る」を実行するボタン。 | - | apps/web/src/shared/ui/ResourceState.tsx:182 |
| 共通 | ResourceStatePanel | button | サポート情報 | 「サポート情報」を実行するボタン。 | - | apps/web/src/shared/ui/ResourceState.tsx:183 |

## 仕様書での読み替え

| 抽出値 | この資料での意味 |
| --- | --- |
| アクセシブル名 | ボタンや入力項目が利用者にどう説明されるか。 |
| 説明参照 | 補足、制約、エラー、リスク説明がどの UI と結びつくか。 |
| 状態属性 | 現在地、展開状態、選択状態、処理中、無効状態など、操作時の状態。 |
| 場所 | 説明の元になった JSX のファイルと行番号。 |
