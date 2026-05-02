# 作業完了レポート

保存先: `reports/working/20260502-1517-value-mismatch-judge.md`

## 1. 受けた指示

- 前 PR が merge 済みのため、別ブランチで次の作業を進める。
- 未決なら value mismatch や LLM judge あたりを進める。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | main から別 branch / worktree で作業する | 高 | 対応 |
| R2 | value mismatch または LLM judge 周辺を進める | 高 | 対応 |
| R3 | false refusal を避け、検索 routing と trace を強化する | 高 | 対応 |
| R4 | テストとドキュメントを更新する | 中 | 対応 |
| R5 | 実施した検証を正確に記録する | 高 | 対応 |

## 3. 検討・判断したこと

- 全件 LLM judge は latency、cost、テスト安定性の影響が大きいため、今回は deterministic な value mismatch 検出を先に入れた。
- mismatch は回答拒否の最終判断ではなく、`riskSignals` と `conflictingFactIds` に残し、`retrievalQuality=partial` として追加検索へ倒す設計にした。
- scope の違いによる false conflict を避けるため、claim 抽出は sentence 単位で fact を support する文だけを対象にした。
- LLM judge は、今回追加した `riskSignals` を入力にする次段の拡張として残した。

## 4. 実施した作業

- `codex/value-mismatch-judge` branch と `.worktrees/value-mismatch-judge` worktree を作成した。
- `RetrievalEvaluation` に optional な `riskSignals` を追加した。
- `retrieval_evaluator` に期限・金額系の value mismatch 検出を追加した。
- mismatch 検出時は `conflictingFactIds` と `riskSignals[type=value_mismatch]` を trace に残し、追加検索 action を選ぶようにした。
- 同一 scope の期限 mismatch と、旧制度 / 現行制度の scope 差分を区別するテストを追加した。
- RAG 詳細設計に `riskSignals` と value mismatch の routing 方針を追記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/state.ts` | TypeScript | `riskSignals` schema と型を追加 | R2, R3 |
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/retrieval-evaluator.ts` | TypeScript | value mismatch 検出と追加検索 routing を追加 | R2, R3 |
| `memorag-bedrock-mvp/apps/api/src/agent/trace.ts` | TypeScript | risk signal の summary/detail 表示を追加 | R3 |
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/node-units.test.ts` | TypeScript test | 同一 scope mismatch と old/current scope 差分のテストを追加 | R4 |
| `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md` | Markdown | value mismatch routing 方針を追記 | R4 |
| `reports/working/20260502-1517-value-mismatch-judge.md` | Markdown | 作業完了レポート | R5 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---|---|
| 指示網羅性 | 5 | 別 worktree / branch で value mismatch 周辺を実装した |
| 制約遵守 | 5 | repository の report、docs、test 選定ルールに従った |
| 成果物品質 | 4 | deterministic 検出は入れたが、LLM judge 本体は次段に残した |
| 説明責任 | 5 | 実装範囲、判断理由、未対応範囲を明記した |
| 検収容易性 | 5 | 境界テストと trace 出力で確認可能にした |

総合fit: 4.8 / 5.0（約96%）

## 7. 検証

- `npm --prefix memorag-bedrock-mvp install`: PASS
- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`: PASS
- `npm --prefix memorag-bedrock-mvp/apps/api test`: PASS
- `task memorag:verify`: PASS
- `git diff --check`: PASS
- `task docs:check:changed`: 未実行。Taskfile に該当 task が存在しなかったため。

## 8. 未対応・制約・リスク

- LLM judge 本体は未実装。今回の `riskSignals` を入力に、次 PR で uncertain case のみ LLM judge に委譲するのが自然。
- value mismatch の対象は期限・金額系に限定した。可否、ステータス、対象条件の矛盾は今後の拡張対象。
- 期限表現の正規化は heuristic であり、同義表現の完全な正規化までは行っていない。
