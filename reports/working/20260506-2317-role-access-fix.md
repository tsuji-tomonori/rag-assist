# 作業完了レポート

保存先: `reports/working/20260506-2317-role-access-fix.md`

## 1. 受けた指示

- 主な依頼: 回答担当や性能テスト担当にしても対象機能へアクセスできない原因を調査し、障害レポートを作成したうえで修正する。
- 成果物: 障害レポート、RBAC / Cognito group 同期修正、性能テスト担当 role の整理、回帰テスト、関連ドキュメント更新。
- 条件: 実施していない検証を実施済みとして書かない。worktree task PR flow に従う。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 原因を明確化する | 高 | 対応 |
| R2 | 障害レポートを作成する | 高 | 対応 |
| R3 | 回答担当のアクセス不具合を修正する | 高 | 対応 |
| R4 | 性能テスト担当のアクセス不具合を修正する | 高 | 対応 |
| R5 | 回帰テストと検証を実施する | 高 | 対応 |
| R6 | 関連ドキュメントを同期する | 中 | 対応 |

## 3. 検討・判断したこと

- 管理画面の role 付与は管理台帳だけでなく Cognito group に反映されなければ、JWT 由来の API 認可に効かないと判断した。
- `BENCHMARK_RUNNER` は CodeBuild runner service user 用の直接 query 権限であり、人間向けの性能テスト起動 role と混同しやすいため、`BENCHMARK_OPERATOR` を追加して分離した。
- `BENCHMARK_RUNNER` には `benchmark:run` を付けず、直接 query と管理画面 run 起動の権限分離を維持した。
- role 変更後の既存 token は自動では変わらないため、対象ユーザーは再ログインして新しい token を取得する運用を docs に明記した。

## 4. 実施した作業

- `reports/bugs/20260506-2303-role-assignment-access-denied.md` に障害レポートを作成し、修正後に `resolved` へ更新した。
- `CognitoUserDirectory.setUserGroups()` を追加し、`assignUserRoles()` から Cognito group の追加・削除を呼ぶようにした。
- `BENCHMARK_OPERATOR` role を追加し、`benchmark:read` / `benchmark:run` を付与した。
- API Lambda の IAM policy に `AdminAddUserToGroup` / `AdminRemoveUserFromGroup` を追加した。
- GitHub Actions のユーザー作成 workflow と `create-cognito-user.sh` の日本語 role 名を、人間向け性能テスト担当と runner service user で分離した。
- README、運用、API、設計、要求系 docs を更新した。
- API / Web / Infra の回帰テストと typecheck を実行した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `reports/bugs/20260506-2303-role-assignment-access-denied.md` | Markdown | 原因、影響、対応、再発防止、検証結果を含む障害レポート | R1, R2 |
| `memorag-bedrock-mvp/apps/api/src/adapters/user-directory.ts` | TypeScript | Cognito group 同期操作を追加 | R3 |
| `memorag-bedrock-mvp/apps/api/src/authorization.ts` | TypeScript | `BENCHMARK_OPERATOR` role を追加 | R4 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript | Cognito group と API IAM を更新 | R3, R4 |
| `memorag-bedrock-mvp/apps/api/src/contract/api-contract.test.ts` | TypeScript | 性能テスト担当の API 境界テストを追加 | R5 |
| `memorag-bedrock-mvp/apps/web/src/App.test.tsx` | TypeScript | 性能テスト担当の Web 導線テストを追加 | R5 |
| docs / README / workflow | Markdown/YAML/Shell | role 運用と日本語 role 名を同期 | R6 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---|---|
| 指示網羅性 | 5 | 原因調査、障害レポート、修正、検証まで対応した。 |
| 制約遵守 | 5 | worktree task、受け入れ条件、実施済み検証の明記を守った。 |
| 成果物品質 | 4 | 実環境 Cognito での smoke は未実施だが、unit / contract / web / infra で回帰を確認した。 |
| 説明責任 | 5 | 原因、影響、残リスク、再ログイン要件を記録した。 |
| 検収容易性 | 5 | 障害レポート、task md、テスト結果を確認可能な形で残した。 |

総合fit: 4.8 / 5.0（約96%）

理由: 主要要件は満たした。実 AWS 環境での Cognito group 反映 smoke はこの環境では未実施のため満点ではない。

## 7. 検証

- `npm --prefix memorag-bedrock-mvp ci`: pass
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck --workspaces --if-present`: pass
- `git diff --check`: pass
- `node -e ... failure_report JSON parse`: pass

## 8. 未対応・制約・リスク

- `task docs:check:changed` は task が存在しないため未実施。
- 実 AWS 環境での Cognito group 反映 smoke は未実施。CDK deploy 後、`BENCHMARK_OPERATOR` group 作成と管理画面 role 付与後の再ログイン確認が必要。
- 管理画面で role を付与されたユーザーは、既存 ID token が期限切れまたは再ログインされるまで新 permission が反映されない。
