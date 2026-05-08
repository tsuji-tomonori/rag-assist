# 個人設定と送信キー設定

保存先: `tasks/do/20260508-2253-account-settings-send-key.md`

状態: do

## 背景

左下の個人アカウント表示でメールアドレスを直接表示しているため、長いメールアドレスで UI が崩れる。送信キー設定はチャット入力欄内にあり、個人設定として扱いたい。

## 目的

- 左下アカウントボタンからメールアドレス表示を取り除く。
- アカウントボタン押下で個人設定画面を開く。
- 個人設定画面でメールアドレス確認と送信キー挙動の設定を可能にする。

## スコープ

- 対象: `memorag-bedrock-mvp/apps/web` の App shell、Rail nav、Chat composer、関連 CSS とテスト。
- 対象外: API 変更、認証方式変更、永続的なサーバーサイドユーザー設定保存。

## 実行計画

1. `AppView` に個人設定 view を追加する。
2. `RailNav` のアカウントボタンを個人設定への導線に変更し、メールアドレスを表示しない。
3. 個人設定画面コンポーネントを追加し、メールアドレス表示、送信キー設定、サインアウトを配置する。
4. `submitShortcut` の状態を個人設定画面とチャット送信処理で共有する。
5. チャット入力欄から送信キー select を除去し、placeholder とキーダウン挙動は設定値を使う。
6. CSS とテストを更新する。

## ドキュメント保守計画

- API や運用手順は変えないため README / API docs は原則更新不要。
- UI 挙動の変更は task file、作業レポート、PR 本文で説明する。

## 受け入れ条件

- [x] AC1: 左下アカウントボタンにメールアドレス本文が表示されず、長いメールアドレスでも左レールが崩れない。
- [x] AC2: アカウントボタンをクリックすると個人設定画面が表示される。
- [x] AC3: 個人設定画面でログイン中のメールアドレスが確認できる。
- [x] AC4: 個人設定画面で送信キー挙動を `Enterで送信` / `Ctrl+Enterで送信` から設定できる。
- [x] AC5: 設定した送信キー挙動がチャット入力の送信処理に反映される。
- [x] AC6: 既存のサインアウト導線が個人設定画面から利用できる。
- [x] AC7: 関連する unit/component tests と差分検証が pass する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `git diff --check`
- 必要に応じて web typecheck/build 相当の npm script を確認して実行する。

## PR レビュー観点

- 個人設定画面が通常ユーザー向けで、管理者設定と混同されないこと。
- メールアドレスは左レールに出さず、個人設定画面だけで折り返し可能に表示すること。
- 送信キー設定の state がチャット送信処理と UI 表示で一貫すること。
- 未実施検証を PR 本文やコメントで実施済み扱いしないこと。

## リスク

- 現時点では送信キー設定をサーバー保存しないため、ページ再読み込みで初期値に戻る可能性がある。
- visual regression snapshot がある場合、個人設定 view の追加により必要な snapshot 更新が発生する可能性がある。

## 検証結果

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass（27 files / 167 tests）
- `git diff --check`: pass
- `npm ci`: pass。初回検証で `tsc` / `vitest` が未検出だったため、worktree 内で依存関係をインストールした。
