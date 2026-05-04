# 作業完了レポート

保存先: `reports/working/20260504-1110-corpus-grounded-clarification.md`

## 1. 受けた指示

- 主な依頼: `rag-assist` に corpus-grounded clarification を追加し、worktree 作成、実装、検証、git commit、main 向け PR 作成まで行う。
- 成果物: API schema / agent workflow / UI / benchmark / docs / tests / 作業レポート / commit / PR。
- 条件: 確認質問は登録済み文書・memory card・検索候補に grounded な候補が複数ある場合に限定し、`回答する / 追加検索する / 確認質問する / 回答不能にする` の分岐を保つ。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `clarification_gate` と `finalize_clarification` を独立 node として追加する | 高 | 対応 |
| R2 | pre-search / post-search の2段で確認質問判定を行う | 高 | 対応 |
| R3 | 確認候補を最大5件にし、memory/evidence/aspect/history の grounding を持たせる | 高 | 対応 |
| R4 | API response に `responseType`、`needsClarification`、`clarification` を後方互換で追加する | 高 | 対応 |
| R5 | UI で確認質問 option を表示し、選択時に `resolvedQuery` を `/chat` へ送る | 高 | 対応 |
| R6 | debug trace に `clarification_gate` の score / reason / option 数 / rejectedOptions を残す | 高 | 対応 |
| R7 | benchmark に確認質問専用 metrics を追加する | 高 | 対応 |
| R8 | docs と受け入れ条件を更新する | 中 | 対応 |

## 3. 検討・判断したこと

- `answerability_gate` は取得済み evidence で回答可能かを見る責務として残し、意図未確定性は `clarification_gate` に分離した。
- Phase 1 方針に合わせ、LLM judge ではなく deterministic heuristic と retrieval signal で実装した。
- option label は公開可能な heading / sectionPath / text / fileName から作り、ACL group、tenant、内部 alias などの private metadata は候補文言に使わない方針にした。
- `responseType` は optional とし、既存 `answer`、`isAnswerable`、`citations`、`retrieved` の後方互換性を維持した。
- `/chat` route の認証・認可境界は変更していない。response schema は確認質問 option に document/file/chunk/heading の最小 grounding だけを返す設計にした。

## 4. 実施した作業

- `.worktrees/corpus-grounded-clarification` に `codex/corpus-grounded-clarification` branch を作成した。
- API agent state / schema / graph に `clarification` state、`clarification_gate`、`finalize_clarification`、`responseType` を追加した。
- Web chat UI に確認質問 option 表示と `resolvedQuery` の直接送信を追加した。
- benchmark runner に `clarificationNeedPrecision`、`clarificationNeedRecall`、`clarificationNeedF1`、`optionHitRate`、`corpusGroundedOptionRate`、`postClarificationAccuracy`、`overClarificationRate`、`clarificationLatencyOverheadMs` を追加した。
- `dataset.clarification.sample.jsonl`、`FR-029`、README、API examples、API design、local verification docs を更新した。
- API / Web / benchmark の型チェック、テスト、全体 verify を実行した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/clarification-gate.ts` | TypeScript | corpus-grounded deterministic clarification gate | R1-R3 |
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/finalize-clarification.ts` | TypeScript | 確認質問 response finalizer | R1, R4 |
| `memorag-bedrock-mvp/apps/web/src/features/chat/components/AssistantAnswer.tsx` 他 | TypeScript/CSS | 確認質問 option UI と送信導線 | R5 |
| `memorag-bedrock-mvp/benchmark/run.ts` | TypeScript | 確認質問 benchmark metrics | R7 |
| `memorag-bedrock-mvp/benchmark/dataset.clarification.sample.jsonl` | JSONL | ambiguous / clear / noanswer sample | R7 |
| `memorag-bedrock-mvp/docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_029.md` | Markdown | 受け入れ条件付き機能要求 | R8 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4.7 / 5 | 独立 gate、API/UI/benchmark/docs/検証まで対応した。history による自動参照解決は既存 API に会話文脈入力がないため、今回の主実装では option 選択文脈に限定した。 |
| 制約遵守 | 5 / 5 | worktree、skill、docs、テスト、report、未実施検証の明記ルールに従った。 |
| 成果物品質 | 4.6 / 5 | deterministic gate とテストを追加し、後方互換を維持した。閾値調整や LLM judge は Phase 3 相当の将来余地。 |
| 説明責任 | 5 / 5 | 判断、成果物、検証、制約を本レポートに整理した。 |
| 検収容易性 | 4.8 / 5 | API/Web/benchmark/docs の変更点と検証コマンドが追える。 |

**総合fit: 4.8 / 5.0（約96%）**

理由: 主要要件は実装・検証済み。会話履歴からの参照解決は現行 `/chat` contract に履歴入力がないため、今回の直接実装範囲では確認 option の `resolvedQuery` 送信を優先した。

## 7. 検証

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp/benchmark test`: pass
- `git diff --check`: pass
- `task memorag:verify`: pass
- `task docs:check`: not run。Taskfile に該当 task が存在しなかったため、`git diff --check` と `task memorag:verify` で代替確認した。

## 8. 未対応・制約・リスク

- 未対応: Phase 3 の LLM judge、Phase 4 の aspect library 永続化は今回の初期 deterministic gate 範囲外。
- 制約: `/chat` request に会話履歴全文を送る contract がないため、「直前会話に対象がある場合の参照解決」は option 選択の `resolvedQuery` 送信導線を優先した。
- リスク: ambiguity score の閾値は sample / unit test ベースの初期値であり、本番 corpus の benchmark 結果に応じて調整が必要。

## 9. 次に改善できること

- conversation history から安全に antecedent を渡す `conversationContext` contract を追加する。
- `retrieval_evaluator` の conflict scope 判定を LLM judge 併用に拡張する。
- aspect library を文書群から生成し、検索失敗時の確認候補に使う。
