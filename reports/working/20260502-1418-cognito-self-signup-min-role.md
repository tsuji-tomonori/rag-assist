# 作業完了レポート

保存先: `reports/working/20260502-1418-cognito-self-signup-min-role.md`

## 1. 受けた指示

- GitHub Actions から `SYSTEM_ADMIN` を作成できる状態は許容する。
- 通常ユーザーはログイン画面からユーザーごとにアカウント作成できるようにする。
- ログイン画面から作成したユーザーには最小権限のみを払い出す。
- 上位権限は管理ユーザーが後から付与する想定にする。
- 既存 PR の方針と本文をこの方針へ合わせる。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | GitHub Actions からの `SYSTEM_ADMIN` 付与を許容する | 高 | 対応 |
| R2 | ログイン画面で Cognito アカウント作成と確認コード入力を可能にする | 高 | 対応 |
| R3 | self sign-up ユーザーには最小権限 `CHAT_USER` のみを付与する | 高 | 対応 |
| R4 | 上位権限は管理ユーザーが後から付与する運用を文書化する | 高 | 対応 |
| R5 | セキュリティ境界と回帰防止テストを追加する | 高 | 対応 |

## 3. 検討・判断したこと

- GitHub Actions は実行者、環境承認、OIDC assume role の証跡が残るため、管理者ロール付与の運用経路として維持する方針に変更した。
- self sign-up 直後の Cognito ユーザーは group 未所属だと API 権限がないため、Cognito post-confirmation trigger で `CHAT_USER` のみを自動付与する構成にした。
- `create-cognito-user.sh` は既存どおり `SYSTEM_ADMIN` を扱えるままにし、管理者が GitHub Actions または AWS 管理手順で上位権限を付与できる状態を保った。
- User Pool と trigger Lambda policy の循環依存を避けるため、Lambda の `AdminAddUserToGroup` 権限は同一 account/region の Cognito userpool wildcard に限定した。

## 4. 実施した作業

- `.github/workflows/memorag-create-cognito-user.yml` の `SYSTEM_ADMIN` 拒否差分を戻し、`システム管理者` を選択可能に戻した。
- Web の認証 client に Cognito `SignUp` と `ConfirmSignUp` 呼び出しを追加した。
- ログイン画面にアカウント作成、確認コード入力、サインイン復帰の UI を追加した。
- CDK User Pool の self sign-up を有効化し、メール自動確認と post-confirmation trigger を追加した。
- post-confirmation trigger で確認済み self sign-up ユーザーを `CHAT_USER` group に追加する Lambda を追加した。
- README、GitHub Actions deploy docs、operations docs に、self sign-up は `CHAT_USER` のみ、上位権限は管理ユーザーが後から付与する運用を追記した。
- Web と infra の unit/typecheck/snapshot test を更新した。
- `origin/main` の `v0.14.0` 相当変更を merge し、`BENCHMARK_RUNNER` 追加後の 8 Cognito group と self sign-up assertion を両立するように infra test の競合を解消した。
- 要求・設計書に `FR-024`、Cognito self sign-up 詳細設計、HLD/API/architecture view の責務と権限境界を追記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `.github/workflows/memorag-create-cognito-user.yml` | YAML | GitHub Actions から `SYSTEM_ADMIN` を付与可能な状態に戻した | R1 |
| `memorag-bedrock-mvp/apps/web/src/authClient.ts` | TypeScript | Cognito `SignUp` / `ConfirmSignUp` を追加 | R2 |
| `memorag-bedrock-mvp/apps/web/src/LoginPage.tsx` | React | アカウント作成と確認コード入力 UI を追加 | R2 |
| `memorag-bedrock-mvp/infra/functions/cognito-post-confirmation.ts` | Lambda | self sign-up 確認後に `CHAT_USER` のみ付与 | R3 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | CDK | self sign-up 有効化と trigger 構成を追加 | R3 |
| `memorag-bedrock-mvp/docs/*`, `README.md` | Markdown | 権限払い出し運用を更新 | R4 |
| `memorag-bedrock-mvp/docs/1_要求_REQ/.../REQ_FUNCTIONAL_024.md` | Markdown | self sign-up 最小権限払い出しの機能要求 | R2, R3, R4 |
| `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_004.md` | Markdown | Cognito self sign-up と post-confirmation trigger の詳細設計 | R2, R3, R4 |
| `*.test.ts`, CDK snapshot | Test | self sign-up と最小権限付与の回帰確認 | R5 |

## 6. 検証

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass、4 files / 47 tests
- `env UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- `git diff --check`: pass
- 要求・設計書追記後の `git diff --check`: pass
- 初回 infra test では User Pool と Lambda policy の循環依存を検出し、IAM resource scope を同一 account/region の userpool wildcard にして解消した。
- 最新 `origin/main` merge 後、`@aws-sdk/client-sfn` が node_modules に未反映で infra bundle が一度失敗したため、`npm install` を再実行してから infra test を再実行し pass した。
- 実 GitHub Actions 実行、実 Cognito User Pool での sign-up、確認コード受信、group 付与確認は未実施。

## 7. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | GitHub Actions の `SYSTEM_ADMIN` 許容、ログイン画面 self sign-up、最小権限付与、上位権限後付けをすべて反映した。 |
| 制約遵守 | 4.8 | 既存管理 workflow とスクリプトの運用を維持しつつ、self sign-up の権限だけを最小化した。実 AWS 確認は未実施。 |
| 成果物品質 | 4.8 | Web、infra、snapshot の回帰テストを追加し、CDK 循環依存も検出して修正した。 |
| 説明責任 | 5 | 方針変更、判断理由、未実施検証、残リスクを明記した。 |
| 検収容易性 | 5 | 変更箇所、テスト、運用境界が確認しやすい。 |

総合fit: 4.9 / 5.0（約98%）

## 8. 未対応・制約・リスク

- 未対応: 実 AWS 環境での Cognito sign-up、確認メール受信、`CHAT_USER` group 付与確認。
- 制約: self sign-up の濫用対策は Cognito の標準確認コードとパスワードポリシーに依存しており、追加の招待制・ドメイン制限・レート制限は未実装。
- リスク: post-confirmation trigger が失敗した場合、ユーザーは確認済みでも `CHAT_USER` group が付かず API 利用できないため、CloudWatch Logs と再付与手順の運用確認が必要。
