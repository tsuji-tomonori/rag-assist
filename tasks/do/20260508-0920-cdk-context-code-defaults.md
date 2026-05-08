# CDK context code defaults cleanup

## 背景

PR #185 で `benchmarkSourceOwner` context 不足による CDK synth 失敗を修正したが、workflow から benchmark source context を明示注入する形が残っている。ユーザーから、CDK の context 外部注入がベストプラクティスとして妥当か調べたうえで、CDK コード側に書くよう追加対応する指示があった。

## 目的

Benchmark runner の固定 source は CDK コード側の既定値として管理し、GitHub Actions workflow から同じ値を重複注入しない状態に整理する。

## スコープ

- AWS CDK 公式情報に基づく context 利用方針の整理
- `.github/workflows/` から benchmark source context の重複注入を削除
- docs の記述を CDK コード側既定値方針へ更新
- 関連する infra/CDK 検証

## 計画

1. AWS CDK 公式 docs で context の用途、`--context`、`cdk.json`、コード内 default の扱いを確認する。
2. main から作成した専用 worktree で workflow/docs を修正する。
3. 既存 infra test がコード側既定値と上書き可能性を保証していることを確認する。
4. CDK synth/test と markdown/yaml 検証を実行する。
5. レポート、commit、PR、PR コメントまで完了する。

## ドキュメント保守方針

GitHub Actions deploy docs は今回の挙動変更に直結するため更新する。README、API docs、OpenAPI は対象外のため、変更不要と判断した理由を作業レポートに残す。

## 受け入れ条件

- [ ] AWS CDK 公式情報に基づき、context 外部注入の適否が作業レポートまたは PR 本文に記録されている。
- [ ] benchmark source の固定値は CDK コード側の既定値として管理されている。
- [ ] GitHub Actions workflow から `benchmarkSourceOwner` / `benchmarkSourceRepo` / `benchmarkSourceBranch` の重複注入が削除されている。
- [ ] docs が CDK コード側既定値方針と整合している。
- [ ] 変更範囲に見合う検証が pass している。
- [ ] PR 作成後に受け入れ条件の確認結果を日本語コメントで記載する。

## 検証計画

- `git diff --check`
- `pre-commit run --files <changed-files>`
- `task memorag:cdk:synth:yaml`
- `task memorag:cdk:test`

## PR レビュー観点

- CDK コード側既定値と context override の責務が明確であること。
- workflow から固定値の重複注入を外しても synth/deploy が成立すること。
- docs と実装が矛盾していないこと。
- RAG の根拠性・認可境界、benchmark 固有値分岐を弱めていないこと。

## リスク

- GitHub Actions 上の実 CI は PR 作成後に確認が必要。
- 別リポジトリを benchmark source にする環境では、CDK context override の明示運用が必要。

## 状態

in_progress
