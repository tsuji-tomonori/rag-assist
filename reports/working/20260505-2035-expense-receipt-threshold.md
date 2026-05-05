# 作業完了レポート

保存先: `reports/working/20260505-2035-expense-receipt-threshold.md`

## 1. 受けた指示

- worktree を作成して作業する。
- `memorag-bedrock-mvp/benchmark/corpus/standard-agent-v1/handbook.md` 指定時に「5200円の経費精算では領収書いる?」が「資料からは回答できません。」になる原因をなぜなぜ分析し、改善する。
- 変更を git commit し、GitHub Apps を利用して `main` 向け PR を作成する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | worktree で作業する | 高 | 対応 |
| R2 | 回答不能の原因を分析する | 高 | 対応 |
| R3 | 対象質問に回答できるよう改善する | 高 | 対応 |
| R4 | 関連検証を実行する | 高 | 対応 |
| R5 | commit と PR を作成する | 高 | commit/PR 作成前のレポートとして記録 |

## 3. 検討・判断したこと

- 対象質問は単なる検索ではなく、資料内条件「1万円以上の経費精算では領収書の添付が必要」と質問中の金額「5200円」の閾値比較を必要とする。
- 既存実装では `5200円 < 1万円` の導出が `computedFacts` に残らず、十分性判定や回答支持検証で「不要」という結論が資料外推論扱いになりうると判断した。
- `1万円` が一部の金額根拠判定で金額として扱われない点も、なぜなぜ分析上の補助原因として修正した。
- LLM に暗算させず、retrieval 後に文書根拠つき `threshold_comparison` を deterministic に生成し、回答生成・十分性判定・支持検証へ渡す方針を採用した。

## 4. 実施した作業

- `codex/fix-expense-receipt-answer` ブランチの worktree を `origin/main` から作成した。
- `threshold_comparison` computed fact を追加し、質問金額と文書中の金額閾値条件を比較できるようにした。
- `execute_computation_tools` が retrieval 後の selected chunks を使えるようにした。
- final answer、sufficient context、answer support の prompt で閾値比較 computed fact を system-derived evidence として扱うよう更新した。
- `万円` / `千円` を金額根拠として認識するよう answerability 判定を補正した。
- Mock model とユニットテストを更新し、対象質問の回帰テストを追加した。
- Computation Layer の設計文書を更新した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/computation.ts` | TypeScript | 文書根拠つき金額閾値比較の computed fact 生成 | R3 |
| `memorag-bedrock-mvp/apps/api/src/rag/prompts.ts` | TypeScript | computed fact を十分性・回答・支持検証に反映 | R3 |
| `memorag-bedrock-mvp/apps/api/src/agent/graph.test.ts` | TypeScript test | 対象質問の回帰テスト | R4 |
| `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_005.md` | Markdown | Computation Layer 設計更新 | R3 |

## 6. 検証

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- --test-name-pattern "threshold comparison|computation layer|tool intent"`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- 対象 handbook corpus をローカル mock service に ingest し、「5200円の経費精算では領収書いる?」が answerable かつ `threshold_comparison` を返すことを確認: pass
- `git diff --check`: pass
- `pre-commit run --files <changed-files>`: pass

## 7. 指示へのfit評価

総合fit: 4.8 / 5.0（約96%）

理由: worktree 作成、原因分析、実装、回帰テスト、対象 corpus での確認まで対応した。PR 作成はこのレポート作成後に実施するため、レポート時点では commit/PR の結果のみ未反映。

## 8. 未対応・制約・リスク

- 実 LLM / Bedrock ではなくローカル mock service で対象 corpus の動作確認を行った。prompt 側も更新しているため本番 LLM での改善意図は反映済みだが、外部モデル応答の完全一致は未保証。
- 閾値比較は MVP として、金額条件と「必要」系の明示文を対象にしている。複雑な例外条件や複数条件の組み合わせは今後の拡張余地がある。
