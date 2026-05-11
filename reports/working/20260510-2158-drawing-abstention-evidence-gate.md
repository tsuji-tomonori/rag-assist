# 作業完了レポート

保存先: `reports/working/20260510-2158-drawing-abstention-evidence-gate.md`

## 1. 受けた指示

- 主な依頼: 前回PR merge 後の次の改善を実施する。
- 対象: 建築図面 QARAG の evidence sufficiency / abstention 改善。
- 条件: worktree task PR flow に従い、task、実装、検証、PR、PRコメントまで進める。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 根拠 bbox がない図面回答を通常回答として正解扱いしない | 高 | 対応 |
| R2 | 案件図面と標準図の優先順位を score ではなく rule で評価する | 高 | 対応 |
| R3 | 正規化期待値と回答・根拠値の不一致を検出する | 高 | 対応 |
| R4 | `abstain_accuracy` と `unsupported_answer_rate` を分けて summary / report に出す | 高 | 対応 |
| R5 | 既存 benchmark dataset の互換性を維持する | 高 | 対応 |

## 3. 検討・判断したこと

- 図面向け gate は既存 dataset を壊さないよう、`evidenceSufficiency` がある行だけ評価する optional field とした。
- source hierarchy は検索 score ではなく `sourcePriority` 配列で判定し、`project_drawing` を `standard_detail` より優先できるようにした。
- bbox 判定は citation 直下と metadata の複数キーを受け付け、今後の region detector / OCR crop 実装と接続しやすくした。
- 本番 API の回答生成経路には今回直接入れず、benchmark runner で gate 条件を明示的に測定できるようにした。API 経路の実拒否強化は後続の実装対象。

## 4. 実施作業

- `benchmark/run.ts` に `evidenceSufficiency`、`abstainAccuracy`、`evidenceSufficiencyPassRate` を追加。
- bbox 不足、source priority mismatch、normalized value mismatch の failure reason を追加。
- `benchmark/run.test.ts` に図面 evidence gate の fixture を追加し、bbox、source hierarchy、normalized mismatch、abstain / unsupported の分離を検証。
- README、OPERATIONS、FR-019 要求 docs に新しい field と metric の説明を追加。
- task file を `tasks/do/` に移動し、受け入れ条件と検証結果を更新。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/benchmark/run.ts` | TypeScript | 図面 evidence sufficiency gate と metric 集計 | R1-R4 |
| `memorag-bedrock-mvp/benchmark/run.test.ts` | TypeScript test | gate / abstention / unsupported の regression test | R1-R5 |
| `memorag-bedrock-mvp/README.md` | Markdown | 図面 benchmark optional field の説明 | R4-R5 |
| `memorag-bedrock-mvp/docs/OPERATIONS.md` | Markdown | 運用上の gate / source hierarchy 説明 | R1-R4 |
| `memorag-bedrock-mvp/docs/1_要求_REQ/.../REQ_FUNCTIONAL_019.md` | Markdown | benchmark 指標要求の更新 | R4 |
| `tasks/do/20260510-1433-drawing-abstention-evidence-gate.md` | Markdown | task 状態・受け入れ条件・検証結果 | workflow |

## 6. 実行した検証

- `npm ci`: pass。ただし既存の npm audit 脆弱性 3件（moderate 1、高 2）が報告された。
- `npm run test --workspace @memorag-mvp/benchmark`: pass
- `npm run typecheck --workspace @memorag-mvp/benchmark`: pass
- `git diff --check`: pass

## 7. Fit評価

総合fit: 4.6 / 5.0（約92%）

理由: benchmark 上の根拠 gate、source hierarchy、abstain / unsupported 分離、docs / tests は対応済み。今回の実装は benchmark 評価の gate であり、本番 API が図面 bbox 不足時に必ず refusal へ変換する処理は後続課題として残るため満点ではない。

## 8. 未対応・制約・リスク

- 未対応: 本番 API の回答生成前後に図面専用 bbox / source hierarchy gate を強制する処理は未実装。
- 制約: bbox は現時点では citation / metadata に入っている値を評価する。OCR crop の実測 bbox 生成は別 task。
- リスク: `evidenceSufficiency` を厳しく指定した dataset では、初期段階で回答不能扱いが増え、answerable accuracy が短期的に下がる可能性がある。
