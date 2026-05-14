# E-parsing-and-chunkers

- 状態: do
- タスク種別: 機能追加
- branch: `codex/phase-e-parsing-and-chunkers`
- worktree: `.worktrees/phase-e-parsing-and-chunkers`
- base: `origin/main`
- 作成日: 2026-05-14

## 背景

Phase E の仕様 3A/3C と `docs/spec/gap-phase-e.md` に基づき、既存の PDF / DOCX / text / Textract JSON / Textract OCR fallback の互換挙動を維持しながら、後続の quality gate が参照できる抽出・chunk metadata の foundation を追加する。

## 目的

`ParsedDocument` 系の最小 schema または structuredBlocks schema v2、表・図・OCR confidence / warning、PDF file profile、ingest run の stage/counters/warnings を導入し、Phase C 以降の quality gate と citation/benchmark metadata が利用できる保存形式にする。

## Scope

- `ParsedDocument` / `ParsedPage` / `ParsedBlock` / `ExtractedTable` / `ExtractedFigure` 相当の最小型、または structuredBlocks schema v2 を追加する。
- 既存 `StructuredBlock` 互換を維持し、bbox / confidence / readingOrder / sourceLocation / tableId / figureId を保存できるようにする。
- PDF file profile を文書またはページ単位で記録できるようにする。
- Textract TABLE/CELL から table model と markdown chunk metadata を両方作る foundation を追加する。
- OCR fallback の confidence と warning を保存する。
- `DocumentIngestRun.status` enum 互換を維持し、event stage / counters / warnings を拡張する。
- drawing metadata の既存 citation / benchmark field 名を preserve し、通常 ingest で生成できない値を架空生成しない。
- `docs/spec/gap-phase-e.md` に実装結果と scope-out / open question を追記する。
- 作業レポートを `reports/working/*e-parsing-and-chunkers*.md` に作成する。

## Scope-out

- CAD/BIM native parser、本番 VLM-OCR、UI preview、KnowledgeQuality enforcement、benchmark 指標大幅追加。
- Phase C の RAG eligibility enforcement、Phase D の agent rename。
- dataset 固有期待語句、QA sample 固有値、fixture 固有分岐を本番 parser / chunker に入れること。

## 実装計画

1. 既存 extraction / chunk / ingest run 型とテストを確認する。
2. 互換性を壊さない optional field 中心の schema を追加する。
3. Textract table/OCR/PDF profile から metadata と warning/counter を生成する。
4. chunk metadata と manifest / ingest run に必要な field を伝播する。
5. 仕様 gap document と作業レポートを更新する。
6. 変更範囲に応じた検証を実行し、失敗があれば修正して再実行する。
7. commit / push / PR 作成、受け入れ条件コメント、セルフレビューコメントを実施する。
8. PR コメント後に task md を `tasks/done/` へ移動し、状態を `done` に更新して追加 commit / push する。

## ドキュメント保守方針

- 実装結果と scope-out / open question は `docs/spec/gap-phase-e.md` に追記する。
- README / API examples / operations に影響する外部 API 変更がなければ更新しない理由を作業レポートに記録する。

## 受け入れ条件

- [x] 現行 PDF / DOCX / text / Textract JSON / Textract OCR fallback の互換挙動を維持している。
- [x] `ParsedDocument` 系または structuredBlocks schema v2 の最小 schema が追加され、既存 `StructuredBlock` 互換を維持している。
- [x] bbox / confidence / readingOrder / sourceLocation / tableId / figureId を保存・伝播できる optional field がある。
- [x] PDF file profile を文書またはページ単位で記録できる。
- [x] Textract TABLE/CELL 由来で table model と markdown table chunk foundation があり、表 chunk に page/table id/confidence などが残る。
- [x] OCR fallback の confidence と warning が保存され、低信頼 OCR を後続 quality gate が判断できる。
- [x] `DocumentIngestRun.status` enum 互換を維持し、event stage / counters / warnings が拡張されている。
- [x] drawing metadata の既存 citation / benchmark field 名を preserve し、通常 ingest から架空値を生成していない。
- [x] `docs/spec/gap-phase-e.md` に実装結果と残 scope-out / open question が追記されている。
- [x] `reports/working/*e-parsing-and-chunkers*.md` に作業レポートが作成されている。
- [x] 必須検証を実行し、結果と未実施理由を PR 本文・コメント・最終報告に記録している。
- [ ] main 向け PR を作成し、日本語 PR 本文、受け入れ条件コメント、セルフレビューコメントを追加している。
- [ ] PR 作成後に task md を `tasks/done/` へ移動し、状態 `done` に更新した追加 commit を同じ branch に push している。

## 検証計画

必須:

- `npm run typecheck -w @memorag-mvp/api`
- affected API tests
- `git diff --check`
- `python3 scripts/validate_spec_recovery.py docs/spec-recovery`

可能なら:

- `npm exec -w @memorag-mvp/api -- tsx --test src/rag/text-processing.test.ts src/rag/memorag-service.test.ts src/contract/api-contract.test.ts`
- `npm exec -- tsx --test benchmark/corpus.test.ts benchmark/run.test.ts benchmark/drawing-local-extraction.test.ts`

## PR レビュー観点

- docs と実装の同期。
- 変更範囲に見合うテスト。
- RAG の根拠性・認可境界を弱めていないこと。
- benchmark 期待語句・QA sample 固有値・dataset 固有分岐を本番 parser/chunker に入れていないこと。

## リスク

- ParsedDocument 保存形式は後続 UI/API surface と調整が必要。
- confidence threshold は Phase C の quality policy と接続するため、本タスクでは保存と warning に留める。
- PDF mixed/page-level OCR は段階導入になり、初回実装では profile 記録中心になる可能性がある。
