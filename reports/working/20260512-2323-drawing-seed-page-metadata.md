# 図面 seed page metadata 付与 作業完了レポート

## 指示

- PR #281 の次改善として、図面 seed corpus から compact page/sheet metadata を実際に ingest metadata へ渡せるようにする。

## 要件整理

- S3 Vectors の filterable metadata budget を壊さず、page/sheet grounding に必要な小さな scalar metadata だけを残す。
- rich drawing metadata の配列や graph は vector metadata へ戻さない。
- 複数 sheet の corpus を単一 page/sheet に潰して、誤った page hit を作らない。
- test と docs を更新し、未実施の検証を実施済み扱いしない。

## 検討・判断

- `drawingSheetMetadata` 全体を戻すと metadata budget を超えるため、`compactBenchmarkCorpusMetadata()` で単一 sheet と判定できる場合だけ `pageOrSheet`、`drawingNo`、`sheetTitle`、`scale` を抽出する方針にした。
- region metadata は全 chunk に付くため、単一 region の corpus に限って `regionId`、`regionType`、`bbox` を残す方針にした。
- 長すぎる scalar は compact metadata から落とし、preflight budget check を維持した。

## 実施作業

- `memorag-bedrock-mvp/benchmark/corpus.ts` に compact drawing metadata 抽出処理を追加。
- corpus test で seed upload metadata に compact page/sheet/region metadata が渡ることを確認。
- corpus test で rich metadata が引き続き落ちること、複数 sheet では page/sheet scalar を作らないことを確認。
- README に seed upload 時の compact page/sheet metadata 方針を追記。

## 成果物

- `memorag-bedrock-mvp/benchmark/corpus.ts`
- `memorag-bedrock-mvp/benchmark/corpus.test.ts`
- `memorag-bedrock-mvp/README.md`
- `tasks/do/20260512-2323-drawing-seed-page-metadata.md`

## 検証

- `npm ci`: pass（既存 audit: moderate 1 / high 2）
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark -- corpus.test.ts`: pass（81 tests）
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `git diff --check`: pass

## fit 評価

- API citation contract に続き、benchmark seed upload が compact page/sheet metadata を検索 hit metadata へ渡すための経路を作れた。
- 複数 sheet corpus で誤った page metadata を付けない条件を test で固定した。
- rich drawing metadata を vector metadata に戻さない方針を維持した。

## 未対応・制約・リスク

- 単一 sheet ではない PDF の page/sheet metadata はまだ chunk/page 単位で付与できない。次段で page/sheet/region 単位 index または chunk metadata enrichment が必要。
- 既存 ingest 済み corpus には再 ingest しない限り新 metadata は付かない。
- `npm ci` で既存 audit 指摘（moderate 1 / high 2）が残っている。
