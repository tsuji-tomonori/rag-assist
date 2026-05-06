# 作業完了レポート

保存先: `reports/working/20260506-2246-mmrag-docqa-production-defaults.md`

## 1. 受けた指示

- 主な依頼: MMRAG-DocQA の本番 PDF / 質問データ未確定事項について、何を決めたいか整理し、推奨値で決める。
- 条件: 現在の PR #133 の文脈に合わせ、実装に進められる粒度で記録する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 未確定事項を具体化する | 高 | 対応 |
| R2 | 推奨値を決定する | 高 | 対応 |
| R3 | task / docs に反映する | 高 | 対応 |
| R4 | 実データ実装と決定作業を分離する | 中 | 対応 |

## 3. 検討・判断したこと

- arXiv `2508.00579` は現行 title が `MHier-RAG` に更新されているが、既存 UI / PR 互換のため suite ID は `mmrag-docqa-v1` を維持する判断にした。
- 論文の評価対象である `MMLongBench-Doc` と `LongDocURL` のうち、default managed benchmark は規模と schema の扱いやすさから `MMLongBench-Doc` にした。
- `LongDocURL` は 34k pages 規模の stress benchmark として価値があるが、PR gate や UI default には重すぎるため分離する判断にした。
- PDF は repository に commit せず、CodeBuild / local prepare step で参照 PDF のみ download する方針にした。
- 現在の runner が持つ `expectedFiles`、`expectedPages`、`expectedFactSlots`、`referenceAnswer`、`expectedContains` へ dataset schema を寄せる方針にした。

## 4. 実施した作業

- `MMRAG_DOCQA_CONFIRMATION_PROMPT.md` に推奨決定値の table を追加した。
- `tasks/todo/20260506-2049-mmrag-docqa-production-dataset.md` に決定済みの dataset / corpus / threshold / mapping を反映した。
- `tasks/done/20260506-2246-mmrag-docqa-production-defaults.md` を追加し、今回完了した「推奨値決定」task と受け入れ条件チェックを記録した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `MMRAG_DOCQA_CONFIRMATION_PROMPT.md` | Markdown | 本番評価の推奨決定値 | R1, R2, R3 |
| `tasks/todo/20260506-2049-mmrag-docqa-production-dataset.md` | Markdown | 実装 todo に決定済み情報を反映 | R3, R4 |
| `tasks/done/20260506-2246-mmrag-docqa-production-defaults.md` | Markdown | 推奨値決定 task の完了記録 | R2, R3 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | 未確定事項を dataset、PDF、質問、mapping、threshold、baseline に分解して決定した。 |
| 制約遵守 | 5 | 実 benchmark run を実施済みとは書かず、決定と実装を分離した。 |
| 成果物品質 | 5 | 後続実装が converter / downloader を作れる粒度で記録した。 |
| 説明責任 | 5 | 採用した dataset と採用しなかった default の理由を明記した。 |
| 検収容易性 | 5 | task / docs に受け入れ条件と決定値を残した。 |

総合fit: 5.0 / 5.0（約100%）

## 7. 未対応・制約・リスク

- 未対応事項: `MMLongBench-Doc` converter、PDF downloader、suite-specific threshold enforcement、実 CodeBuild run は未実装。
- 制約: 実 PDF サイズと配布形式は converter 実装時に再確認が必要。
- リスク: PDF が API Gateway payload 上限を超える場合、PDF 直接 upload ではなくページ分割、Textract JSON、または事前抽出 text へ切り替える必要がある。
