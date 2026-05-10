# 作業完了レポート

保存先: `reports/working/20260510-1536-temporary-wildcard-cors.md`

## 1. 受けた指示

- `/prod/me` が 502 になり、Lambda が `CORS_ALLOWED_ORIGINS is required in production` で起動失敗している状況を直す。
- 日本語で対応する。
- 現時点では独自ドメインがないため、CORS は一時的に `*` とする。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | production Lambda が CORS env 不足で起動失敗しない | 高 | 対応 |
| R2 | 現時点の CORS を `*` にする | 高 | 対応 |
| R3 | CDK deploy 後の Lambda env に反映される | 高 | 対応 |
| R4 | 一時措置のリスクと恒久対応を記録する | 高 | 対応 |
| R5 | 変更範囲に見合う検証を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- 直接原因は API config が production で `CORS_ALLOWED_ORIGINS` を必須にした一方、CDK の Lambda environment に同変数がなかったこと。
- 既存 config は production の `*` も拒否していたため、CDK に `*` を追加するだけでは起動失敗が残ると判断した。
- ユーザー指示に合わせて、独自ドメイン未確定期間の一時措置として production の `CORS_ALLOWED_ORIGINS=*` を許容した。
- CORS は認証そのものではないが、ブラウザからの外部 origin 呼び出し面を広げるため、Cognito 認証と route-level permission を前提にし、docs / task / PR に残リスクを明記する方針にした。

## 4. 実施した作業

- `config.ts` から production の wildcard CORS 拒否を外し、未設定拒否は維持した。
- `ApiRuntimeEnv` と公開 d.ts に `CORS_ALLOWED_ORIGINS` を追加した。
- CDK の `apiEnvironment` に `CORS_ALLOWED_ORIGINS: "*"` を追加した。
- infra assertion test と CloudFormation snapshot を更新した。
- API config test を production wildcard CORS 許容の期待に更新した。
- `docs/OPERATIONS.md` と API design docs に、一時措置とドメイン確定後の allowlist 復帰方針を追記した。
- task md を作成し、RCA、受け入れ条件、検証結果を記録した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/config.ts` | TypeScript | production wildcard CORS の一時許容 | R1, R2 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript | Lambda env に `CORS_ALLOWED_ORIGINS: "*"` を設定 | R2, R3 |
| `memorag-bedrock-mvp/packages/contract/src/infra.ts` / `infra.d.ts` | TypeScript | runtime env 型の同期 | R3 |
| `memorag-bedrock-mvp/apps/api/src/contract/api-hardening.test.ts` | Test | production wildcard CORS 許容の回帰確認 | R2, R5 |
| `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts` / snapshot | Test | CDK env 反映の確認 | R3, R5 |
| `memorag-bedrock-mvp/docs/OPERATIONS.md` / `docs/3_設計_DES/41_API_API/DES_API_001.md` | Markdown | 一時措置と恒久対応方針 | R4 |
| `tasks/do/20260510-1536-temporary-wildcard-cors.md` | Markdown | task md、RCA、受け入れ条件、検証結果 | workflow |

## 6. セキュリティ・認可レビュー

- API route、認証 middleware、route-level permission は変更していない。
- `AUTH_ENABLED=true` と Cognito 設定必須は production で維持している。
- `CORS_ALLOWED_ORIGINS=*` は任意 origin からブラウザ経由の API 呼び出しを許可するため、外部公開面は広がる。
- 機微データ保護は CORS ではなく Cognito JWT 認証と permission check に依存する状態であり、ドメイン確定後は具体 origin の allowlist に戻す必要がある。

## 7. 実行した検証

- `npm ci`: pass。3 件の既存 vulnerability 報告あり。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/contract`: pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: 初回 fail、`packages/contract/infra.d.ts` 同期後 pass。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- api-hardening.test.ts`: pass。script の glob により API 全体 199 tests を実行。rebase 後にも再実行済み。
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass。snapshot 更新用。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass。15 tests。rebase 後にも再実行済み。
- `git diff --check`: pass。

## 8. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4.8/5 | 502 の直接原因に対応し、ユーザー指定どおり一時的に `*` を許容した |
| 制約遵守 | 4.7/5 | worktree、task md、RCA、docs、検証、レポートを実施した |
| 成果物品質 | 4.5/5 | CDK env と runtime validation の同期をテストで固定した |
| 説明責任 | 4.8/5 | 一時措置のリスクと allowlist 復帰方針を記録した |
| 検収容易性 | 4.7/5 | 変更ファイル、検証、残リスクを明示した |

総合fit: 4.7 / 5.0（約94%）
理由: ユーザーの短期復旧要件は満たした。`*` 許容はセキュリティ上の恒久解ではないため、ドメイン確定後の allowlist 復帰が残る。

## 9. 未対応・制約・リスク

- デプロイ自体はこの作業では未実施。PR merge 後に CDK deploy が必要。
- 独自ドメイン未確定のため `CORS_ALLOWED_ORIGINS=*` を採用したが、外部公開面が広い状態になる。
- ドメイン確定後に `CORS_ALLOWED_ORIGINS` を具体 origin の allowlist に戻す必要がある。
- `npm ci` は pass したが、npm audit は既存の 3 件の vulnerability を報告した。今回の CORS 起動失敗修正とは別タスクで扱う。
