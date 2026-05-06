# Cognito self sign-up 最小権限付与詳細設計

- ファイル: `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_004.md`
- 種別: `DES_DLD`
- 作成日: 2026-05-02
- 状態: Draft

## 何を書く場所か

Cognito self sign-up、確認コード入力、post-confirmation trigger、最小権限 group 付与、上位権限付与の責務分離を定義する。

## 対象

- Web UI のアカウント作成フォーム
- Cognito `SignUp` / `ConfirmSignUp`
- Cognito User Pool self sign-up 設定
- post-confirmation trigger Lambda
- `CHAT_USER` group 自動付与
- GitHub Actions / AWS 管理手順による上位権限後付け

## 責務分担

| 要素 | 責務 |
|---|---|
| Web UI | 未認証利用者に sign-up、確認コード入力、sign-in 復帰の操作を提供する |
| Cognito User Pool | メールアドレスを username として self sign-up と確認コード検証を処理する |
| post-confirmation trigger | `PostConfirmation_ConfirmSignUp` のときだけ `CHAT_USER` group を付与する |
| GitHub Actions user creation workflow | 管理ユーザーが通常 role または `SYSTEM_ADMIN` を明示して作成・付与する |
| API Authorization Layer | ID token の Cognito group から permission を算出し、API 実行可否を判定する |

## 処理手順

### 通常利用者 self sign-up

1. 利用者はログイン画面でアカウント作成を選択する。
2. Web UI はメールアドレス、パスワード、パスワード確認を検証する。
3. Web UI は Cognito `SignUp` を呼び出す。
4. Cognito は確認コードをメールへ送信する。
5. 利用者は確認コード入力画面でコードを入力する。
6. Web UI は Cognito `ConfirmSignUp` を呼び出す。
7. Cognito は確認完了後に post-confirmation trigger を起動する。
8. post-confirmation trigger は対象 userPoolId / username を使い、対象ユーザーを `CHAT_USER` group に追加する。
9. 利用者は確認済みアカウントで sign-in する。

### 上位権限付与

1. 管理ユーザーは対象者、必要 role、必要理由を確認する。
2. 管理ユーザーは GitHub Actions の `Create MemoRAG Cognito User` workflow または AWS 管理手順を使う。
3. workflow / 管理手順は `ANSWER_EDITOR`、`RAG_GROUP_MANAGER`、`BENCHMARK_OPERATOR`、`BENCHMARK_RUNNER`、`USER_ADMIN`、`ACCESS_ADMIN`、`COST_AUDITOR`、`SYSTEM_ADMIN` を必要に応じて付与する。
4. 上位権限付与は self sign-up UI からは実行しない。

## 権限境界

| 経路 | 付与できる role | 境界 |
|---|---|---|
| ログイン画面 self sign-up | `CHAT_USER` のみ | post-confirmation trigger が固定 group を付与する |
| GitHub Actions user creation workflow | 既存 Cognito group 全体 | GitHub environment 承認、OIDC assume role、workflow 実行ログを管理者操作の証跡とする |
| AWS 管理手順 | AWS 権限に依存 | AWS IAM と CloudTrail / 操作ログを証跡とする |

## エラー処理

| 事象 | 方針 |
|---|---|
| `SignUp` が失敗する | Web UI は session を作らず、入力エラーまたは Cognito エラーを表示する |
| `ConfirmSignUp` が失敗する | Web UI は session を作らず、確認コード再入力を促す |
| post-confirmation trigger が失敗する | Cognito 確認済みでも `CHAT_USER` が付かないため、CloudWatch Logs を確認し、管理者が group を再付与する |
| 既存ユーザーが sign-up する | Cognito の重複エラーを表示し、sign-in または確認コード入力へ誘導する |

## テスト観点

| 観点 | 対応テスト |
|---|---|
| Web UI が sign-up と確認コード入力を提供する | `LoginPage` のアカウント作成テスト |
| Cognito `SignUp` / `ConfirmSignUp` payload が正しい | `authClient` の sign-up / confirm test |
| self sign-up が有効で post-confirmation trigger を持つ | CDK stack assertion |
| post-confirmation trigger の default group が `CHAT_USER` | CDK stack assertion |
| group 数が `BENCHMARK_OPERATOR` と `BENCHMARK_RUNNER` を含む現行 role 定義と一致する | CDK stack assertion |

## 関連要求

- `FR-025`
- `NFR-011`
