# 作業完了レポート

保存先: `reports/working/20260502-0000-oidc-trust-policy-fix.md`

## 1. 受けた指示

- Aardvark が報告した脆弱性が HEAD に残っているか確認する。
- 残っている場合は既存機能を維持した最小修正で対処する。
- 変更後にコミットし、PR タイトル・本文を作成する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | HEAD で脆弱性の有無を確認 | 高 | 対応 |
| R2 | 残存時は最小修正を実装 | 高 | 対応 |
| R3 | 影響するドキュメントも整合 | 中 | 対応 |
| R4 | 検証と報告を実施 | 高 | 対応 |

## 3. 検討・判断したこと

- 問題の本質は OIDC trust subject のハードコードなので、`GitHubOwner` と `GitHubRepository` のパラメータ復元を最小修正として採用した。
- 既存利用者の運用手順との整合を保つため、CloudFormation テンプレートだけでなく README と deploy 手順ドキュメントの例も同時に更新した。
- `ManagedPolicyArns` 既定値は本件の主因ではないため、動作互換性を優先して今回は変更しない判断とした。

## 4. 実施した作業

- `memorag-bedrock-mvp/infra/bootstrap/github-actions-oidc-role.yaml` に `GitHubOwner`/`GitHubRepository` パラメータを追加。
- Role Description と trust policy subject、Output の subject をパラメータ参照に戻した。
- `README.md` と `memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md` の deploy 例に owner/repository パラメータを追加し、trust policy 例をプレースホルダに変更した。
- `git diff --check` で差分の体裁を確認した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/infra/bootstrap/github-actions-oidc-role.yaml` | YAML | OIDC trust subject のハードコード除去 | R2 |
| `README.md` | Markdown | デプロイ手順のパラメータ更新 | R3 |
| `memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md` | Markdown | 詳細手順のパラメータ更新 | R3 |
| `reports/working/20260502-0000-oidc-trust-policy-fix.md` | Markdown | 本レポート | R4 |

## 6. 指示へのfit評価

- 指示網羅性: 5/5
- 制約遵守: 5/5
- 成果物品質: 4/5
- 説明責任: 5/5
- 検収容易性: 5/5

**総合fit: 4.8/5（約96%）**

理由: 脆弱性の根本原因に対する最小修正と関連ドキュメント整合を実施できたため。

## 7. 未対応・制約・リスク

- 未対応: cfn-lint など専用ツールによる追加検証は未実施。
- 制約: 実 AWS 環境での AssumeRole 動作確認はこの環境では未実施。
- リスク: `ManagedPolicyArns` 既定値が広い点は別のセキュリティ設計課題として残る。
