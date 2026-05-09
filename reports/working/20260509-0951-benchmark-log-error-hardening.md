# Benchmark log error hardening work report

## 指示

- 性能テストのログ取得で `logs:GetLogEvents` の認可エラーが出ているため改善する。
- エラー内容をそのまま API レスポンスへ出さず、Hono 側のエラーログにとどめる。
- エラー時のレスポンスとログの状況を見直す task を入れる。
- 関連 skill を作成する。

## 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | benchmark CodeBuild log stream を読める IAM resource に修正する | 対応 |
| R2 | unhandled error の詳細を HTTP response へ返さない | 対応 |
| R3 | 詳細は Hono 側の server log に残す | 対応 |
| R4 | task md と skill を追加する | 対応 |
| R5 | 関連テストを実行する | 対応 |

## 検討・判断

- `AWS::Logs::LogGroup.Arn` は末尾に `:*` を含むため、そこへ `:log-stream:*` を連結すると実際の `arn:...:log-group:<name>:log-stream:<stream>` と一致しない。`logGroupName` から log stream ARN を組み立てる方針にした。
- Hono の `HTTPException` は意図した API エラーとして扱い、既存の domain/validation message を維持した。
- AWS SDK 例外などの unhandled error は、`Error.message` を返さず `Internal server error` または `Request failed` に固定した。
- OpenAPI の endpoint shape は変えていないため、恒久 docs 更新は不要と判断した。再発防止は `skills/api-error-response-hardening/SKILL.md` に整理した。

## 実施作業

- `tasks/do/20260509-0951-benchmark-log-error-hardening.md` を作成し、受け入れ条件と検証計画を記載した。
- `skills/api-error-response-hardening/SKILL.md` を追加した。
- `memorag-bedrock-mvp/apps/api/src/error-response.ts` を追加し、unhandled error の安全な response 生成と Hono 側 logging を分離した。
- `memorag-bedrock-mvp/apps/api/src/app.ts` の `app.onError` を更新し、非 HTTP 例外の詳細を response へ返さないようにした。
- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` の `logs:GetLogEvents` resource を log stream ARN に修正した。
- API/infra tests と snapshot を更新した。
- CDK test 用のダミー account `111111111111` が `git-secrets` の false positive になったため、`.gitallowed` で限定許可した。

## 成果物

| 成果物 | 内容 |
|---|---|
| `skills/api-error-response-hardening/SKILL.md` | API エラー応答 hardening の作業手順 |
| `memorag-bedrock-mvp/apps/api/src/error-response.ts` | 安全な unhandled error response と server logging |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | benchmark CodeBuild log stream 読み取り権限の修正 |
| `tasks/do/20260509-0951-benchmark-log-error-hardening.md` | 本件 task と受け入れ条件 |
| `.gitallowed` | 既存 CDK test fixture のダミー account 許可 |

## 検証

- `npm ci`: pass。専用 worktree に依存関係がなかったため実行。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass。意図した IAM resource 差分で snapshot 更新。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `git diff --check`: pass
- commit hook: pass。初回は既存 CDK test fixture のダミー account が `git-secrets` false positive になったため `.gitallowed` を追加して再実行。

## Fit 評価

総合fit: 4.8 / 5.0

主要要件は満たした。デプロイ済み環境への反映は CDK deploy 後であり、この作業内では本番 AWS での実ログ取得までは実施していないため満点ではない。

## 未対応・制約・リスク

- 本番/検証 AWS 環境での実 `GET /benchmark-runs/{runId}/logs` は未実行。ローカルテストと CDK template 検証で確認した。
- 既存の `npm audit` で 3 件の脆弱性が報告されたが、本件依存追加ではなく既存依存の監査結果のため、この task では修正対象外とした。
