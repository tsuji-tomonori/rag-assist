# 作業完了レポート

保存先: `reports/working/20260501-1547-cognito-create-user-script.md`

## 1. 受けた指示

- 主な依頼: Cognito にユーザーを作るスクリプトを作成すること。
- 成果物: Cognito ユーザー作成用スクリプトと利用手順。
- 形式・条件: 既存の MemoRAG Bedrock MVP 構成に合わせる。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | Cognito ユーザー作成スクリプトを追加する | 高 | 対応 |
| R2 | 既存の Cognito User Pool 構成に合わせる | 高 | 対応 |
| R3 | アプリのロールと対応する Cognito group を扱えるようにする | 高 | 対応 |
| R4 | 実行方法を確認できるようにする | 中 | 対応 |
| R5 | 実 AWS 環境での作成を検証する | 中 | 未実施 |

## 3. 検討・判断したこと

- 既存 CDK は Cognito User Pool / Client を作成し、API 認可では `cognito:groups` をロールとして利用しているため、ユーザー作成スクリプトはロール割り当てまで扱う方針にした。
- 後続指示により、共通設定である Cognito group 作成は CDK に移管し、スクリプトは既存 group への割り当てに絞った。
- 追加 npm 依存を増やさず、運用環境で一般的に使える AWS CLI ベースの Bash スクリプトにした。
- `--user-pool-id` 未指定時は CDK の CloudFormation output `CognitoUserPoolId` から取得する方針にし、通常のデプロイ後作業を短くした。
- パスワード運用は、招待メール、初回変更用一時パスワード、恒久パスワード設定の使い分けができるようにした。

## 4. 実施した作業

- `memorag-bedrock-mvp/infra/scripts/create-cognito-user.sh` を追加した。
- 有効ロールを `CHAT_USER`, `ANSWER_EDITOR`, `RAG_GROUP_MANAGER`, `USER_ADMIN`, `ACCESS_ADMIN`, `COST_AUDITOR`, `SYSTEM_ADMIN` に制限した。
- ユーザーが既に存在する場合でも、指定ロールの割り当てを継続できるようにした。
- `memorag-bedrock-mvp/README.md` に Cognito ユーザー作成例を追記した。
- スクリプトに実行権限を付与した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/infra/scripts/create-cognito-user.sh` | Bash | Cognito ユーザー作成、パスワード設定、既存グループへのロール割り当て | R1, R2, R3 |
| `memorag-bedrock-mvp/README.md` | Markdown | スクリプトの実行例と `SYSTEM_ADMIN` 指定方法 | R4 |
| `reports/working/20260501-1547-cognito-create-user-script.md` | Markdown | 作業完了レポート | リポジトリルール対応 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5/5 | Cognito ユーザー作成スクリプトを追加し、既存ロール運用にも対応した |
| 制約遵守 | 5/5 | リポジトリ内に成果物を配置し、作業レポートも作成した |
| 成果物品質 | 4/5 | 構文チェックとヘルプ確認は実施済みだが、実 AWS 作成は未検証 |
| 説明責任 | 4.5/5 | 実施内容、未検証事項、制約を明示した |
| 検収容易性 | 4.5/5 | README の例とスクリプトの `--help` で確認しやすくした |

**総合fit: 4.6/5（約92%）**

理由: 主要要件は満たし、既存アプリの Cognito group 認可にも合わせた。実 AWS 環境でのユーザー作成は認証情報と対象環境に依存するため未実施。

## 7. 未対応・制約・リスク

- 未対応: 実際の Cognito User Pool に対する `admin-create-user` の実行検証。
- 制約: AWS CLI 認証情報、対象リージョン、対象スタックが必要。
- リスク: 本番運用ではパスワードの平文指定をシェル履歴に残さない運用が必要。

## 8. 次に改善できること

- AWS CLI をモックした自動テストを追加する。
- Secrets Manager や安全なプロンプト入力経由でパスワードを渡すモードを追加する。
