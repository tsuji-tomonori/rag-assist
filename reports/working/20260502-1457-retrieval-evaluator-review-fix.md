# 作業完了レポート

保存先: `reports/working/20260502-1457-retrieval-evaluator-review-fix.md`

## 1. 受けた指示

- PR #74 の retrieval evaluator について、外部専門家レビューの指摘を踏まえて妥当性を確認し、必要な修正を進める。
- 特に stop term、stop-only fact、conflict signal による即拒否、低 score の term match、境界テストを見直す。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `"期限"`, `"条件"`, `"手順"`, `"方法"` を stop term として雑に除外しない | 高 | 対応 |
| R2 | 汎用語だけの fact を substring fallback で supported にしない | 高 | 対応 |
| R3 | conflict/status cue の regex で `finalize_refusal` に直行しない | 高 | 対応 |
| R4 | low score chunk の term match を supported にしない | 高 | 対応 |
| R5 | 境界テストを追加し、既存 verify を通す | 高 | 対応 |
| R6 | 関連設計ドキュメントを更新する | 中 | 対応 |

## 3. 検討・判断したこと

- `retrieval_evaluator` は回答可能性の最終判定ではなく、検索継続・rerank への routing heuristic として扱う方針に寄せた。
- `"期限"` などは compound term では有用なため stop term から外しつつ、単独 fact の場合は汎用語として supported 判定に使わないようにした。
- 期限系 fact は term の存在だけでは値が取れたことにならないため、日付、営業日、翌月、以内、まで等の value anchor を要求した。
- `廃止`、`無効`、`取消`、`矛盾` のような cue は初期 heuristic で拒否確定に使わず、後段 gate または追加検索に委ねる設計へ修正した。

## 4. 実施した作業

- `retrieval-evaluator.ts` から `hasConflictSignal()` による `conflicting` / `answerability=false` / `finalize_refusal` 直行を除去した。
- fact support 判定に `minTopScore` 以上の chunk だけを使うようにした。
- stop term を `"回答"`、`"質問"` に限定し、`"資料"`、`"方法"`、`"手順"`、`"条件"`、`"期限"` は単独汎用語として扱う判定に分けた。
- evaluator 単体テストに、汎用語だけの fact、compound fact、値なし期限、旧制度廃止表現、低 score term match の境界ケースを追加した。
- RAG 詳細設計に、初期 heuristic が conflict/status cue で拒否確定しないことを追記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/retrieval-evaluator.ts` | TypeScript | conservative な fact coverage routing へ修正 | R1-R4 |
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/node-units.test.ts` | TypeScript test | 境界テストを追加 | R5 |
| `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_001.md` | Markdown | evaluator の判定方針を更新 | R6 |
| `reports/working/20260502-1457-retrieval-evaluator-review-fix.md` | Markdown | 作業完了レポート | 共通ルール |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---|---|
| 指示網羅性 | 5 | 外部レビューの merge 前修正項目をすべて反映した |
| 制約遵守 | 5 | repo の作業レポート、テスト選定、docs 更新ルールに従った |
| 成果物品質 | 4 | 初期 heuristic としては安全寄りだが、fact-level LLM judge や本格 conflict candidate 抽出は未実装 |
| 説明責任 | 5 | 判断理由、実施内容、未対応範囲を記録した |
| 検収容易性 | 5 | テストケースとドキュメントで挙動を確認しやすくした |

総合fit: 4.8 / 5.0（約96%）

## 7. 検証

- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`: PASS
- `npm --prefix memorag-bedrock-mvp/apps/api test`: PASS
- `task memorag:verify`: PASS
- `git diff --check`: PASS
- `task docs:check:changed`: 未実行。Taskfile に該当 task が存在しなかったため。

## 8. 未対応・制約・リスク

- `retrievalQuality=conflicting` の本格判定は未実装。今後、同一 fact/scope の value mismatch や LLM judge を入れる段階で扱う。
- `riskSignals` フィールドは今回追加していない。state schema 拡張が必要になるため、次 PR 以降の対象とした。
- 期限系 value anchor は heuristic であり、全ての日本語表現を網羅するものではない。
