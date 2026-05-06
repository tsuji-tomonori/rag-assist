# PR review fixes report

## 受けた指示

- PR #120 の review 指摘を受け、Request changes 相当の 4 件を修正する。
- adaptive retrieval、structured fact planning、typed claim conflict、benchmark evaluator profile の問題を実装と regression test で直す。
- 検証し、漏れがないか報告できる状態にする。

## 要件整理

| 要件ID | 指摘 | 対応状況 |
|---|---|---|
| R1 | adaptive retrieval が `MIN_RETRIEVAL_SCORE` を fused score に流用して recall を落とす | 対応 |
| R2 | structured fact の subject に他 facet が混ざり false missing になり得る | 対応 |
| R3 | scope 欠落 typed claim conflict を見逃す | 対応 |
| R4 | benchmark evaluator profile の row 指定と retrieval K が評価に反映されない | 対応 |
| R5 | regression test と docs を更新する | 対応 |

## 実施作業

- `RAG_ADAPTIVE_MIN_COMBINED_SCORE` を追加し、adaptive retrieval の `effectiveMinScore` を `MIN_RETRIEVAL_SCORE` から分離した。
- adaptive fused score の regression test を追加した。
- `inferFactSubject()` と retrieval evaluator の support 判定を調整し、subject と factType anchor/value を分けて評価するようにした。
- multi-facet 質問で金額、期限、手順が別 chunk に分かれる regression test を追加した。
- unscoped claim と scoped claim の値違いを `uncertain_scope_conflict` として扱い、LLM judge 対象にした。
- 明示 scope のない同一 fact conflict は LLM judge の `NO_CONFLICT` で安易に解消しないようにした。
- benchmark evaluator profile の row 指定を no-answer 判定と retrieval recall K に反映した。
- `strict-ja@1` evaluator profile、`retrievalRecallAtK`、search benchmark の profile K 評価を追加した。
- operations、local verification、DLD、data design docs を更新した。

## 検証

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api -- src/agent/graph.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- `git diff --check`: pass
- `API_BASE_URL=http://localhost:8788 task benchmark:sample`: pass

## 未対応・制約・リスク

- `task benchmark:sample` 実行のため、8787 が既存プロセスで使用中だったため 8788 で検証した。
- sandbox 内で起動した API は別ネットワーク名前空間から到達できなかったため、benchmark 実行時は sandbox 外の 8788 を使用した。
- 未対応事項なし。

## fit 評価

総合fit: 5.0 / 5.0

Review 指摘 4 件すべてに対して実装、regression test、docs 更新、検証を行った。
