# FR-054 デプロイ・リリース運用

- 種別: `REQ_FUNCTIONAL`
- 状態: planning
- 仕様参照: `docs/spec/2026-chapter-spec.md` 14C 章
- FR-054: GitHub Actions、OIDC、CDK、cdk-nag、CloudFormation artifact、environment approval を用いて、deploy と release の運用手順を追跡できること。

## 要求

GitHub Actions、OIDC、CDK、cdk-nag、CloudFormation artifact、environment approval を用いて、deploy と release の運用手順を追跡できること。

## 受け入れ条件

- [ ] GitHub Actions は長期 AWS key ではなく OIDC を利用する。
- [ ] CDK synth、cdk-nag、CloudFormation artifact、deploy outputs、smoke test の扱いが文書化される。
- [ ] 本番 secret を repository に保存しない。

## 備考

Phase J / I で詳細化する。
