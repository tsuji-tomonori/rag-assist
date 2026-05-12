# ChatRAG refusal benchmark 修正 作業レポート

## 指示

- `chatrag-bench-v1` の失敗分析に基づき、PR #268 相当の反映確認、benchmark corpus isolation、低 score chunk 除外、simple query early stop、回帰テスト追加を進める。
- 計画で止まらず、実装・検証・PR 作成まで進める。
- リポジトリの Worktree Task PR Flow、検証、作業レポート、PR コメント規約に従う。

## 要件整理

| 要件ID | 要件 | 対応 |
|---|---|---|
| R1 | `origin/main` が PR #268 相当を含むことを確認する | 対応 |
| R2 | ChatRAG refusal 汚染の regression を維持する | 対応 |
| R3 | benchmark corpus filter の suite isolation を確認する | 対応 |
| R4 | `minScore` 未満の selected chunk を final context から除外する | 対応 |
| R5 | simple / high-confidence hit で不要な追加検索を避ける | 対応 |
| R6 | 変更範囲に見合う検証を実行する | 対応 |
| R7 | durable docs の更新要否を確認し、必要分を同期する | 対応 |

## 検討・判断

- worktree の HEAD は `077c68e4 Merge pull request #268 from tsuji-tomonori/codex/fix-chatrag-smoke` で、PR #268 の merge commit を含んでいた。
- 既存 main には signal term 抽出、refusal 文除外、fallback required fact phrase 化、grounded partial evidence 通過、ChatRAG regression test が入っていたため、主因修正は既に反映済みと判断した。
- 追加対策として、低 score chunk が rerank 後に final answer context へ残る経路と、simple high-confidence evidence 取得後の追加検索継続を抑える経路を修正した。
- 外部 API shape は変えないが、RAG 詳細設計と同期すべき内部挙動変更のため `DES_DLD_001.md` を更新した。

## 実施作業

- `tasks/do/20260512-0905-chatrag-refusal-bench-fix.md` を作成し、RCA、受け入れ条件、検証計画を記載した。
- `rerank_chunks` で `selectedChunks` に渡す前に `chunk.score >= state.minScore` を適用した。
- `evaluateSearchProgress` に simple high-confidence evidence の early stop 条件を追加した。
- high-confidence threshold を `ragRuntimePolicy.retrieval.highConfidenceTopScore = 0.9` として集約した。
- ChatRAG regression test に `execute_search_action` が 1 回で止まる確認を追加した。
- rerank unit test に `minScore` 未満の final context 除外を追加した。
- `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md` に検索評価と rerank の設計説明を追記した。

## 成果物

| 成果物 | 内容 |
|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/graph.ts` | simple high-confidence evidence の追加検索抑制 |
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/rerank-chunks.ts` | final answer context の `minScore` filter |
| `memorag-bedrock-mvp/apps/api/src/agent/runtime-policy.ts` | high-confidence threshold 集約 |
| `memorag-bedrock-mvp/apps/api/src/agent/graph.test.ts` | ChatRAG search 1 iteration regression |
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/node-units.test.ts` | low score selected chunk 除外 regression |
| `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md` | 設計同期 |
| `tasks/do/20260512-0905-chatrag-refusal-bench-fix.md` | task 管理 |

## 検証

### 実行した検証

- `npm ci`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/agent/nodes/node-units.test.ts src/agent/graph.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass
- `pre-commit run --files ...`: pass

### 未実施・制約

- `task benchmark:chatrag-bench`: 未実施。外部 ChatRAG input directory と実行 API endpoint がこの worktree だけでは確定できないため、ローカル API regression test を優先した。
- デプロイ済み API の commit 確認: 未実施。ローカル repository では `origin/main` の merge commit までは確認できるが、稼働中環境の deployed revision は外部環境情報が必要。

## Fit 評価

総合fit: 4.6 / 5.0（約92%）

主要な再発防止策、テスト、設計同期、検証は完了した。実デプロイ済み API の revision 確認と実 benchmark 再実行は、この worktree 内のローカル情報だけでは完了できないため満点ではない。

## リスク・補足

- simple high-confidence early stop は追加検索を減らすが、answerability / sufficient context / citation validation / support verification は従来どおり後段で実行されるため、根拠不足の推測回答へ直接進む変更ではない。
- `npm ci` 後に `npm audit` が 3 件の既存脆弱性を報告したが、今回の変更範囲外のため修正していない。
