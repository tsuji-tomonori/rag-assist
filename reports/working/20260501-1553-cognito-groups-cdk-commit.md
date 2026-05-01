# 作業完了レポート

保存先: `reports/working/20260501-1553-cognito-groups-cdk-commit.md`

## 1. 受けた指示

- 主な依頼: Cognito group や User Pool など、CDK で作れる共通設定は CDK で作ること。
- 追加依頼: ブランチを切り、そのブランチで commit すること。
- 対象範囲: MemoRAG Bedrock MVP の Cognito ユーザー作成スクリプトと CDK スタック。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 新しいブランチを作成する | 高 | 対応 |
| R2 | Cognito group を CDK 管理にする | 高 | 対応 |
| R3 | ユーザー作成スクリプトから共通設定作成を外す | 高 | 対応 |
| R4 | CDK テストと snapshot を更新する | 高 | 対応 |
| R5 | 変更を commit する | 高 | 対応（最終手順で実施） |

## 3. 検討・判断したこと

- Cognito User Pool / Client は既に CDK で作成されていたため、新たに `AWS::Cognito::UserPoolGroup` を CDK に追加した。
- アプリの認可ロールは `cognito:groups` と同名で判定されているため、CDK の group 名も既存ロール名と一致させた。
- ユーザー作成スクリプトは個別ユーザー作成と既存 group への割り当てに絞り、group が存在しない場合は CDK deploy を促して停止する形にした。
- ブランチ名はスラッシュ付き ref 作成が環境制約で失敗したため、`cognito-user-management-script` を使用した。

## 4. 実施した作業

- `cognito-user-management-script` ブランチを作成した。
- CDK スタックに 7 種類の Cognito group を追加した。
- CDK assertion test に UserPoolGroup の件数と group 名の検証を追加した。
- CloudFormation snapshot を更新した。
- ユーザー作成スクリプトから Cognito group 作成処理を外し、存在確認と割り当てに変更した。
- README の Cognito ユーザー作成手順に、group は CDK stack で作成される旨を追記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript | Cognito group の CDK 定義 | R2 |
| `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts` | TypeScript | UserPoolGroup の assertion 追加 | R4 |
| `memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json` | JSON | Cognito group を含む snapshot | R4 |
| `memorag-bedrock-mvp/infra/scripts/create-cognito-user.sh` | Bash | 既存 group へのユーザー割り当てに変更 | R3 |
| `memorag-bedrock-mvp/README.md` | Markdown | CDK deploy 前提の説明を追記 | R3 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5/5 | ブランチ作成、CDK 化、commit までの要件に対応 |
| 制約遵守 | 5/5 | 共通設定を CDK 管理へ移し、作業レポートも作成した |
| 成果物品質 | 4.5/5 | CDK テストは通過。実 AWS deploy は未実施 |
| 説明責任 | 4.5/5 | 判断、検証、未実施事項を明記した |
| 検収容易性 | 4.5/5 | テストと snapshot で差分確認しやすくした |

**総合fit: 4.7/5（約94%）**

理由: 指示された CDK 管理への移管とブランチ作成に対応し、テストも通過した。実 AWS 環境への deploy と実ユーザー作成は未実施。

## 7. 未対応・制約・リスク

- 未対応: 実 AWS 環境での CDK deploy、Cognito group 作成確認、ユーザー作成実行。
- 制約: AWS 認証情報と対象アカウント確認が必要なため、ローカル CDK テストまで実施した。
- リスク: 既存環境に手動作成済み group がある場合、CDK deploy 時に名前衝突する可能性がある。

## 8. 次に改善できること

- deploy 前に既存 User Pool group の棚卸し手順を README に追記する。
- ユーザー作成スクリプトに安全なパスワード入力プロンプトを追加する。
