# Bedrock cache usage 作業完了レポート

- 日時: 2026-06-01 10:30 JST
- 対象タスク: `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 受けた指示

- `.workspace/plan-060101.txt` の章別仕様 gap 実装を継続する。
- 完了条件を満たすまで完了扱いせず、実施した検証だけを記録する。

## 要件整理

- plan の `UsageEvent` は `cacheReadTokens` / `cacheWriteTokens` を持つ。
- tracking wrapper と pricing catalog は cache token を保存・計算できるが、Bedrock adapter が Converse provider usage の cache token field を転送していないと実 Bedrock 経路で欠落する。

## 検討・判断

- ローカルの AWS SDK 型定義で Converse usage に `cacheReadInputTokens` / `cacheWriteInputTokens` が存在することを確認した。
- `TextModelTokenUsage` の既存 field 名に合わせ、adapter 境界で `cacheReadTokens` / `cacheWriteTokens` に変換する方針にした。

## 実施作業

- `BedrockTextModel.generate()` が provider usage callback に cache read/write token を含めるよう修正した。
- `bedrock.test.ts` の Converse usage test に cache token assertion を追加した。

## 成果物

- `apps/api/src/adapters/bedrock.ts`
- `apps/api/src/adapters/bedrock.test.ts`
- `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 検証

- `./node_modules/.bin/tsx --test apps/api/src/adapters/bedrock.test.ts apps/api/src/rag/usage-tracking-text-model.test.ts apps/api/src/rag/pricing-catalog.test.ts`: pass（15 件）
- `npm run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass

## fit 評価

- Bedrock provider usage から cache token を取り込み、既存の UsageEvent 保存・pricing 計算まで届く経路を補完できた。
- 実 AWS での Converse レスポンス取得までは未実施のため、ローカル SDK 型と adapter unit test による検証に留まる。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 AWS/S3 への admin export 保存と署名付き URL の実ダウンロードは未検証。
- 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。
