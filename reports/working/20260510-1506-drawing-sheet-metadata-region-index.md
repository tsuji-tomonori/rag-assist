# 作業完了レポート

保存先: `reports/working/20260510-1506-drawing-sheet-metadata-region-index.md`

## 1. 受けた指示

- 主な依頼: マージ済みの建築図面 QARAG 改善 todo を一つずつ実施する。
- 今回の対象: `tasks/todo/20260510-1433-drawing-sheet-metadata-region-index.md`
- 成果物: 建築図面 benchmark seed に sheet metadata と region candidate index を追加する実装、検証、PR。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | titleblock 由来の `drawing_no`、`sheet_title`、`scale` を構造化 metadata として保存する | 高 | 対応 |
| R2 | legend / table / note / detail region を page + bbox 付きで検索候補 metadata にする | 高 | 対応 |
| R3 | 建築図面 QARAG の titleblock / legend 系 seed QA で根拠 page または bbox を評価できる | 高 | 対応 |
| R4 | 既存の一般文書 RAG の API 互換性を壊さない | 高 | 対応 |
| R5 | 実施した検証と未実施事項を明記する | 高 | 対応 |

## 3. 検討・判断したこと

- 初期実装では PDF を新規 OCR せず、既存の benchmark 正本と seed QA の evidence anchor から再現可能な metadata を生成する方針にした。
- bbox は実測 crop ではなく初期 region candidate として扱い、`bboxSource` と `confidence` を付けて精密座標ではないことを明示した。
- benchmark seed upload の metadata whitelist を拡張し、通常利用者の upload 経路や ACL 境界を広げない形にした。
- vector metadata に `drawingSourceType`、`drawingSheetMetadata`、`drawingRegionIndex` を伝搬させ、後続の retrieval / evidence gate が参照できる土台にした。

## 4. 実施した作業

- task を `tasks/do/` に移動し、状態を `do` に更新した。
- `architecture-drawing-qarag` prepare で source ごとの `<file>.metadata.json` を生成するようにした。
- dataset row metadata に `expectedEvidenceRegions` と `drawingSourceType` を追加した。
- benchmark corpus seed が drawing metadata sidecar を upload metadata に含めるようにした。
- API の benchmark seed whitelist に drawing metadata の shape validation を追加した。
- ingest 後の vector metadata と agent state schema に drawing metadata を追加した。
- README / OPERATIONS に sidecar metadata と bbox の初期候補であることを追記した。
- benchmark / API の関連 test と typecheck を実行した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag.ts` | TypeScript | sheet metadata / region index 生成 | R1, R2, R3 |
| `memorag-bedrock-mvp/benchmark/corpus.ts` | TypeScript | sidecar metadata の seed upload 反映 | R1, R2 |
| `memorag-bedrock-mvp/apps/api/src/routes/benchmark-seed.ts` | TypeScript | benchmark seed metadata whitelist 拡張 | R4 |
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts` | TypeScript | vector metadata への伝搬 | R2, R4 |
| `memorag-bedrock-mvp/apps/api/src/types.ts` / `agent/state.ts` | TypeScript | drawing metadata 型・schema | R2, R4 |
| `memorag-bedrock-mvp/README.md` / `docs/OPERATIONS.md` | Markdown | 運用説明 | R5 |
| `reports/working/20260510-1506-drawing-sheet-metadata-region-index.md` | Markdown | 本作業レポート | R5 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4 | 受け入れ条件の土台は実装したが、実測 OCR crop は後続 task に残した。 |
| 制約遵守 | 5 | benchmark 固有 shortcut を回答生成へ入れず、metadata 生成に限定した。 |
| 成果物品質 | 4 | test / typecheck は通過。bbox は初期候補として明示した。 |
| 説明責任 | 5 | docs と report に未実測 bbox であることを明記した。 |
| 検収容易性 | 5 | 対象ファイルと検証コマンドを明示した。 |

総合fit: 4.6 / 5.0（約92%）

## 7. 実行した検証

- `npm ci`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark -- architecture-drawing-qarag.test.ts corpus.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- api-contract.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `git diff --check`: pass
- `pre-commit run --files ...`: pass

## 8. 未対応・制約・リスク

- 未対応事項: 実 PDF の OCR crop から精密 bbox を確定する処理は未実装。後続の OCR / VLM-OCR 抽出 pipeline と図面領域検出 task で扱う。
- 制約: `drawingRegionIndex` の bbox は seed QA の evidence anchor に基づく初期候補であり、実測座標ではない。
- リスク: 初期 region candidate は検索補助には使えるが、精密な grounding 評価には後続の bbox 確定が必要。
