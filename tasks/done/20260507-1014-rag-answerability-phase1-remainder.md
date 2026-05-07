# RAG 回答可能性 gate Phase 1 残件

保存先: `tasks/done/20260507-1014-rag-answerability-phase1-remainder.md`

状態: done

## 背景

Phase 1 PR は main に merge 済み。benchmark rerun では `answerable_accuracy` が 76.0% から 94.0% へ改善し、誤拒否は 10 件から 1 件へ減った。一方で `ans-010` は、根拠「特別休暇は慶弔など会社が認める事由を対象にします。」が取得されているにもかかわらず、`sufficient_context_gate` が `PARTIAL` / primary missing と判定して拒否している。

## 目的

Phase 1 の残件として、sufficient context judge の supported / missing 判定を required fact id と対応付け、supported span が primary fact を支持している場合に hard refusal へ倒れないようにする。

## 対象範囲

- `memorag-bedrock-mvp/apps/api/src/agent/nodes/sufficient-context-gate.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/prompts.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/node-units.test.ts`
- 必要に応じて `graph.test.ts`
- 作業レポート、PR コメント

## 方針

- 固定語彙や benchmark row id による pattern matching は追加しない。
- `requiredFacts` を prompt 上で fact id / description / necessity を持つ構造として渡す。
- sufficient context judge の `supportedFacts` / `missingFacts` / `conflictingFacts` は required fact id を優先して返す contract に寄せる。
- 既存 judge が自然文を返した場合も、fact id / description 参照のみで後方互換に扱う。
- primary fact id が supported に含まれる場合は、missing の自然文が secondary 的な追加具体化要求でも拒否しない。

## 必要情報

- benchmark artifact: `.workspace/bench_20260507T004152Z_b6398dac`
- 残件: `ans-010`
- 既存方針: 固定語彙 fallback は使わない。

## 実行計画

1. 現行 main の sufficient context prompt / gate / tests を確認する。
2. required fact prompt 表現を fact id contract に更新する。
3. supported / missing / conflicting matching helper を fact id 優先に整理する。
4. ans-010 相当の unit test を追加する。
5. API test / typecheck / diff check を実行する。
6. PR 作成後に受け入れ条件確認とセルフレビューをコメントする。

## ドキュメントメンテナンス計画

- 公開 API shape は変更しない想定。
- README / requirements は既に primary fact supported の `PARTIAL` 継続を説明しているため、prompt contract の内部改善だけなら追加更新不要。
- 変更内容と未実施 benchmark は PR 本文・作業レポートに明記する。

## 受け入れ条件

- [x] sufficient context prompt が required fact id を judge に明示している。
- [x] supported primary fact id がある場合、追加具体化の missing 自然文だけでは hard refusal しない。
- [x] primary fact id が missing / conflicting の場合は拒否経路を維持する。
- [x] 固定語彙、benchmark row id、expected phrase 固有分岐を追加していない。
- [x] 対象 API test / typecheck / `git diff --check` が pass する。

## 検証計画

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- --test-name-pattern "sufficient context|fixed workflow continues"`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`

## PRレビュー観点

- pattern matching に戻っていないか。
- LLM judge の output contract が fact id ベースで追跡可能か。
- unanswerable / primary missing の拒否経路を壊していないか。

## 未決事項・リスク

- 決定事項: benchmark 全量再実行はこの作業内では必須にせず、ユーザーまたは CI の runner で確認する。
- リスク: deployed model が schema instruction に従わない場合は自然文 fallback へ戻るため、fact id 返却率を benchmark debug で監視する必要がある。

## 完了メモ

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/147
- 受け入れ条件確認コメント: https://github.com/tsuji-tomonori/rag-assist/pull/147#issuecomment-4393386618
- セルフレビューコメント: https://github.com/tsuji-tomonori/rag-assist/pull/147#issuecomment-4393387282
- 作業レポート: `reports/working/20260507-1019-rag-answerability-phase1-remainder.md`

## 実行済み検証

- `git diff --check`: pass
- `npm ci`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- --test-name-pattern "sufficient context|fixed workflow continues"`: pass
  - npm script 展開後、API test suite 全体 154 件が実行され全件 pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass

## 未実施

- benchmark 全量再実行は未実施。前回 rerun artifact の残件原因に対する unit test で検証した。
