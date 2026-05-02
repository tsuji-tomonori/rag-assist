# 作業完了レポート

保存先: `reports/working/20260502-1425-fulltext-agent-hybrid-search.md`

## 1. 受けた指示

- 主な依頼: Athena ではなく全文検索のより良い実装を本筋として、未達だったタスクを別ブランチで先に進める。
- 成果物: agent の通常 RAG 検索経路への hybrid full-text retriever 統合、debug trace の検索内訳、関連テストと docs 更新。
- 形式・条件: repository local skill と AGENTS.md の実装、セキュリティ、テスト、作業レポート方針に従う。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 別ブランチ / worktree で進める | 高 | 対応 |
| R2 | `/chat` の agent 検索経路に hybrid full-text retrieval を統合する | 高 | 対応 |
| R3 | trace に lexical / semantic / RRF の内訳を残す | 高 | 対応 |
| R4 | `/search` の静的 access-control policy を確認する | 高 | 対応済みを確認 |
| R5 | 実装に合わせて docs を更新する | 中 | 対応 |
| R6 | 最小十分な検証を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- 最新 `origin/main` では `/search` の静的 access-control policy はすでに追加済みだったため、追加修正は不要と判断した。
- `/chat` の `search_evidence` は vector search 直呼びだったため、既存の `searchRag` を再利用して BM25 / CJK n-gram / prefix / ASCII fuzzy / alias / S3 Vectors / RRF を同じ経路に統合した。
- `searchRag` は agent の `embed_queries` が生成した vector を再利用できるよう、内部用の `semanticVector` を受け取れるようにした。
- chat route の `AppUser` を service / agent へ渡し、hybrid retrieval 側の ACL guard が通常回答経路でも働くようにした。
- answerability gate の既存 score 閾値と衝突しないよう、agent に戻す `RetrievedVector.score` は semantic score、lexical score、cheap rerank score から回答可能性判定向けに正規化した。

## 4. 実施した作業

- `codex/fulltext-agent-hybrid-search` ブランチの worktree を作成した。
- `search-evidence.ts` を `searchRag` 経由に変更し、複数 query の結果を chunk key で重複排除するようにした。
- `runQaAgent` / `createQaAgentGraph` / `MemoRagService.chat` / `/chat` route に user 受け渡しを追加した。
- `ActionObservation` に retrieval diagnostics を追加し、`execute_search_action` trace detail / output に query count、index / alias version、lexical / semantic / fused count、source count を出すようにした。
- `DES_DLD_002.md` を更新し、agent integration と trace diagnostics を現行設計として反映した。
- agent workflow / node unit test に retrieval diagnostics の確認を追加した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/search-evidence.ts` | TypeScript | agent 検索を hybrid full-text retriever に統合 | R2, R3 |
| `memorag-bedrock-mvp/apps/api/src/search/hybrid-search.ts` | TypeScript | 既存 embedding vector の再利用に対応 | R2 |
| `memorag-bedrock-mvp/apps/api/src/agent/state.ts` | TypeScript | retrieval diagnostics state を追加 | R3 |
| `memorag-bedrock-mvp/apps/api/src/agent/trace.ts` | TypeScript | trace detail / output に検索内訳を追加 | R3 |
| `memorag-bedrock-mvp/apps/api/src/agent/graph.ts` | TypeScript | user を agent graph に渡し、action summary を hybrid 検索化 | R2, R3 |
| `memorag-bedrock-mvp/apps/api/src/app.ts` | TypeScript | `/chat` と `/benchmark/query` から user を service に渡す | R2 |
| `memorag-bedrock-mvp/apps/api/src/agent/graph.test.ts` | Test | debug trace diagnostics の検証追加 | R3, R6 |
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/node-units.test.ts` | Test | search node diagnostics の検証追加 | R3, R6 |
| `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_002.md` | Markdown | agent integration の設計反映 | R5 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4.6 / 5 | agent への hybrid retrieval 統合と trace は対応。実データ benchmark は未実施。 |
| 制約遵守 | 4.7 / 5 | セキュリティ境界、docs maintenance、未実施検証の明記を守った。 |
| 成果物品質 | 4.5 / 5 | 既存 `searchRag` を再利用し、重複した検索実装を増やさなかった。 |
| 説明責任 | 4.6 / 5 | score 正規化、ACL user 受け渡し、trace diagnostics を記録した。 |
| 検収容易性 | 4.5 / 5 | 対象ファイルと検証コマンドを限定して確認しやすくした。 |

総合fit: 4.6 / 5.0（約92%）

理由: 本懐である通常 RAG 回答経路への全文検索統合は進んだ。一方で、実データセットによる Recall@20 / MRR@10 の継続 benchmark と永続 lexical index はまだ未対応である。

## 7. 検証

- `npm --prefix memorag-bedrock-mvp install`: Passed
- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`: Passed
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/agent/graph.test.ts src/agent/nodes/node-units.test.ts src/search/hybrid-search.test.ts src/security/access-control-policy.test.ts`: Passed, 58 tests
- `npm --prefix memorag-bedrock-mvp run lint`: Passed
- `npm --prefix memorag-bedrock-mvp/apps/api run build`: Passed
- `git diff --check`: Passed

## 8. 未対応・制約・リスク

- 未対応事項: 実データ benchmark による Recall@20 / MRR@10 の測定は未実施。
- 未対応事項: S3 上の immutable lexical index 生成 / ロードは未実装。
- 制約: `npm --prefix memorag-bedrock-mvp/apps/api test -- ...` は package script の glob により API test 全体も実行された。
- リスク: lexical score の retrieval score 正規化は初期値であり、benchmark 結果に基づく調整が必要。
