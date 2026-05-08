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

| コンポーネント | 要素 | ラベル | アクセシブル名 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LoginPage | button | isSubmitting && <LoadingSpinner className="button-spinner" /> / submitLabel | isSubmitting && <LoadingSpinner className="button-spinner" /> / submitLabel (visible-text) | disabled=isSubmitting \|\| !isCurrentPasswordValid | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/auth/components/LoginPage.tsx:285 | confirmed |
| LoginPage | button | アカウント作成 | アカウント作成 (visible-text) | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => switchMode("signUp") | apps/web/src/features/auth/components/LoginPage.tsx:293 | confirmed |
| LoginPage | button | 確認コード入力 | 確認コード入力 (visible-text) | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => switchMode("confirmSignUp") | apps/web/src/features/auth/components/LoginPage.tsx:294 | confirmed |
| LoginPage | button | サインインへ戻る | サインインへ戻る (visible-text) | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => switchMode("signIn") | apps/web/src/features/auth/components/LoginPage.tsx:297 | confirmed |

## フォーム

| コンポーネント | ラベル | 説明参照 | a11y | 送信ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- |
| LoginPage | title | error ? "login-error" : notice ? "login-notice" : undefined | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSubmit=onSubmit | apps/web/src/features/auth/components/LoginPage.tsx:213 | confirmed |

## 入力項目

| コンポーネント | 要素 | ラベル | アクセシブル名 | 説明参照 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LoginPage | input | 新しいパスワード | 新しいパスワード (aria-label) | - | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setNewPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:221 | confirmed |
| LoginPage | input | 新しいパスワード（確認） | 新しいパスワード（確認） (aria-label) | - | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setConfirmPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:231 | confirmed |
| LoginPage | input | メールアドレス | メールアドレス (aria-label) | - | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:243 | confirmed |
| LoginPage | input | 確認コード | 確認コード (aria-label) | - | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setConfirmationCode(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:245 | confirmed |
| LoginPage | input | メールアドレス | メールアドレス (aria-label) | - | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:258 | confirmed |
| LoginPage | input | パスワード | パスワード (aria-label) | - | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:260 | confirmed |
| LoginPage | input | パスワード（確認） | パスワード（確認） (aria-label) | - | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setSignUpPasswordConfirm(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:263 | confirmed |
| LoginPage | input | メールアドレス | メールアドレス (aria-label) | - | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:275 | confirmed |
| LoginPage | input | パスワード | パスワード (aria-label) | - | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:277 | confirmed |
| LoginPage | input | ログイン状態を保持 | ログイン状態を保持 (label) | - | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setRemember(e.target.checked) | apps/web/src/features/auth/components/LoginPage.tsx:281 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | アクセシブル名 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LoginHeroGraphic | svg | 未推定 | 未推定 (missing) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/auth/components/LoginHeroGraphic.tsx:3 | unknown |
| LoginPage | form | title | title (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onSubmit=onSubmit | apps/web/src/features/auth/components/LoginPage.tsx:213 | confirmed |
| LoginPage | label | 新しいパスワード | 新しいパスワード (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/auth/components/LoginPage.tsx:220 | confirmed |
| LoginPage | input | 新しいパスワード | 新しいパスワード (aria-label) | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setNewPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:221 | confirmed |
| LoginPage | label | 新しいパスワード（確認） | 新しいパスワード（確認） (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/auth/components/LoginPage.tsx:230 | confirmed |
| LoginPage | input | 新しいパスワード（確認） | 新しいパスワード（確認） (aria-label) | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setConfirmPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:231 | confirmed |
| LoginPage | label | メールアドレス | メールアドレス (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/auth/components/LoginPage.tsx:242 | confirmed |
| LoginPage | input | メールアドレス | メールアドレス (aria-label) | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:243 | confirmed |
| LoginPage | label | 確認コード | 確認コード (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/auth/components/LoginPage.tsx:244 | confirmed |
| LoginPage | input | 確認コード | 確認コード (aria-label) | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setConfirmationCode(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:245 | confirmed |
| LoginPage | label | メールアドレス | メールアドレス (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/auth/components/LoginPage.tsx:257 | confirmed |
| LoginPage | input | メールアドレス | メールアドレス (aria-label) | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:258 | confirmed |
| LoginPage | label | パスワード | パスワード (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/auth/components/LoginPage.tsx:259 | confirmed |
| LoginPage | input | パスワード | パスワード (aria-label) | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:260 | confirmed |
| LoginPage | label | パスワード（確認） | パスワード（確認） (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/auth/components/LoginPage.tsx:262 | confirmed |
| LoginPage | input | パスワード（確認） | パスワード（確認） (aria-label) | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setSignUpPasswordConfirm(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:263 | confirmed |
| LoginPage | label | メールアドレス | メールアドレス (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/auth/components/LoginPage.tsx:274 | confirmed |
| LoginPage | input | メールアドレス | メールアドレス (aria-label) | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setEmail(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:275 | confirmed |
| LoginPage | label | パスワード | パスワード (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/auth/components/LoginPage.tsx:276 | confirmed |
| LoginPage | input | パスワード | パスワード (aria-label) | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setPassword(e.target.value) | apps/web/src/features/auth/components/LoginPage.tsx:277 | confirmed |
| LoginPage | label | ログイン状態を保持 | ログイン状態を保持 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/auth/components/LoginPage.tsx:281 | confirmed |
| LoginPage | input | ログイン状態を保持 | ログイン状態を保持 (label) | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(e) => setRemember(e.target.checked) | apps/web/src/features/auth/components/LoginPage.tsx:281 | confirmed |
| LoginPage | button | isSubmitting && <LoadingSpinner className="button-spinner" /> / submitLabel | isSubmitting && <LoadingSpinner className="button-spinner" /> / submitLabel (visible-text) | disabled=isSubmitting \|\| !isCurrentPasswordValid | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/auth/components/LoginPage.tsx:285 | confirmed |
| LoginPage | button | アカウント作成 | アカウント作成 (visible-text) | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => switchMode("signUp") | apps/web/src/features/auth/components/LoginPage.tsx:293 | confirmed |
| LoginPage | button | 確認コード入力 | 確認コード入力 (visible-text) | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => switchMode("confirmSignUp") | apps/web/src/features/auth/components/LoginPage.tsx:294 | confirmed |
| LoginPage | button | サインインへ戻る | サインインへ戻る (visible-text) | disabled=isSubmitting | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => switchMode("signIn") | apps/web/src/features/auth/components/LoginPage.tsx:297 | confirmed |
