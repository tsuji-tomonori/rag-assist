# RAG quality policy 初回 bootstrap deploy 作業レポート

## 受けた指示

- `memorag-dev-rag-quality@2026-07-16.draft-1` を dev 初期 policy として用いる。
- policy/observations artifact を CD workflow で自動 upload・自動解決する。
- PR を merge し、実際の CDK deploy まで完了する。
- observation を生成するための一回限りの dev bootstrap deploy を実行する。

## 要件整理

- 通常の main push は、完全な observation と promotion pass が無い限り deploy しない。
- bootstrap は dev の手動 dispatch、承認済み policy identity、対象 main SHA の完全一致を必須にする。
- bootstrap でも不足 observation、推定値、合格値を生成しない。
- deploy 成功後に S3 marker を残し、同じ policy の bootstrap 二重実行を拒否する。

## 検討・判断

PR #360 merge 後の run `29460724158` は policy を active 化したが、112 件の observation が不足して deploy を保留した。初期 stack に policy version context を反映しなければ同 version の observation producer が成立せず、その deploy が observation を要求する循環依存が根本原因と判断した。

通常 gate を緩めず、`workflow_dispatch` 専用の明示的 bootstrap 遷移を追加した。authorization は `<main SHA>:<profileId>@<version>` とし、policy identity は今回ユーザー承認された `memorag-dev-rag-quality@2026-07-16.draft-1` に固定した。完了 marker は deploy 成功後だけ作成するため、失敗時の原因修正・再試行は可能で、成功後の二重実行は拒否する。

## 実施作業

- `.github/workflows/memorag-deploy.yml` に限定 bootstrap input、authorization 検証、一回性 marker、完了 artifact を追加した。
- checkout を event の `github.sha` に固定し、authorization 対象と実際の deploy source を一致させた。
- 通常 evidence gate は `ready` のまま維持し、bootstrap を promotion pass として扱わない条件分岐にした。
- `benchmark/promotion-workflow.test.ts` に通常 push の fail-closed、SHA/policy identity、S3 marker の contract test を追加した。
- `OPS_MONITORING_001.md` に初回 bootstrap の条件・一回性・失敗時再試行を追記した。
- main で顕在化した ESLint default-project 上限超過を解消するため、`scripts/tsconfig.json` を追加して scripts を正式な TypeScript project とした。

## 検証

- `ruby -e 'require "yaml"; YAML.safe_load(...)'`: pass
- `node --import tsx --test benchmark/promotion-workflow.test.ts`: pass
- `npx tsc -p scripts/tsconfig.json --noEmit`: pass
- `npm run lint`: pass
- `npm run typecheck --workspaces --if-present`: pass
- `npm run build --workspaces --if-present`: pass（Vite chunk size warning は既存の非 blocking warning）
- `npm test --workspaces --if-present`: pass（contract 1、API 801、Web 442、infra 38、benchmark 102 tests）
- `task docs:check`: pass
- `git diff --check`: pass

最初の YAML parse は Ruby 3.0 が `YAML.load_file(..., aliases:)` を受け付けず失敗した。対応 API の `YAML.safe_load(File.read(...), aliases: true)` へ切り替え、workflow YAML が正常に parse されることを確認した。

## 成果物

- dev 初回 policy bootstrap を制御する deploy workflow
- workflow contract test
- 更新済み monitoring runbook
- scripts 用 TypeScript project
- task: `tasks/do/20260716-0916-rag-policy-bootstrap-deploy.md`

## 指示への fit 評価

repository-local の実装・検証、GitHub PR/CI/merge、実 CDK deploy、一回性 marker、deployment outputs artifact の全てを確認した。承認済み dev policy と自動解決した S3 URI/version context を使い、不足 observation や合格値を合成せずに初回 runtime 反映を完了している。

## 外部実行結果

- PR #362: CI 成功後に merge（`1e332da7c90bfb90e7f48bec1dbc564d4b4226f3`）。初回 bootstrap 制御を導入。
- deploy run `29463654225`: authorization、artifact upload、build、synth は成功。Cognito custom attribute `session_invalid_after` の21文字が AWS 上限20を超え、CloudFormation が rollback。完了 marker は未作成。
- PR #363: attribute を共有 contract の `session_invalid_at`（18文字）へ統一し、CI 成功後に merge（`cc67e6bb0bc52cba534b349e69bbd900f72affe1`）。
- deploy run `29464411514`: 2026-07-16 10:38 JST に CDK deploy、bootstrap completion marker、deployment outputs upload がすべて成功。
- outputs artifact: `memorag-cdk-outputs-dev` / artifact ID `8362469628`。`infra/cdk-outputs.json` と `artifacts/rag-bootstrap/bootstrap-completion.json` を取得して内容を確認。
- policy URI: `s3://memoragmvpstack-documentsbucket9ec9deb9-giqftcaymarh/quality-control/promotion-candidates/2026-07-16.draft-1/cc67e6bb0bc52cba534b349e69bbd900f72affe1/29464411514/policy.json`
- observations URI: 同 prefix の `observations.json`。
- frontend: `https://d1k7muyw0zb6oo.cloudfront.net` は HTTP 200。
- API `/health` と `/openapi.json` の無認証 probe は HTTP 401。現行の認証境界と一致するため、認証済み API smoke は未実施として区別する。

## 未対応・制約・リスク

- bootstrap は promotion pass ではない。deploy 後も observation が揃うまで通常 main push の deploy は保留される。
- production source sample から全必須 observation が収束する時刻と unavailable signal は継続運用の確認対象であり、今回の初回 deploy 完了と区別する。
- Cognito MFA と API WAF の cdk-nag warning、GitHub Actions Node.js 20 deprecation warning は既存の非 blocking warning として残る。
