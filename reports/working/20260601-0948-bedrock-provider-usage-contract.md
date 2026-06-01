# 作業完了レポート: bedrock provider usage contract

## 受けた指示

- `.workspace/plan-060101.txt` の完了に向け、provider usage を一次データとして UsageEvent に接続する実装・検証を進める。
- 実 AWS 未検証のものを実施済み扱いしない。

## 要件整理

- Bedrock が返す token usage は、tokenizer 推定より優先して `UsageTrackingTextModel` に渡される必要がある。
- 実 AWS を使わない unit test で、Bedrock adapter の `onUsage` contract を固定する。
- production の client 生成挙動は変えない。

## 検討・判断

- `BedrockTextModel` は embedding の `inputTextTokenCount` と Converse の `response.usage` を `onUsage` へ渡していたが、adapter 単体の test がなく regression に弱かった。
- constructor で Bedrock runtime client を任意注入できるようにし、既定値は従来通り `new BedrockRuntimeClient({ region })` とした。

## 実施作業

- `BedrockTextModel` に test client injection を追加した。
- `bedrock.test.ts` を追加し、`InvokeModelCommand` と `ConverseCommand` の fake response から `onUsage` が発火することを確認した。
- `UsageTrackingTextModel` の provider usage test と合わせて、adapter から UsageEvent までの contract を補強した。

## 成果物

- `apps/api/src/adapters/bedrock.ts`
- `apps/api/src/adapters/bedrock.test.ts`
- `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 検証

- `./node_modules/.bin/tsx --test apps/api/src/adapters/bedrock.test.ts apps/api/src/rag/usage-tracking-text-model.test.ts`: pass（9 件）
- `npm run typecheck -w @memorag-mvp/api`: fail（test fake client の暗黙 any）-> 型注釈追加後 pass
- `git diff --check`: pass

## fit 評価

- `.workspace/plan-060101.txt` の provider usage 優先方針について、Bedrock adapter が usage callback を渡すことを AWS なしで検証できるようになった。
- 実 provider usage が `UsageTrackingTextModel` の `provider_usage` / `actual` event に接続される根拠が強くなった。

## 未対応・制約・リスク

- 実 AWS Bedrock 呼び出しで同じ usage が返ることは未検証。
- DynamoDB への実保存は未検証。
- 実 S3 への admin export 保存と署名付き URL の動作は未検証。
- Worktree Task PR Flow の commit / push / PR 作成 / PR コメント / task done 移動は未実施。
