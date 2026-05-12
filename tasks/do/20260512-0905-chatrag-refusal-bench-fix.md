# ChatRAG benchmark refusal 再発防止

状態: in_progress

## 背景

`chatrag-bench-v1` で HTTP / ingest / retrieval は成功している一方、回答可否判定が refusal に倒れて `turnAnswerCorrectRate`、`conversationSuccessRate`、`historyDependentAccuracy` が 0.0 になった。ユーザーの分析では PR #268 相当の未反映または追加の benchmark isolation / selected chunk filtering / latency 対策が優先対応として挙げられている。

## 目的

現在の `origin/main` が PR #268 相当を含むことを確認したうえで、残る再発リスクをコードとテストで抑える。

## タスク種別

修正

## なぜなぜ分析サマリ

- confirmed: worktree の HEAD は `077c68e4 Merge pull request #268 from tsuji-tomonori/codex/fix-chatrag-smoke` で、PR #268 の merge commit を含む。
- confirmed: `text-signals.ts`、`build-conversation-state.ts`、`graph.ts`、`sufficient-context-gate.ts` に、低情報量 token 除外、refusal 文除外、fallback fact phrase 化、grounded partial evidence の通過条件が存在する。
- confirmed: `graph.test.ts` と `node-units.test.ts` に、`chatrag-bench-v1` と refusal 汚染 follow-up の regression test が存在する。
- inferred: 既存修正で主因は解消済みだが、selected chunks に低 score ノイズが残る経路や simple high-confidence で追加検索を続ける経路は latency / 安定性の再発リスクになり得る。
- open_question: 実デプロイ済み API が `077c68e4` を稼働しているかはローカル repository だけでは確認できない。
- root_cause: 失敗ログの主因は、fallback required facts と conversation rewrite が低情報量 token / refusal 文を根拠不足として扱い、retrieved evidence があるのに sufficient context gate が refusal に倒したこと。
- remediation: main 既存修正の regression を確認し、不足する final context score filtering と high-confidence early stop を追加し、benchmark isolation の検証を固定する。

## スコープ

- RAG agent の search / selection / answerability 周辺
- ChatRAG benchmark regression test
- 必要最小限の docs / report / PR コメント

## 実装計画

1. PR #268 相当の実装と既存 regression test を確認する。
2. selected chunks が `minScore` 未満を final context に渡さないことを実装またはテストで保証する。
3. simple high-confidence hit で追加検索を避ける条件を追加または既存実装を確認する。
4. benchmark corpus filter が suite 単位まで効くことをテストで確認する。
5. 変更範囲に応じた API test / diff check を実行する。

## ドキュメント保守方針

外部 API shape や利用手順を変えない場合、durable docs は更新しない。挙動変更の意図と制約は作業レポートと PR 本文に残す。

## 受け入れ条件

- [x] `origin/main` に PR #268 相当が含まれることを確認して記録する。
- [x] ChatRAG の Turn 1 / Turn 2 regression が answer と citation を検証する。
- [x] refusal 文が conversation rewrite に混入しない regression が維持される。
- [x] benchmark request / search filters が `source=benchmark-runner`、`docType=benchmark-corpus`、`benchmarkSuiteId=chatrag-bench-v1` を保持する。
- [x] `minScore` 未満の selected chunk が final answer context に残らない。
- [x] simple high-confidence retrieval で不要な追加検索を避ける。
- [x] 選定した検証コマンドが pass する、または未実施理由を記録する。
- [x] 作業レポートを `reports/working/` に保存する。
- [ ] PR 作成後に受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿する。

## 検証計画

- `git diff --check`
- API targeted tests: `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- --test-name-pattern='chatrag|benchmark|selected|search'` または対象 test file 実行
- 必要に応じて `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`

## PR レビュー観点

- insufficient evidence refusal の安全性を弱めていないこと
- benchmark expected phrases / dataset 固有値を回答生成ロジックに hard-code していないこと
- citations と selected/retrieved の整合性が崩れていないこと
- 低 score noise 除外が answerable case を不当に落とさないこと

## リスク

- 実デプロイ済み API の commit はローカルから直接確認できないため、PR 本文では repository 上の確認とデプロイ確認の分界を明示する。
- 広範な benchmark 実行には外部サービスや時間が必要な可能性があり、ローカルでは targeted test を優先する。

## 実施結果

- `origin/main` / worktree HEAD は `077c68e4 Merge pull request #268 from tsuji-tomonori/codex/fix-chatrag-smoke`。
- `rerank_chunks` に final context の `minScore` filter を追加した。
- simple high-confidence evidence の early stop を追加し、ChatRAG regression で `execute_search_action` が各 turn 1 回になることを確認した。
- 詳細設計 `DES_DLD_001.md` を同期した。
- 作業レポート: `reports/working/20260512-0911-chatrag-refusal-bench-fix.md`

### 実行した検証

- `npm ci`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/agent/nodes/node-units.test.ts src/agent/graph.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass
- `pre-commit run --files ...`: pass

### 未実施・制約

- `task benchmark:chatrag-bench`: 外部 ChatRAG input directory と実行 API endpoint が未確定のため未実施。
- デプロイ済み API の revision 確認: ローカル repository からは未確認。
