# ChatRAG post-merge duplicate fix

状態: done

## 背景

PR #271 merge 後に main を `origin/main` へ fast-forward し、対象 API typecheck / test を実行したところ、`memorag-bedrock-mvp/apps/api/src/agent/graph.ts` で `shouldExtractPolicyComputations` が重複定義されていた。

## 目的

PR #270 / #271 merge 後の `graph.ts` 重複定義を解消し、main の API test / typecheck を復旧する。

## タスク種別

修正

## なぜなぜ分析サマリ

- confirmed: PR #271 は `2026-05-12T04:56:28Z` に merge 済み。
- confirmed: main 同期後の typecheck で `src/agent/graph.ts` の duplicate function implementation が発生した。
- confirmed: `graph.ts` には `shouldExtractPolicyComputations` が 2 件存在し、前半は PR #271 の generic cue 実装、後半は既存の document threshold comparison 実装だった。
- confirmed: test 実行でも `The symbol "shouldExtractPolicyComputations" has already been declared` により `graph.test.ts` が失敗した。
- inferred: PR #270 と PR #271 が同じ helper 名の近接領域を変更し、GitHub merge では text conflict として検出されず、semantic duplicate が残った。
- root_cause: post-merge main 上で同名 helper の統合確認が未実施だったため、compile-time duplicate が main に入った。
- remediation: helper を 1 件に統合し、PR #271 の skip intent と PR #270 の document threshold comparison 判定の両方を保持する。

## スコープ

- `memorag-bedrock-mvp/apps/api/src/agent/graph.ts`
- 必要な regression test が既存で不足する場合のみ最小追加
- task / work report / PR

## 実装計画

1. duplicate helper の意図を確認する。
2. `shouldExtractPolicyComputations` を 1 件に統合する。
3. selected chunk なしでは skip、arithmetic / aggregation は実行、temporal / deadline は skip、通常 RAG では document threshold comparison または computation cue のみ実行する。
4. targeted API test / typecheck を実行する。
5. work report、commit、PR、受け入れ条件コメント、セルフレビューコメントまで進める。

## ドキュメント保守方針

挙動の新規変更ではなく merge 後の duplicate 解消のため、既存設計 docs の追加更新は不要見込み。実装上の意図が不足する場合のみ最小コメントまたは docs 更新を検討する。

## 受け入れ条件

- [x] `graph.ts` の duplicate function implementation が解消される。
- [x] PR #271 の通常 RAG computation skip が維持される。
- [x] PR #270 側の document threshold comparison 判定が維持される。
- [x] API typecheck が pass する、または依存不足などの未実施理由を記録する。
- [x] 対象 API test が pass する、または依存不足などの未実施理由を記録する。
- [x] 作業レポートを `reports/working/` に保存する。
- [x] PR 作成後に受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿する。

## PR

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/272
- 受け入れ条件確認コメント: https://github.com/tsuji-tomonori/rag-assist/pull/272#issuecomment-4427485140
- セルフレビューコメント: https://github.com/tsuji-tomonori/rag-assist/pull/272#issuecomment-4427486191

## 検証結果

- `npm ci`: pass
  - 既存 audit: `3 vulnerabilities (1 moderate, 2 high)`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/agent/nodes/node-units.test.ts src/agent/graph.test.ts`: pass, 211 tests
- `git diff --check`: pass

## 検証計画

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/agent/nodes/node-units.test.ts src/agent/graph.test.ts`
- `git diff --check`
- `pre-commit run --files ...`

## リスク

- computation extraction の実行条件を狭めすぎると policy threshold QA の computed facts を落とす。
- 条件を広げすぎると PR #271 の latency 改善が戻る。
