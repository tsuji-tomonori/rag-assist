# 作業完了レポート

保存先: `reports/working/20260511-2330-fix-chatrag-smoke.md`

## 1. 受けた指示

- 主な依頼: `chatrag-bench-v1` の RAG API end-to-end failure について、計画に基づき実装修正まで進める。
- 成果物: RAG API 修正、benchmark report 改善、回帰テスト、README 更新、PR 作成。
- 条件: worktree task PR flow、受け入れ条件、検証結果の明示、日本語 PR コメント。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 検索済み根拠がある 1 ターン目を過剰 refusal しない | 高 | 対応 |
| R2 | `What about contractors?` の履歴依存 query 化を改善する | 高 | 対応 |
| R3 | source object key 欠損で expand context が node error refusal へ直結しない | 高 | 対応 |
| R4 | benchmark report に失敗原因の debug summary を出す | 中 | 対応 |
| R5 | 関連テストと typecheck を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- 1 ターン目の主因は、英語質問の fallback required facts が `Who` / `can` などの疑問詞・機能語を primary fact として扱い、後段 gate が missing 判定しやすいことと判断した。
- 2 ターン目の主因は、会話状態で assistant refusal 文や弱い英語 function words を topic/entity に混ぜることと判断した。
- `The specified key does not exist.` は expand context / memory source chunk 展開時に manifest の source object が欠損すると node error になり、trace 上 `citation_validation_failed` 扱いになる経路を確認した。
- benchmark 期待文や dataset 固有 branch は実装に入れず、英語 stop word 除外、assistant generic refusal 除外、missing object の非致命化として汎用修正にした。

## 4. 実施した作業

- `build-conversation-state.ts` で assistant の generic refusal 文を topic/entity 抽出から除外し、英語 follow-up の standalone query に subject と topic を残すよう調整した。
- `graph.ts` の required fact fallback で英語疑問詞・機能語を除外し、expand context の source object 欠損を空展開として扱うようにした。
- `search-evidence.ts` の memory source chunk 展開でも source object 欠損を空展開として扱うようにした。
- `graph.test.ts` に ChatRAG VPN 2 ターン回帰テストを追加した。
- `node-units.test.ts` に refusal 文と弱い英語 function words が decontextualized query に混入しないテストを追加した。
- `benchmark/run.ts` と `run.test.ts` に failure debug signals を追加し、Markdown report の失敗行で `citation_validation_failed` / `sufficient_context_missing_fact` などを確認できるようにした。
- `memorag-bedrock-mvp/README.md` に benchmark report の `debug signals` 説明を追記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/graph.ts` | TypeScript | required fact stop word と expand context 欠損耐性 | R1, R3 |
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/build-conversation-state.ts` | TypeScript | conversation topic/entity 抽出と follow-up rewrite 改善 | R2 |
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/search-evidence.ts` | TypeScript | memory source chunk 欠損耐性 | R3 |
| `memorag-bedrock-mvp/benchmark/run.ts` | TypeScript | failure debug signals 出力 | R4 |
| `memorag-bedrock-mvp/apps/api/src/agent/graph.test.ts` | Test | ChatRAG VPN 2 ターン回帰 | R1, R2 |
| `memorag-bedrock-mvp/benchmark/run.test.ts` | Test | debug signals report 回帰 | R4 |
| `memorag-bedrock-mvp/README.md` | Markdown | report 出力説明 | R4 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4.5/5 | 指摘された RAG API 側の主要疑い箇所と report 改善に対応した。 |
| 制約遵守 | 5/5 | 専用 worktree、task md、テスト、作業レポートを実施した。 |
| 成果物品質 | 4.5/5 | dataset 固有分岐ではなく汎用ガードとして実装し、回帰テストを追加した。 |
| 説明責任 | 4.5/5 | 実施検証と未実施の実 CodeBuild 再実行を区別した。 |
| 検収容易性 | 4.5/5 | 失敗原因が summary/report の debug signals で追える。 |

総合fit: 4.6 / 5.0（約92%）
理由: ローカル回帰テストでは smoke failure の原因を再現・修正したが、実際の CodeBuild `chatrag-bench-v1` 再実行はこの作業内では未実施のため満点ではない。

## 7. 実行した検証

- `npm ci`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/agent/nodes/node-units.test.ts src/agent/graph.test.ts`: pass（npm script の glob により API workspace 全 201 tests を実行）
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: fail -> assertion 順序を修正後 pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: fail -> test artifact type を修正後 pass
- `git diff --check`: pass

## 8. 未対応・制約・リスク

- 実際の CodeBuild `chatrag-bench-v1` は、外部実行環境と認証・AWS リソースを使うため未実施。
- ローカルでは mock Bedrock と local store による回帰確認であり、本番モデルの sufficient context judge 出力揺れは残る。
- `The specified key does not exist.` は欠損 source object を非致命化したが、実 S3 key 不整合自体が発生している場合は別途 seed / manifest 側の運用ログ確認が必要。
