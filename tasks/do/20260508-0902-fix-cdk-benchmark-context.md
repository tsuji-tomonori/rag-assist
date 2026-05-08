# CDK benchmark context failure fix

## 背景

CI で `node -r ts-node/register bin/app.ts` 実行時に `MemoRagMvpStack` が CDK context `benchmarkSourceOwner` を必須として扱い、context 未指定の環境で例外終了している。

## 目的

CDK app の合成・実行確認が、ベンチマーク用 source owner を明示しない CI 環境でも失敗しないように修正する。

## スコープ

- `memorag-bedrock-mvp/infra` の CDK context 参照と既定値設定の確認・修正
- 障害レポートの作成
- なぜなぜ分析の記録
- 関連する最小十分な検証の実行

## 計画

1. CI エラーログと `memorag-mvp-stack.ts` の context 利用箇所を確認する。
2. `benchmarkSourceOwner` が必須になった理由と影響をなぜなぜ分析する。
3. 安全な既定値または context 任意化を実装する。
4. 障害レポートと作業レポートを作成する。
5. infra/CDK 向け検証を実行し、commit/PR/comment まで進める。

## ドキュメント保守方針

挙動変更が CDK context の運用に影響する場合は、README や docs の更新要否を確認する。不要な場合は作業レポートに理由を記録する。

## 受け入れ条件

- [ ] `reports/bugs/` に今回の CI 失敗を説明する障害レポートが作成されている。
- [ ] 障害レポートまたは関連成果物に、事実と推定を分けたなぜなぜ分析が記録されている。
- [ ] CDK app が `benchmarkSourceOwner` context 未指定でも例外終了しない。
- [ ] 変更範囲に見合う infra/CDK 検証が実行され、結果が記録されている。
- [ ] PR 作成後に受け入れ条件の確認結果を日本語コメントで記載する。

## 検証計画

- `git diff --check`
- `task memorag:cdk:test`
- 必要に応じて `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`

## PR レビュー観点

- CI context 未指定時のみ救済し、明示 context の上書き挙動を壊していないこと。
- ベンチマーク用 owner の既定値が認可境界や RAG の根拠性を弱めていないこと。
- benchmark 期待語句・QA sample 固有値・dataset 固有分岐を実装へ入れていないこと。

## リスク

- `benchmarkSourceOwner` の正しい既定値が運用上別途定義されている場合、推定で補うと意図とずれる可能性がある。
- CDK context の変更が snapshot に影響する可能性がある。

## 状態

in_progress
