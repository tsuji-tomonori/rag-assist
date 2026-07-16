# FR-054 デプロイ・リリース運用

- 種別: `REQ_FUNCTIONAL`
- 状態: Draft（部分実装・external 設定未検証）
- 仕様参照: `docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md` 14C 章
- FR-054: GitHub Actions、OIDC、CDK、cdk-nag、CloudFormation artifact、environment approval を用いて、deploy と release の運用手順を追跡できること。

## 要求

GitHub Actions、OIDC、CDK、cdk-nag、CloudFormation artifact、environment approval を用いて、deploy と release の運用手順を追跡できること。

## 受け入れ条件

- [x] GitHub Actions は `id-token: write` と role assumption により OIDC を利用し、workflow に長期 AWS access key を渡さない。
- [ ] CDK synth、cdk-nag、CloudFormation artifact、deploy outputs、smoke test の扱いが文書化される。
- [ ] 本番 secret を repository に保存しない。

## 備考

`deploy.yml` は GitHub environment を job に指定し、OIDC、CDK test/synth、CloudFormation/cdk-nag artifact、deploy output を実装している。deploy 後 smoke test はなく、GitHub environment の required reviewer/approval rule と secret 実体は repository source だけでは検証できない。

## 実装・検証トレース

- `confirmed`: `.github/workflows/deploy.yml` の `permissions.id-token: write`、`aws-actions/configure-aws-credentials` の `role-to-assume`、CDK test/synth、artifact upload、deploy output。
- `confirmed`: `.github/workflows/deploy.yml` は input で選択した GitHub environment を deploy job に設定する。
- `conflict`: AC の smoke test は deploy workflow に存在しないため unchecked のままとする。
- `inferred`: repository source に長期 AWS key の設定はないが、GitHub secret store と environment approval rule の実設定は source から確定できない。
- `open_question`: deploy smoke と external GitHub settings evidence は `tasks/todo/20260716-2141-fr-054-deploy-evidence-completion.md` で追跡する。
