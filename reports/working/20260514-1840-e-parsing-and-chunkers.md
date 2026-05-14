# E parsing and chunkers 作業完了レポート

- 作成日: 2026-05-14 18:40 JST
- 対象 task: `tasks/do/20260514-1820-e-parsing-and-chunkers.md`
- 対象 branch: `codex/phase-e-parsing-and-chunkers`

## 指示

Wave 3 の `E-parsing-and-chunkers` として、仕様 3A/3C と `docs/spec/gap-phase-e.md` に基づき、ParsedDocument 系の最小 schema、拡張 extraction/chunk metadata、ingest run warnings/counters の foundation を実装する。

## 要件整理

- 既存 PDF / DOCX / text / Textract JSON / Textract OCR fallback の互換挙動を維持する。
- 既存 `StructuredBlock` と互換を保ちつつ、bbox / confidence / readingOrder / sourceLocation / tableId / figureId を保存・伝播できるようにする。
- PDF file profile、Textract table/figure metadata、OCR warning/counter を保存できる foundation を追加する。
- `DocumentIngestRun.status` enum 互換を維持し、stage / counters / warnings を event / manifest 側へ拡張する。
- drawing metadata の既存 citation / benchmark field 名を preserve し、通常 ingest で架空値を生成しない。

## 実施作業

- `apps/api/src/types.ts` / `apps/api/src/schemas.ts` に `ParsedDocument`、`ParsedPage`、`ParsedBlock`、`ExtractedTable`、`ExtractedFigure`、`ExtractionWarning`、`PdfFileProfile` などの最小型を追加した。
- `text-extract.ts` で PDF native text / OCR fallback の file profile、Textract block confidence、bbox、table model、figure model、warning、counter を生成するようにした。
- `chunk.ts` で structured block の table/figure/confidence/location metadata を chunk metadata に伝播するようにした。
- `memorag-service.ts` で parsed document / warning / counter / file profile を manifest と ingest stage event に保存・伝播した。
- `docs/spec/gap-phase-e.md` に実装結果、残 scope-out、open question を追記した。

## 成果物

- `apps/api/src/types.ts`
- `apps/api/src/schemas.ts`
- `apps/api/src/rag/text-extract.ts`
- `apps/api/src/rag/chunk.ts`
- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/rag/text-processing.test.ts`
- `apps/api/src/rag/memorag-service.test.ts`
- `docs/spec/gap-phase-e.md`
- `tasks/do/20260514-1820-e-parsing-and-chunkers.md`

## 検証

- pass: `npm run typecheck -w @memorag-mvp/api`
- pass: `npm exec -w @memorag-mvp/api -- tsx --test src/rag/text-processing.test.ts src/rag/memorag-service.test.ts src/contract/api-contract.test.ts`
- pass: `npm run docs:openapi:check`
- pass: `npm run test -w @memorag-mvp/api`
- pass: `npm exec -- tsx --test benchmark/corpus.test.ts benchmark/run.test.ts benchmark/drawing-local-extraction.test.ts`
- pass: `python3 scripts/validate_spec_recovery.py docs/spec-recovery`
- pass: `git diff --check`

## fit 評価

- ParsedDocument 系 foundation と extraction/chunk metadata 伝播は実装済み。
- 既存 PDF/DOCX/text/Textract の抽出・chunking と citation / drawing benchmark gate は回帰テストで確認済み。
- CAD/BIM native parser、VLM-OCR、UI preview、KnowledgeQuality enforcement は scope-out として維持した。

## 未対応・制約・リスク

- confidence threshold の enforcement は Phase C の quality policy と接続する後続対象。
- `ParsedDocument` を API でどこまで返すか、文書詳細 UI preview をどう作るかは後続 task の判断事項。
- benchmark targeted test は sandbox 内の tsx IPC pipe listen が `EPERM` になったため、同一コマンドを権限付きで再実行して pass を確認した。
