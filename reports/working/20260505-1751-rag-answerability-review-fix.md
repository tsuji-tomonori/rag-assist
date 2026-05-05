# 作業完了レポート

保存先: `reports/working/20260505-1751-rag-answerability-review-fix.md`

## 1. 受けた指示

- PR #111 のレビュー指摘に対応し、`sufficient-context-gate` のフォールバックが `UNANSWERABLE` や曖昧質問で誤回答へ倒れるリスクを抑える。
- `missingFacts` がある `PARTIAL` 判定では、回答生成へ進めないようにする。
- UNANSWERABLE / ambiguous / partial missing fact の回帰テストを追加する。
- 変更を検証し、git commit と push により PR へ反映する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | フォールバックを `PARTIAL` 判定に限定する | 高 | 対応 |
| R2 | `UNANSWERABLE` をフォールバックで上書きしない | 高 | 対応 |
| R3 | subject がない generic cue を回答生成条件にしない | 高 | 対応 |
| R4 | `missingFacts` がある場合は回答生成へ進めない | 高 | 対応 |
| R5 | 指摘された回帰テストを追加する | 高 | 対応 |
| R6 | 変更後に API test / typecheck / lint / benchmark を実行する | 高 | 対応 |
| R7 | 作業レポートを残し、commit / push / PR 反映まで行う | 高 | レポート作成時点では commit / push 前 |

## 3. 検討・判断したこと

- 前回の answerable-only benchmark 改善を維持しつつ、未評価だった unanswerable / ambiguous 領域を壊さないことを優先した。
- `UNANSWERABLE` は sufficient-context judge の強い否定判定なので、後段検証に委ねず、その場で refusal に倒す設計へ戻した。
- `PARTIAL` のみ例外的に通す場合でも、supported facts または supporting chunk が存在し、missing / conflicting facts がなく、質問 subject と answer cue が根拠本文にある場合へ限定した。
- `missingFacts` の語句部分一致で許可する旧条件は、承認者・部署・条件系の欠落を見逃すため削除した。
- `benchmark:sample` の `answer_contains` 改善には `MockBedrockTextModel` の文選択改善が含まれるため、本番 LLM での効果は実モデルまたは既存 API benchmark で別途確認が必要と整理した。

## 4. 実施した作業

- `memorag-bedrock-mvp/apps/api/src/agent/nodes/sufficient-context-gate.ts` を修正した。
  - `canProceedWithGroundedPartialEvidence` を `judgement.label === "PARTIAL"` のみに限定。
  - `supportedFacts` または `supportingChunkIds` の存在を要求。
  - `missingFacts` / `conflictingFacts` がある場合はフォールバック不可。
  - subject term が空の場合は direct answer cue を満たさないように変更。
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/node-units.test.ts` に以下の回帰テストを追加した。
  - `UNANSWERABLE` 判定を上書きしない。
  - subject のない generic partial 質問を refusal のままにする。
  - `missingFacts` を持つ `PARTIAL` 判定を refusal のままにする。
- 実装ドキュメント影響を確認した。API route、公開仕様、運用手順、README への変更は不要と判断した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/sufficient-context-gate.ts` | TypeScript | sufficient-context fallback の安全化 | R1-R4 |
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/node-units.test.ts` | TypeScript test | UNANSWERABLE / generic / missingFacts 回帰テスト | R5 |
| `reports/working/20260505-1751-rag-answerability-review-fix.md` | Markdown | 作業内容、判断、検証結果、fit 評価 | R7 |

## 6. 検証結果

| コマンド | 結果 | メモ |
|---|---|---|
| `./node_modules/.bin/tsx --test apps/api/src/agent/nodes/node-units.test.ts apps/api/src/agent/graph.test.ts` | pass | 42 tests pass |
| `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api` | pass | TypeScript noEmit |
| `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api` | pass | 114 tests pass |
| `npm --prefix memorag-bedrock-mvp run lint` | pass | ESLint max-warnings=0 |
| `git diff --check` | pass | whitespace check |
| `task benchmark:sample` | pass | 50/50 HTTP success |

`task benchmark:sample` の主な結果:

- `answerableAccuracy`: 92.0%
- `overClarificationRate`: 0.0%
- `answerContainsRate`: 92.0%
- `citationHitRate`: 100.0%
- `expectedFileHitRate`: 100.0%
- `retrievalRecallAt20`: 100.0%
- `p95LatencyMs`: 216ms

## 7. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---|---|
| 指示網羅性 | 5/5 | review 指摘4点に対応し、指定された回帰観点をテスト化した |
| 制約遵守 | 5/5 | 日本語レポート、未実施検証の虚偽記載なし、既存作業範囲内で修正した |
| 成果物品質 | 4.5/5 | answerable benchmark を維持しつつ安全側条件を追加した |
| 説明責任 | 5/5 | mock benchmark caveat と本番 LLM 未検証リスクを明記した |
| 検収容易性 | 5/5 | 変更ファイル、検証コマンド、主要メトリクスを明示した |

総合fit: 4.9 / 5.0（約98%）

理由: レビュー指摘に対する実装・テスト・検証は完了した。本番 LLM での実測評価はこのローカル sample benchmark では代替できないため、軽微な残リスクとして残る。

## 8. 未対応・制約・リスク

- 本番 LLM または既存 API benchmark での実測は未実施。
- `benchmark:sample` は answerable-only dataset であり、unanswerable / ambiguous の網羅評価は追加ユニットテストで補完した。
- sample benchmark の `answer_contains` 改善には mock 文選択改善が含まれるため、本番品質改善として読むには別途確認が必要。
