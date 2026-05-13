# Web 機能詳細: 認証

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## 概要

ログイン、サインアップ、確認コード、新規パスワード設定などの認証画面を扱う領域です。

## 関連画面

関連画面は静的解析では見つかりませんでした。

## コンポーネント

| コンポーネント | 説明 | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- | --- |
| LoginHeroGraphic | LoginHeroGraphic は 認証 領域の 画面または画面内 UI コンポーネント です。単独画面ではなく、他の UI から利用されます。 | 画面または画面内 UI コンポーネント | apps/web/src/features/auth/components/LoginHeroGraphic.tsx | LoginHeroGraphic | circle, defs, feDropShadow, filter, g, linearGradient, path, radialGradient, rect, stop, svg |
| LoginPage | LoginPage は 認証 領域の 画面または画面内 UI コンポーネント です。単独画面ではなく、他の UI から利用されます。 | 画面または画面内 UI コンポーネント | apps/web/src/features/auth/components/LoginPage.tsx | LoginPage | LoadingSpinner, LoginHeroGraphic, PasswordRequirementList, button, div, form, h1, input, label, li, p, span, strong, ul |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LoginPage | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=isSubmitting \|\| !isCurrentPasswordValid | - | apps/web/src/features/auth/components/LoginPage.tsx:285 | unknown |
| LoginPage | button | アカウント作成 | 「アカウント作成」を実行するボタン。 | 状態: disabled=isSubmitting | onClick=() => switchMode("signUp") | apps/web/src/features/auth/components/LoginPage.tsx:293 | confirmed |
| LoginPage | button | 確認コード入力 | 「確認コード入力」を実行するボタン。 | 状態: disabled=isSubmitting | onClick=() => switchMode("confirmSignUp") | apps/web/src/features/auth/components/LoginPage.tsx:294 | confirmed |
| LoginPage | button | サインインへ戻る | 「サインインへ戻る」を実行するボタン。 | 状態: disabled=isSubmitting | onClick=() => switchMode("signIn") | apps/web/src/features/auth/components/LoginPage.tsx:297 | confirmed |

## フォーム

| コンポーネント | ラベル | フォーム説明 | 状態・補足 | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| LoginPage | title | 「title」を入力・送信するフォーム。 | 説明参照: error ? "login-error" : notice ? "login-notice" : undefined | onSubmit=onSubmit | apps/web/src/features/auth/components/LoginPage.tsx:213 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LoginPage | input | 新しいパスワード | 「新しいパスワード」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setNewPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:221 | confirmed |
| LoginPage | input | 新しいパスワード（確認） | 「新しいパスワード（確認）」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setConfirmPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:231 | confirmed |
| LoginPage | input | メールアドレス | 「メールアドレス」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:243 | confirmed |
| LoginPage | input | 確認コード | 「確認コード」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setConfirmationCode(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:245 | confirmed |
| LoginPage | input | メールアドレス | 「メールアドレス」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:258 | confirmed |
| LoginPage | input | パスワード | 「パスワード」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:260 | confirmed |
| LoginPage | input | パスワード（確認） | 「パスワード（確認）」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setSignUpPasswordConfirm(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:263 | confirmed |
| LoginPage | input | メールアドレス | 「メールアドレス」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:275 | confirmed |
| LoginPage | input | パスワード | 「パスワード」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:277 | confirmed |
| LoginPage | input | ログイン状態を保持 | 「ログイン状態を保持」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setRemember(e.target.checked) | apps/web/src/features/auth/components/LoginPage.tsx:281 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LoginHeroGraphic | svg | 未推定 | svg 要素。静的解析では具体的な操作名を推定できません。 | role: img | - | apps/web/src/features/auth/components/LoginHeroGraphic.tsx:3 | unknown |
| LoginPage | form | title | 「title」を入力・送信するフォーム。 | 説明参照: error ? "login-error" : notice ? "login-notice" : undefined | onSubmit=onSubmit | apps/web/src/features/auth/components/LoginPage.tsx:213 | confirmed |
| LoginPage | label | 新しいパスワード | 「新しいパスワード」に紐づく入力ラベル。 | - | - | apps/web/src/features/auth/components/LoginPage.tsx:220 | confirmed |
| LoginPage | input | 新しいパスワード | 「新しいパスワード」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setNewPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:221 | confirmed |
| LoginPage | label | 新しいパスワード（確認） | 「新しいパスワード（確認）」に紐づく入力ラベル。 | - | - | apps/web/src/features/auth/components/LoginPage.tsx:230 | confirmed |
| LoginPage | input | 新しいパスワード（確認） | 「新しいパスワード（確認）」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setConfirmPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:231 | confirmed |
| LoginPage | label | メールアドレス | 「メールアドレス」に紐づく入力ラベル。 | - | - | apps/web/src/features/auth/components/LoginPage.tsx:242 | confirmed |
| LoginPage | input | メールアドレス | 「メールアドレス」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:243 | confirmed |
| LoginPage | label | 確認コード | 「確認コード」に紐づく入力ラベル。 | - | - | apps/web/src/features/auth/components/LoginPage.tsx:244 | confirmed |
| LoginPage | input | 確認コード | 「確認コード」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setConfirmationCode(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:245 | confirmed |
| LoginPage | label | メールアドレス | 「メールアドレス」に紐づく入力ラベル。 | - | - | apps/web/src/features/auth/components/LoginPage.tsx:257 | confirmed |
| LoginPage | input | メールアドレス | 「メールアドレス」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:258 | confirmed |
| LoginPage | label | パスワード | 「パスワード」に紐づく入力ラベル。 | - | - | apps/web/src/features/auth/components/LoginPage.tsx:259 | confirmed |
| LoginPage | input | パスワード | 「パスワード」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:260 | confirmed |
| LoginPage | label | パスワード（確認） | 「パスワード（確認）」に紐づく入力ラベル。 | - | - | apps/web/src/features/auth/components/LoginPage.tsx:262 | confirmed |
| LoginPage | input | パスワード（確認） | 「パスワード（確認）」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setSignUpPasswordConfirm(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:263 | confirmed |
| LoginPage | label | メールアドレス | 「メールアドレス」に紐づく入力ラベル。 | - | - | apps/web/src/features/auth/components/LoginPage.tsx:274 | confirmed |
| LoginPage | input | メールアドレス | 「メールアドレス」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:275 | confirmed |
| LoginPage | label | パスワード | 「パスワード」に紐づく入力ラベル。 | - | - | apps/web/src/features/auth/components/LoginPage.tsx:276 | confirmed |
| LoginPage | input | パスワード | 「パスワード」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:277 | confirmed |
| LoginPage | label | ログイン状態を保持 | 「ログイン状態を保持」に紐づく入力ラベル。 | - | - | apps/web/src/features/auth/components/LoginPage.tsx:281 | confirmed |
| LoginPage | input | ログイン状態を保持 | 「ログイン状態を保持」を入力または選択する項目。 | 状態: disabled=isSubmitting | onChange=(e) => setRemember(e.target.checked) | apps/web/src/features/auth/components/LoginPage.tsx:281 | confirmed |
| LoginPage | button | 未推定 | button 要素。静的解析では具体的な操作名を推定できません。 | 状態: disabled=isSubmitting \|\| !isCurrentPasswordValid | - | apps/web/src/features/auth/components/LoginPage.tsx:285 | unknown |
| LoginPage | button | アカウント作成 | 「アカウント作成」を実行するボタン。 | 状態: disabled=isSubmitting | onClick=() => switchMode("signUp") | apps/web/src/features/auth/components/LoginPage.tsx:293 | confirmed |
| LoginPage | button | 確認コード入力 | 「確認コード入力」を実行するボタン。 | 状態: disabled=isSubmitting | onClick=() => switchMode("confirmSignUp") | apps/web/src/features/auth/components/LoginPage.tsx:294 | confirmed |
| LoginPage | button | サインインへ戻る | 「サインインへ戻る」を実行するボタン。 | 状態: disabled=isSubmitting | onClick=() => switchMode("signIn") | apps/web/src/features/auth/components/LoginPage.tsx:297 | confirmed |
