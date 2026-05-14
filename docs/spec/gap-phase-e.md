# Phase E Gap: parsing and chunkers

- ファイル: `docs/spec/gap-phase-e.md`
- 種別: `SPEC_GAP`
- 作成日: 2026-05-14
- 状態: Draft
- 対象 task: `E-pre-gap`
- 後続 task: `E-parsing-and-chunkers`

## Scope

Phase E は、仕様 3A「取り込み・抽出・チャンク化」と 3C「高度文書解析・構造化抽出」を対象にする。

この gap 調査では実装変更を行わず、後続 `E-parsing-and-chunkers` が実装すべき差分、踏襲すべき現行挙動、scope-out を整理する。

## Input Inventory

| ID | 種別 | 対象 | 確度 | 用途 |
| --- | --- | --- | --- | --- |
| E-SPEC-3A | 仕様 | `docs/spec/2026-chapter-spec.md` 章 3A | confirmed | ingest、抽出、chunk、図面 metadata、品質 gate の要求。 |
| E-SPEC-3C | 仕様 | `docs/spec/2026-chapter-spec.md` 章 3C | confirmed | ParsedDocument、表、図、OCR、解析品質 gate の要求。 |
| E-MAP | 仕様 map | `docs/spec/CHAPTER_TO_REQ_MAP.md` | confirmed | 3A は partially covered、3C は missing と分類済み。 |
| E-IMPL-EXTRACT | 実装 | `apps/api/src/rag/text-extract.ts` | confirmed | PDF / DOCX / Textract JSON / Textract OCR fallback / StructuredBlock 抽出。 |
| E-IMPL-CHUNK | 実装 | `apps/api/src/rag/chunk.ts`, `apps/api/src/rag/manifest-chunks.ts` | confirmed | text / StructuredBlock chunking、pageStart/pageEnd、table/list/code/figure kind。 |
| E-IMPL-INGEST | 実装 | `apps/api/src/rag/memorag-service.ts`, `apps/api/src/document-ingest-run-worker.ts` | confirmed | extract -> chunk -> embedding -> vector put -> manifest と async ingest run。 |
| E-IMPL-TYPES | 実装 | `apps/api/src/types.ts`, `apps/api/src/schemas.ts` | confirmed | DocumentManifest、StructuredBlock、VectorMetadata、Citation、DocumentIngestRun の現行型。 |
| E-IMPL-CITE | 実装 | `apps/api/src/agent/utils.ts`, `apps/api/src/agent/nodes/validate-citations.ts` | confirmed | citation metadata 変換と chunk/computed fact 参照 gate。 |
| E-IMPL-BENCH-DRAWING | 実装 | `benchmark/architecture-drawing-qarag.ts`, `benchmark/run.ts`, `apps/api/src/routes/benchmark-seed.ts` | confirmed | 図面 benchmark metadata、page/region/evidence sufficiency gate。 |
| E-SPEC-RECOVERY | 復元仕様 | `docs/spec-recovery/`, `docs/1_要求_REQ/` | confirmed | PDF/OCR/大容量 ingest、chunking/retrieval gate、図面 benchmark 要求。 |

## Spec Requirements Summary

| 章 | 要求 summary | 後続実装への入力 |
| --- | --- | --- |
| 3A | 対象拡張子ごとに validation、前処理、抽出、chunking、embedding、index 登録、active 化を定義する。 | 現行の PDF/DOCX/text 中心 dispatcher を、対応拡張子表と未対応時の明示 error に拡張する。 |
| 3A | `IngestRun` は validating / preprocessing / extracting / chunking / embedding / indexing 等の段階、parser/chunker/embedding version、警告、counters を持つ。 | 現行 `queued/running/succeeded/failed/cancelled` と SSE event stage を保ちながら、詳細 stage / warning / counters の保存範囲を追加する。 |
| 3A | `ExtractedDocument` は text だけでなく pages、sections、tables、figures、drawing metadata、warning を保持する。 | 現行 `ExtractedDocument.text + blocks + sourceExtractorVersion` を ParsedDocument 方向へ拡張する。 |
| 3A | 図面系 metadata は drawing number、sheet、scale、bbox、region、reference graph 等を検索 filter と citation に使う。 | 現行 VectorMetadata の `pageOrSheet` / `drawingNo` / `sheetTitle` / `scale` / `regionId` / `regionType` / `sourceType` を preserve し、不足する parser 由来 metadata を追加する。 |
| 3A | chunk はページ、表、図、図面位置、見出し、offset を失わず、chunker / extractor 変更時に reindex 対象になる。 | 現行 chunk metadata と blue-green reindex を preserve し、table/figure/drawing chunk kind の粒度を広げる。 |
| 3C | PDF を digital_text / scanned_image / mixed / image_only / unknown などに分類し、ページ単位で native text と OCR を使い分ける。 | 現行は文書全体の text quality score で OCR fallback するため、ページ単位分類と confidence 保存が gap。 |
| 3C | ParsedDocument / ParsedPage / ParsedBlock / ExtractedTable / ExtractedFigure を保存し、bbox、reading order、confidence を持つ。 | 現行 `StructuredBlock` は軽量で bbox / confidence / readingOrder / table cells / figure description を持たないため拡張が必要。 |
| 3C | OCR / 表 / 図の confidence が低い場合は通常 RAG から除外またはレビュー対象にする。 | 現行は OCR timeout や抽出不能を failed / benchmark skipped にできるが、confidence gate は未実装。 |

## Current Implementation Summary

### confirmed

| 領域 | 現行挙動 | 根拠 |
| --- | --- | --- |
| Extract dispatcher | `textractJson`、direct text、PDF、DOCX、その他 UTF-8 text を `extractDocumentFromUpload` が分岐する。 | `apps/api/src/rag/text-extract.ts` |
| PDF native extraction | PDF は `pdf-parse` と `pdftotext -layout` の品質スコアを比較し、良い方を `pdf-layout-v2` として使う。 | `apps/api/src/rag/text-extract.ts` |
| PDF OCR fallback | PDF native text の品質スコアが 0 の場合、`DetectDocumentText` または S3 object 起点の async `StartDocumentTextDetection` を使う。 | `apps/api/src/rag/text-extract.ts` |
| Textract table | Textract `TABLE` / `CELL` は markdown table の `StructuredBlock(kind: "table")` に変換される。 | `apps/api/src/rag/text-extract.ts` |
| Textract line | Textract `LINE` は text/list/figure を軽量推定し、pageStart/pageEnd と sourceBlockId を持つ `StructuredBlock` になる。 | `apps/api/src/rag/text-extract.ts` |
| DOCX extraction | mammoth の HTML 変換から heading/list/code/table/figcaption を `StructuredBlock` にする。失敗時は raw text fallback。 | `apps/api/src/rag/text-extract.ts` |
| Text chunking | `chunkText` は form feed をページ境界として扱い、段落、list、文、長文 fallback で分割する。 | `apps/api/src/rag/chunk.ts` |
| Structured chunking | `chunkStructuredBlocks` は table/list/code/figure などの kind と pageStart/pageEnd、sourceBlockId、extractionMethod を chunk metadata に写す。table/code/figure は atomic block として扱う。 | `apps/api/src/rag/chunk.ts` |
| Ingest pipeline | `MemoRagService.ingest` は extract、chunk、memory card、embedding、vector put、manifest 保存を順に実行する。 | `apps/api/src/rag/memorag-service.ts` |
| Async ingest run | `startDocumentIngestRun` は run / event を作り、Step Functions または local async で `executeDocumentIngestRun` を動かす。 | `apps/api/src/rag/memorag-service.ts`, `apps/api/src/document-ingest-run-worker.ts` |
| Active gate minimum | 抽出 text が空なら `Uploaded document did not contain extractable text`、chunk 0 件なら `No chunks were produced...` で ingest 失敗する。 | `apps/api/src/rag/memorag-service.ts` |
| Manifest metadata | manifest は source / structuredBlocks / memoryCards object key、pipelineVersions、documentStatistics、chunks metadata、lifecycleStatus を持つ。 | `apps/api/src/types.ts`, `apps/api/src/rag/memorag-service.ts` |
| Reindex | staged ingest、cutover、rollback により source text と structured blocks を再利用し、旧 active を superseded にする。 | `apps/api/src/rag/memorag-service.ts` |
| Citation metadata | `toCitation` は pageStart/pageEnd/pageOrSheet/drawingNo/sheetTitle/scale/regionId/regionType/sourceType/bbox を返せる。 | `apps/api/src/agent/utils.ts` |
| Citation gate | `validateCitations` は answer JSON の usedChunkIds / usedComputedFactIds が selected chunks / computed facts に対応しない strict grounded answer を拒否する。 | `apps/api/src/agent/nodes/validate-citations.ts` |
| Drawing benchmark metadata | benchmark seed は `drawingSheetMetadata`、`drawingRegionIndex`、`drawingReferenceGraph`、`drawingExtractionArtifacts` を whitelist / shape validation する。 | `apps/api/src/routes/benchmark-seed.ts` |
| Drawing page gate | benchmark runner は citation/finalEvidence/raw retrieved の pageStart/pageEnd/pageOrSheet/drawingNo 等で expected page hit を判定する。 | `benchmark/run.ts`, `REQ_FUNCTIONAL_019.md` |
| Drawing evidence gate | optional `evidenceSufficiency` は bbox、source priority、normalized value match を評価する。 | `benchmark/run.ts`, `REQ_FUNCTIONAL_019.md` |

### inferred

| ID | 推定 | 根拠 | E での扱い |
| --- | --- | --- | --- |
| E-INF-001 | 現行 StructuredBlock は 3C の ParsedBlock の最小サブセットとして使える。 | kind/text/page/heading/sourceBlockId/extractionMethod はあるが、bbox/confidence/readingOrder はない。 | 互換 wrapper または migration path を検討する。 |
| E-INF-002 | 図面 metadata は本番 parser ではなく、主に benchmark corpus metadata と手動 metadata 経由で流入している。 | text-extract に drawing parser はなく、benchmark generator / seed validation が drawing fields を生成・許可している。 | parser 実装時は既存 metadata names を維持する。 |
| E-INF-003 | 現行 PDF OCR fallback は文書全体の native text が空に近い場合を主対象にしており、mixed PDF のページ単位 OCR ではない。 | `extractPdfDocument` は extractedText 全体の score で OCR fallback する。 | 3C の mixed/page-level OCR は明示 scope に入れるが、段階導入が必要。 |
| E-INF-004 | 表は retrieval/citation 上は markdown text と `chunkKind: table` で扱われ、cell-level evidence ではない。 | `textractTableBlock` と `htmlTableToMarkdown` は markdown 生成のみ。 | cell/bbox/confidence は scope、既存 markdown table citation は preserve。 |
| E-INF-005 | 図抽出は caption/LINE heuristic に留まり、画像そのものの分類・説明生成・decorative 除外は未実装。 | DOCX figcaption と Textract line prefix の `figure` 推定のみ確認。 | figure analyzer は scope、既存 figureCaption は preserve。 |

### open_question

| ID | 未確定点 | 影響 | 次の判断 |
| --- | --- | --- | --- |
| E-OQ-001 | 3A の全拡張子表のうち、E で最初に production support する拡張子はどこまでか。 | xlsx/pptx/html/json/xml/yaml/image/CAD/BIM/zip まで一括対応すると scope が大きすぎる。 | `E-parsing-and-chunkers` では PDF/DOCX/text/Textract を first target とし、他拡張子は明示 error または planning に分ける案を推奨。 |
| E-OQ-002 | ParsedDocument を manifest object として保存するか、既存 `structuredBlocksObjectKey` を拡張するか。 | reindex / loadChunksForManifest / object store 互換性に影響する。 | 既存 `structuredBlocksObjectKey` 互換を維持し、schemaVersion を上げる案を検討。 |
| E-OQ-003 | OCR confidence の source of truth を Textract block confidence にするか、page-level aggregate にするか。 | OCR gate、UI 表示、benchmark metric に影響する。 | page/block 両方を保存し、RAG gate は page aggregate から始める案を検討。 |
| E-OQ-004 | 図面の `bbox` を normalized_page に統一するか、PDF point / px / drawing_unit を許すか。 | citation viewer、benchmark evidence gate、CAD/BIM parser に影響する。 | benchmark 既存の normalized_page を preserve し、sourceLocation で unit を明示する案を検討。 |
| E-OQ-005 | OCR / table / figure low confidence を active 化失敗にするか、active だが RAG restricted にするか。 | Phase C の KnowledgeQuality / ragEligibility と分担が必要。 | E は extraction metadata と warning を作り、RAG eligibility enforcement は C と接続する。 |
| E-OQ-006 | `DocumentIngestRun.status` を仕様の細分 stage に拡張するか、event `stage` だけを細分化するか。 | API 互換性と UI 表示に影響する。 | status enum は維持し、event stage / counters / warnings を拡張する案を推奨。 |

## Preserve Existing Behavior

| ID | 踏襲事項 | 根拠 |
| --- | --- | --- |
| E-PRESERVE-001 | raw chunk は最終回答の citation 根拠として維持し、memory hit から raw chunk に drill-down できる関係を壊さない。 | `FR-020`, `search-evidence.ts`, `manifest-chunks.ts` |
| E-PRESERVE-002 | `validateCitations` の selected chunk / computed fact 存在 gate を弱めない。 | `apps/api/src/agent/nodes/validate-citations.ts` |
| E-PRESERVE-003 | `toCitation` が返す pageStart/pageEnd/pageOrSheet/drawingNo/sheetTitle/scale/regionId/regionType/sourceType/bbox を削らない。 | `apps/api/src/agent/utils.ts`, contract schemas |
| E-PRESERVE-004 | drawing benchmark の page gate は pageStart/pageEnd/pageOrSheet/drawingNo/sheetTitle を観測できる時だけ page hit を評価する。metadata がない行を false positive/false negative にしない。 | `benchmark/run.ts`, `REQ_FUNCTIONAL_019.md` |
| E-PRESERVE-005 | drawing evidence sufficiency の bbox / source priority / normalized value gate を、実装都合でスキップ済み扱いにしない。 | `benchmark/run.ts`, `REQ_FUNCTIONAL_019.md` |
| E-PRESERVE-006 | VLM-OCR や drawing parser が使えない場合に架空の抽出値、bbox、graph を作らない。failure reason / unavailable として記録する。 | `REQ_FUNCTIONAL_019.md`, `benchmark/drawing-local-extraction.ts` |
| E-PRESERVE-007 | benchmark seed isolation の `aclGroups: ["BENCHMARK_RUNNER"]`、`source: "benchmark-runner"`、`docType: "benchmark-corpus"` を維持する。 | `apps/api/src/routes/benchmark-seed.ts` |
| E-PRESERVE-008 | async ingest run の owner / benchmark seed scoped read 境界を維持する。 | `apps/api/src/routes/document-routes.ts` |
| E-PRESERVE-009 | manifest summary response では full chunks、vector keys、source object key を不要に返さない。 | `openapi-doc-quality.ts`, `DocumentManifestSummary` |
| E-PRESERVE-010 | 抽出 text 0 件、chunk 0 件は active 化せず失敗として扱う。benchmark corpus では抽出不能を `skipped_unextractable` に分類する現行運用を維持する。 | `memorag-service.ts`, `benchmark/corpus.ts`, `FR-039` |
| E-PRESERVE-011 | chunkerVersion / sourceExtractorVersion / embeddingModelId / indexVersion を manifest に残し、reindex 判定に使える状態を維持する。 | `buildPipelineVersions`, `DocumentManifest` |
| E-PRESERVE-012 | page form feed による PDF ページ境界の維持、StructuredBlock pageStart/pageEnd の citation metadata 伝播を壊さない。 | `chunk.ts`, `text-extract.ts` |

## Gap Matrix

| Gap ID | 状態 | 内容 | 後続対応 |
| --- | --- | --- | --- |
| E-GAP-001 | confirmed | 3A の対応拡張子表に対し、現行 dispatcher は PDF / DOCX / Textract JSON / direct text / UTF-8 fallback が中心。PPTX、XLSX/CSV、HTML、JSON/XML/YAML、画像、CAD/BIM、ZIP の明示 support / rejection policy がない。 | `E-parsing-and-chunkers` では first target と scope-out 拡張子を明記し、未対応拡張子は誤って UTF-8 fallback しないようにする。 |
| E-GAP-002 | confirmed | `DocumentIngestRun.status` は queued/running/succeeded/failed/cancelled で、仕様の validating/preprocessing/extracting/chunking/embedding/indexing、warning/counters/version fields は run 型にない。 | status 互換を保ち、event stage と run data に stage/counters/warnings を追加する。 |
| E-GAP-003 | confirmed | `ExtractedDocument` は text/blocks/sourceExtractorVersion のみで、pages/tables/figures/drawing metadata/warnings/fileProfile を持たない。 | ParsedDocument schema または structuredBlocks schema v2 を追加する。 |
| E-GAP-004 | confirmed | 3C の ParsedPage / ParsedBlock / ExtractedTable / ExtractedFigure が未実装。現行 StructuredBlock は軽量 metadata のみ。 | Parsed* 型、保存 object、chunker input adapter を追加する。 |
| E-GAP-005 | confirmed | PDF 種別分類はページ単位ではなく、文書全体の extracted text quality score による OCR fallback。mixed PDF / image_only / form PDF の分類がない。 | page-level classification と OCR target selection を追加する。 |
| E-GAP-006 | confirmed | OCR confidence を保存・gate していない。Textract block confidence は現行 normalized block 型に含めていない。 | OCR confidence の block/page aggregate を保存し、low confidence warning を出す。 |
| E-GAP-007 | confirmed | 表抽出は markdown table 化までで、cell、merged cell、bbox、caption、confidence、flags を持たない。 | table model と table-aware chunking を追加する。 |
| E-GAP-008 | confirmed | 図抽出は DOCX figcaption と Textract line heuristic のみで、figure/image classification、generatedDescription、decorative exclusion、bbox がない。 | figure model と RAG eligible 判定を追加する。 |
| E-GAP-009 | confirmed | 図面 metadata の型は VectorMetadata / benchmark metadata に存在するが、本番 parser は drawing number / scale / layer / block / bbox / reference graph を抽出しない。 | drawing metadata ingestion adapter を追加し、まず PDF drawing / benchmark metadata 互換から始める。 |
| E-GAP-010 | confirmed | `bbox` は Citation / VectorMetadata にはあるが、`toFilterableVectorMetadata` は metadata.bbox を vector metadata に写していない。 | bbox をどの粒度で vector metadata へ載せるか決め、S3 Vectors metadata size 制約を確認する。 |
| E-GAP-011 | confirmed | chunkKind は text/table/list/code/figure の 5 種で、仕様の heading_section、slide、spreadsheet_region、ocr_region、drawing_*、bim_entity_group、metadata を表現できない。 | 互換性を見ながら chunkKind を拡張するか、sourceBlockType/detailKind を追加する。 |
| E-GAP-012 | confirmed | 解析品質 gate は text 0 / chunk 0 の最低限で、page/offset/bbox/tableId/figureId 参照整合性や confidence threshold を検査しない。 | extraction validation を chunk 前後に追加し、warning と failed/restricted 判定を分ける。 |
| E-GAP-013 | confirmed | 文書詳細 UI 向けの抽出 preview、chunk preview、OCR/table/figure preview、drawing metadata view は本 gap の対象外だが、API/manifest の出力設計が不足している。 | E は保存形式と API 最小 read surface を設計し、UI は後続 C/J or document UX task に送る。 |
| E-GAP-014 | inferred | sourceLocation / bbox / tableId / figureId を citation に返すための source object schema が未統一。 | SourceLocation 正規化を追加し、Citation 既存 fields との mapping を設計する。 |
| E-GAP-015 | confirmed | benchmark の drawingExtractionArtifacts / drawingReferenceGraph は seed artifact と評価 gate にはあるが、通常 ingest から生成されない。 | 通常 ingest が未対応な間は benchmark artifact を真の抽出結果として誤表示しない。 |

## E-parsing-and-chunkers Scope

後続 `E-parsing-and-chunkers` の最小 scope は次とする。

1. 現行 PDF / DOCX / text / Textract JSON / Textract OCR fallback の互換挙動を保ったまま、抽出結果 schema を `ParsedDocument` 相当へ段階拡張する。
2. `StructuredBlock` 互換を維持し、bbox / confidence / readingOrder / sourceLocation / tableId / figureId などを追加できる保存形式を作る。
3. PDF は digital_text / scanned_image / mixed / image_only / unknown の分類を少なくとも文書またはページ単位で記録する。
4. Textract TABLE / CELL から table model と markdown chunk を両方作り、表 chunk には page、table id、列情報、confidence を保持する。
5. DOCX / Textract / direct structured input で table/list/code/figure の chunk metadata 伝播を維持し、拡張 chunk kind または detail kind を追加する。
6. OCR fallback で confidence と warning を保存し、低信頼 OCR を後続 quality gate が判断できる形にする。
7. drawing metadata は既存 citation / benchmark field 名を preserve し、通常 ingest から生成できない値は open question または warning として扱う。
8. `DocumentIngestRun` は status enum 互換を維持しつつ、event stage / counters / warnings で extract/chunk/embedding/indexing を追跡できるようにする。
9. 解析品質 gate は text 0 / chunk 0 に加え、citation metadata の壊れ、table/figure/bbox 参照欠落、low confidence warning を検査する。
10. dataset 固有の期待語句、QA sample 固有値、図面 benchmark の fixture 固有値を本番 parser / chunker の分岐に入れない。

## E-parsing-and-chunkers Scope-out

次は E の初回実装では完了扱いにしない。

| ID | scope-out | 理由 / 委譲先 |
| --- | --- | --- |
| E-OUT-001 | CAD/BIM native parser の本格実装。 | DWG/DXF/IFC/RVT/STEP は変換器・外部依存・UI 表示が大きい。まず metadata schema と unsupported policy に留める。 |
| E-OUT-002 | VLM-OCR / 画像説明生成の本番導入。 | model/cost/latency/security の評価が必要。I/J2/C と連携する。 |
| E-OUT-003 | KnowledgeQuality / ragEligibility の最終 enforcement。 | Phase C の品質 4 軸と連携する。E は extraction facts/warnings を供給する。 |
| E-OUT-004 | 文書詳細 UI の解析 preview / drawing viewer。 | 保存形式と API surface 確定後の UI task に送る。 |
| E-OUT-005 | 全拡張子の production support 一括追加。 | E 初回は PDF/DOCX/text/Textract を中心にし、他は明示 rejection / planning にする。 |
| E-OUT-006 | benchmark 指標そのものの大幅追加。 | Phase I。E は既存 page / region / evidence sufficiency gate を壊さない。 |
| E-OUT-007 | 認可モデルの再設計。 | Phase B で扱う。E は検索後 manifest/resource 再確認の前提を壊さない。 |

## Targeted Validation For E

| 検証 | 目的 |
| --- | --- |
| `npm exec -w @memorag-mvp/api -- tsx --test src/rag/text-processing.test.ts` | text extraction / chunk / citation metadata の回帰。 |
| `npm exec -w @memorag-mvp/api -- tsx --test src/rag/memorag-service.test.ts` | ingest / manifest / reindex / async run の回帰。 |
| `npm exec -w @memorag-mvp/api -- tsx --test src/contract/api-contract.test.ts` | document ingest API / schema / benchmark seed metadata の回帰。 |
| `npm exec -- tsx --test benchmark/corpus.test.ts benchmark/run.test.ts benchmark/drawing-local-extraction.test.ts` | skipped_unextractable、page gate、drawing evidence gate の回帰。 |
| `git diff --check` | whitespace / conflict marker 確認。 |
| `python3 scripts/validate_spec_recovery.py docs/spec-recovery` | spec-recovery 変更有無にかかわらず、既存復元仕様の構造を確認する。 |

## Open Questions

| ID | 種別 | 内容 | 次の判断 |
| --- | --- | --- | --- |
| E-OQ-007 | open_question | `ChunkKind` union を破壊的に広げるか、既存 5 種を維持して `detailKind` を追加するか。 | contract / web / benchmark の互換性を確認して決める。 |
| E-OQ-008 | open_question | `ParsedDocument` を API でどこまで返すか。 | manifest summary の非公開方針を維持し、管理者向け read API は J/C と調整する。 |
| E-OQ-009 | open_question | 表・図・OCR confidence の閾値は固定値か folder policy 由来か。 | C の quality policy と接続し、E では保存と warning までに留める案を推奨。 |
| E-OQ-010 | open_question | PDF page bbox の座標系を `normalized_page` へ変換するタイミング。 | benchmark gate と citation viewer の両方を満たす SourceLocation 仕様が必要。 |
