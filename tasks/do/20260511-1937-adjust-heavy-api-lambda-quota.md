# Heavy API Lambda quota 調整

- 状態: do
- タスク種別: 修正
- branch: `codex/split-api-lambda-by-route`
- base: `main`
- 対象 PR: https://github.com/tsuji-tomonori/rag-assist/pull/260

## 背景

PR #260 では重い同期 API を `HeavyApiFunction` に分離し、memory を 4096MB に設定していた。ユーザーから「MemorySize は quota があるので 3008 にして、timeout が 30分になっていたら 15分にして」と追加指示があった。

## 目的

Heavy API Lambda の memory を 3008MB に下げ、30分 timeout が存在する場合は 15分へ下げる。CDK assertion / snapshot / 運用 docs を同じ設定に揃える。

## 作業範囲

- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts`
- `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts`
- `memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json`
- `memorag-bedrock-mvp/docs/OPERATIONS.md`
- task / report / PR コメント

## 対象外

- API handler source の変更
- production deploy / smoke
- CodeBuild の長時間 benchmark timeout 変更

## なぜなぜ分析サマリ

- 問題文: PR #260 の `HeavyApiFunction` memory が 4096MB で、利用先の Lambda memory quota / 運用制約に対して過大な設定になり得る。
- 確認済み事実:
  - `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` に `HeavyApiFunction` の `memorySize: 4096` がある。
  - infra test と snapshot、`docs/OPERATIONS.md` に 4096MB の期待値 / 説明がある。
  - `rg` では `Duration.minutes(30)` や Lambda `Timeout: 1800` は見つからなかった。
- 推定原因:
  - 重い同期 API 向けに余裕を持った memory を設定したが、アカウント quota / 運用上限との整合を後段で調整する必要が出た。
- 未確認点:
  - 実 AWS 環境での quota 値と性能影響は未検証。
- 根本原因:
  - 初期 PR の設定値が quota 制約を保守的に避ける 3008MB ではなく 4096MB になっていた。
- 対策:
  - Heavy API Lambda の memory、test 期待値、snapshot、運用 docs を 3008MB に統一する。
  - 30分 timeout がないことを確認し、15分超の Lambda timeout を増やさない。

## 実施計画

1. `HeavyApiFunction` の `memorySize` を 3008 に変更する。
2. infra test の期待値と `docs/OPERATIONS.md` を更新する。
3. snapshot を更新し、infra build/test を実行する。
4. lint / diff check を実行する。
5. 作業レポートを作成し、commit / push する。
6. PR に受け入れ条件確認とセルフレビューをコメントする。
7. task を done に移動して commit / push する。

## ドキュメント保守計画

運用 docs の route 分離説明に含まれる Heavy API Lambda memory 表記を 3008MB に更新する。30分 timeout が見つからない場合は、追加の timeout 記述変更は行わない。

## 受け入れ条件

- [x] `HeavyApiFunction` の MemorySize が 3008MB になっている。
- [x] 30分 timeout が存在しない、または存在する場合は15分へ下げている。
- [x] CDK assertion / snapshot / docs が 3008MB に揃っている。
- [x] 変更範囲に見合う検証が pass している。
- [ ] PR に日本語で受け入れ条件確認とセルフレビューがコメントされている。

## 検証計画

- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/infra`
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`
- `npm --prefix memorag-bedrock-mvp run lint`
- `git diff --check`

## リスク

- MemorySize を 4096MB から 3008MB に下げるため、重い同期 API の性能余裕は減る可能性がある。quota 回避を優先した設定として PR コメントに残す。

## 検証結果

- pass: `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`
- pass: `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/infra`
- pass: `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`
- pass: `npm --prefix memorag-bedrock-mvp run lint`
- pass: `git diff --check`
- pass: `rg -n "MemorySize\\\": 4096|memorySize: 4096|Duration\\.minutes\\(30\\)|Timeout: 1800|TimeoutSeconds\\\\?\\\":1800|1800000" memorag-bedrock-mvp/infra/lib memorag-bedrock-mvp/infra/test memorag-bedrock-mvp/docs/OPERATIONS.md` が空であることを確認
