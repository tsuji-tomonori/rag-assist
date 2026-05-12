# citation 図面メタデータ返却 作業完了レポート

## 指示

- `architecture-drawing-qarag-v0.1` の次改善として、citation / finalEvidence に page/sheet 系 metadata を返せるようにする。

## 要件整理

- API citation は既存 field と互換性を保ち、図面 QA に必要な `pageOrSheet`、`drawingNo`、`sheetTitle`、`scale`、`regionId`、`regionType`、`sourceType`、`bbox` を optional にする。
- benchmark は direct citation field と metadata object の両方から page key を評価できるようにする。
- S3 Vectors の filterable metadata budget 対応を弱めず、rich drawing metadata の配列や graph を再投入しない。
- 変更に合わせて tests、typecheck、OpenAPI docs、README / 要求 docs を確認する。

## 検討・判断

- 直接の根本原因は、citation contract と `toCitation()` が `pageStart` / `pageEnd` 以外の図面根拠 metadata を落としていたこと。
- 今回は benchmark 固有の期待値や dataset 固有分岐を実装せず、検索 hit metadata に存在する compact field をそのまま optional response field に通す設計にした。
- `drawingSheetMetadata`、`drawingRegionIndex`、`drawingReferenceGraph`、`drawingExtractionArtifacts` は大きくなりやすいため、vector metadata へ戻さない方針を維持した。

## 実施作業

- API / agent / contract の citation schema/type に compact drawing metadata の optional field を追加。
- `toCitation()` で検索 hit metadata の compact drawing metadata を citation に反映。
- document ingest metadata のうち小さな scalar drawing metadata だけを vector metadata に残せるようにし、rich drawing metadata は引き続き除外。
- benchmark runner の `citationPageKeys()` が direct `pageOrSheet` / `drawingNo` / `sheetTitle` を page key として扱うように更新。
- API / benchmark の回帰テスト、README、benchmark 指標要求、生成 OpenAPI Markdown を更新。

## 成果物

- `memorag-bedrock-mvp/apps/api/src/types.ts`
- `memorag-bedrock-mvp/apps/api/src/schemas.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/state.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/utils.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts`
- `memorag-bedrock-mvp/benchmark/run.ts`
- `memorag-bedrock-mvp/packages/contract/src/schemas/chat.ts`
- `memorag-bedrock-mvp/docs/generated/openapi/*.md`
- `memorag-bedrock-mvp/README.md`
- `memorag-bedrock-mvp/docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/07_評価・debug・benchmark/05_benchmark指標/REQ_FUNCTIONAL_019.md`
- `tasks/do/20260512-2154-citation-drawing-metadata.md`

## 検証

- `npm ci`: pass（既存 audit: moderate 1 / high 2）
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/rag/text-processing.test.ts src/rag/memorag-service.test.ts src/contract/api-contract.test.ts`: pass（211 tests）
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark -- run.test.ts`: pass（80 tests）
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run docs:openapi:check`: pass
- `git diff --check`: pass
- `pre-commit run --files ...`: pass

## fit 評価

- citation に page/sheet/region metadata を返すための API contract と変換経路は整った。
- benchmark の page hit 評価は、metadata object だけでなく direct citation field でも動く。
- S3 Vectors の rich drawing metadata 除外方針は維持している。

## 未対応・制約・リスク

- 既存 vector に compact drawing metadata が入っていない場合は、再 ingest または今後の chunk/page 単位 metadata 付与が必要。
- 今回は page/sheet/region 単位の chunking や visual page retrieval の default 化までは行っていない。
- `npm ci` で既存の audit 指摘（moderate 1 / high 2）が残っている。
