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

| コンポーネント | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- |
| LoginHeroGraphic | 画面または画面内 UI コンポーネント | apps/web/src/features/auth/components/LoginHeroGraphic.tsx | LoginHeroGraphic | circle, defs, feDropShadow, filter, g, linearGradient, path, radialGradient, rect, stop, svg |
| LoginPage | 画面または画面内 UI コンポーネント | apps/web/src/features/auth/components/LoginPage.tsx | LoginPage | LoadingSpinner, LoginHeroGraphic, PasswordRequirementList, button, div, form, h1, input, label, li, p, span, strong, ul |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- |
| LoginPage | button | 未推定 | - | apps/web/src/features/auth/components/LoginPage.tsx:281 | unknown |
| LoginPage | button | アカウント作成 | onClick=() => switchMode("signUp") | apps/web/src/features/auth/components/LoginPage.tsx:289 | confirmed |
| LoginPage | button | 確認コード入力 | onClick=() => switchMode("confirmSignUp") | apps/web/src/features/auth/components/LoginPage.tsx:290 | confirmed |
| LoginPage | button | サインインへ戻る | onClick=() => switchMode("signIn") | apps/web/src/features/auth/components/LoginPage.tsx:293 | confirmed |

## フォーム

| コンポーネント | ラベル | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- |
| LoginPage | 未推定 | onSubmit=onSubmit | apps/web/src/features/auth/components/LoginPage.tsx:213 | unknown |

## 入力項目

| コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- |
| LoginPage | input | 新しいパスワードを入力 | onChange=(e) => setNewPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:221 | confirmed |
| LoginPage | input | 新しいパスワードを再入力 | onChange=(e) => setConfirmPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:230 | confirmed |
| LoginPage | input | メールアドレスを入力 | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:241 | confirmed |
| LoginPage | input | 確認コードを入力 | onChange=(e) => setConfirmationCode(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:243 | confirmed |
| LoginPage | input | メールアドレスを入力 | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:255 | confirmed |
| LoginPage | input | パスワードを入力 | onChange=(e) => setPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:257 | confirmed |
| LoginPage | input | パスワードを再入力 | onChange=(e) => setSignUpPasswordConfirm(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:260 | confirmed |
| LoginPage | input | メールアドレスを入力 | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:271 | confirmed |
| LoginPage | input | パスワードを入力 | onChange=(e) => setPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:273 | confirmed |
| LoginPage | input | 未推定 | onChange=(e) => setRemember(e.target.checked) | apps/web/src/features/auth/components/LoginPage.tsx:277 | unknown |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- |
| LoginPage | form | 未推定 | onSubmit=onSubmit | apps/web/src/features/auth/components/LoginPage.tsx:213 | unknown |
| LoginPage | label | 新しいパスワード | - | apps/web/src/features/auth/components/LoginPage.tsx:220 | confirmed |
| LoginPage | input | 新しいパスワードを入力 | onChange=(e) => setNewPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:221 | confirmed |
| LoginPage | label | 新しいパスワード（確認） | - | apps/web/src/features/auth/components/LoginPage.tsx:229 | confirmed |
| LoginPage | input | 新しいパスワードを再入力 | onChange=(e) => setConfirmPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:230 | confirmed |
| LoginPage | label | メールアドレス | - | apps/web/src/features/auth/components/LoginPage.tsx:240 | confirmed |
| LoginPage | input | メールアドレスを入力 | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:241 | confirmed |
| LoginPage | label | 確認コード | - | apps/web/src/features/auth/components/LoginPage.tsx:242 | confirmed |
| LoginPage | input | 確認コードを入力 | onChange=(e) => setConfirmationCode(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:243 | confirmed |
| LoginPage | label | メールアドレス | - | apps/web/src/features/auth/components/LoginPage.tsx:254 | confirmed |
| LoginPage | input | メールアドレスを入力 | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:255 | confirmed |
| LoginPage | label | パスワード | - | apps/web/src/features/auth/components/LoginPage.tsx:256 | confirmed |
| LoginPage | input | パスワードを入力 | onChange=(e) => setPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:257 | confirmed |
| LoginPage | label | パスワード（確認） | - | apps/web/src/features/auth/components/LoginPage.tsx:259 | confirmed |
| LoginPage | input | パスワードを再入力 | onChange=(e) => setSignUpPasswordConfirm(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:260 | confirmed |
| LoginPage | label | メールアドレス | - | apps/web/src/features/auth/components/LoginPage.tsx:270 | confirmed |
| LoginPage | input | メールアドレスを入力 | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:271 | confirmed |
| LoginPage | label | パスワード | - | apps/web/src/features/auth/components/LoginPage.tsx:272 | confirmed |
| LoginPage | input | パスワードを入力 | onChange=(e) => setPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:273 | confirmed |
| LoginPage | label | ログイン状態を保持 | - | apps/web/src/features/auth/components/LoginPage.tsx:277 | confirmed |
| LoginPage | input | 未推定 | onChange=(e) => setRemember(e.target.checked) | apps/web/src/features/auth/components/LoginPage.tsx:277 | unknown |
| LoginPage | button | 未推定 | - | apps/web/src/features/auth/components/LoginPage.tsx:281 | unknown |
| LoginPage | button | アカウント作成 | onClick=() => switchMode("signUp") | apps/web/src/features/auth/components/LoginPage.tsx:289 | confirmed |
| LoginPage | button | 確認コード入力 | onClick=() => switchMode("confirmSignUp") | apps/web/src/features/auth/components/LoginPage.tsx:290 | confirmed |
| LoginPage | button | サインインへ戻る | onClick=() => switchMode("signIn") | apps/web/src/features/auth/components/LoginPage.tsx:293 | confirmed |
