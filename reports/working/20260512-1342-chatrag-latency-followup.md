# 作業完了レポート

保存先: `reports/working/20260512-1342-chatrag-latency-followup.md`

## 1. 受けた指示

- 主な依頼: PR #269 merge 後の改善完了状況を確認し、残 TODO があれば対応する。
- 成果物: ChatRAG latency follow-up の実装、テスト、benchmark 確認、PR。
- 条件: 実施していない検証を実施済み扱いしない。作業は worktree / task / PR flow に従う。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | PR #269 merge 後の `chatrag-bench-v1` 改善を確認する | 高 | 対応 |
| R2 | 残 TODO があれば実装する | 高 | 対応 |
| R3 | 正答率 1.0 を維持する | 高 | 対応 |
| R4 | short follow-up の query expansion を抑制する | 高 | 対応 |
| R5 | 不要な `extract_policy_computations` を skip する | 高 | 対応 |
| R6 | 変更範囲に見合う検証を実行する | 高 | 対応 |
| R7 | 作業レポートを保存する | 中 | 対応 |

## 3. 検討・判断したこと

- PR #269 で正答率は回復済みだったため、追加対応は latency TODO に限定した。
- query expansion は multi-hop / comparison の recall を壊さないよう、直前 citation を持つ compact follow-up に限定して 3 本までにした。
- document anchor は `activeDocuments` の先頭ではなく、直前 citation の `fileName` を優先し、検索 isolation と trace の読みやすさを保った。
- policy computation は selected chunk があり、tool intent または質問文が計算・期限・しきい値判定を示す場合だけ実行する方針にした。
- RAG の根拠性は answerability / sufficient context / citation validation / support verification の後段を維持することで担保した。

## 4. 実施した作業

- `build-conversation-state.ts` で generic grounded answer preamble を会話 topic/entity から除外した。
- compact follow-up の retrieval queries を standalone / original / citation file anchor の最大 3 本に制限した。
- `graph.ts` で computation intent がない通常 RAG 質問では `extract_policy_computations` を skip する条件を追加した。
- ChatRAG regression と node unit test に、query 数、refusal 汚染除外、computation skip の確認を追加した。
- 詳細設計 `DES_DLD_001.md` に follow-up query 制御と policy computation 抽出条件を追記した。
- local API で `chatrag-bench-v1` sample benchmark を再実行した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/build-conversation-state.ts` | TypeScript | follow-up query 制御と assistant preamble 除外 | latency TODO 対応 |
| `memorag-bedrock-mvp/apps/api/src/agent/graph.ts` | TypeScript | policy computation skip 条件 | latency TODO 対応 |
| `memorag-bedrock-mvp/apps/api/src/agent/graph.test.ts` | Test | ChatRAG regression 強化 | 回帰防止 |
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/node-units.test.ts` | Test | conversation rewrite regression 強化 | 回帰防止 |
| `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md` | Markdown | 設計説明更新 | docs 同期 |
| `.local-data/chatrag-bench-followup/summary.json` | JSON | local benchmark summary | 検証成果物 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---|---|
| 指示網羅性 | 5 | merge 後確認と残 TODO 実装の両方に対応した |
| 制約遵守 | 5 | worktree / task / docs / report / validation flow に従った |
| 成果物品質 | 5 | query 抑制と computation skip を限定条件で実装し、回帰テストを追加した |
| 説明責任 | 4 | local benchmark は確認済みだが、deploy 済み API revision は未確認 |
| 検収容易性 | 5 | benchmark summary と検証コマンドで確認可能 |

総合fit: 4.8 / 5.0（約96%）

理由: ローカル main / follow-up branch で改善と残 TODO 対応は確認済み。実運用環境への deploy revision 確認は今回の作業範囲外として未確認。

## 7. 検証結果

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/agent/nodes/node-units.test.ts src/agent/graph.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass
- `pre-commit run --files ...`: pass
- local API + `chatrag-bench-v1` sample benchmark: pass
  - `turnAnswerCorrectRate=1`
  - `conversationSuccessRate=1`
  - `historyDependentAccuracy=1`
  - `retrievalRecallAtK=1`
  - `extract_policy_computations` 実行回数: 0
  - retrieval query count: turn1=1, turn2=3

## 8. 未対応・制約・リスク

- deploy 済み API が PR #269 および follow-up PR を含むかは未確認。
- `npm ci` 後の audit で既存の `3 vulnerabilities (1 moderate, 2 high)` が報告されたが、本タスクの変更範囲外として未対応。
- benchmark 実行は sandbox 内の `tsx` IPC pipe 制約で一度失敗し、同じコマンドを権限付きで再実行した。
