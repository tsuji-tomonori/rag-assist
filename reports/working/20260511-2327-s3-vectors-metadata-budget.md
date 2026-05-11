# 作業完了レポート

保存先: `reports/working/20260511-2327-s3-vectors-metadata-budget.md`

## 1. 受けた指示

- 主な依頼: `architecture-drawing-qarag-v0.1` の S3 Vectors filterable metadata 2048 bytes 超過を修正する。
- 成果物: 実装修正、テスト、関連 docs、task md、commit / PR。
- 条件: repository-local AGENTS.md と skills に従い、worktree / task md / 検証 / report / PR flow を実施する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 図面 rich metadata を benchmark ingest metadata から外す | 高 | 対応 |
| R2 | S3 Vectors 直前で filterable metadata budget を検査する | 高 | 対応 |
| R3 | 原因が分かる fail fast error にする | 高 | 対応 |
| R4 | regression test と型チェックを実行する | 高 | 対応 |
| R5 | docs と task/report を更新する | 中 | 対応 |

## 3. 検討・判断したこと

- 直接の復旧には、benchmark runner 側で `drawingSheetMetadata`、`drawingRegionIndex`、`drawingReferenceGraph`、`drawingExtractionArtifacts` を upload metadata へ流さないことを優先した。
- API 側では `drawingSourceType` のみ filterable metadata に残し、巨大な図面構造 metadata は vector filter 対象から外した。
- S3 Vectors adapter に 2048 bytes check を置き、AWS 呼び出し前に vector key、実 byte 数、肥大 field を含む error を返す方針にした。
- artifact 化は正しい次段階だが、今回は benchmark 復旧と再発検知を小さく入れる範囲に留めた。

## 4. 実施した作業

- `benchmark/corpus.ts` に `compactBenchmarkCorpusMetadata()` を追加し、text / PDF 両方の seed metadata 作成で使用。
- `memorag-service.ts` の `toFilterableVectorMetadata()` から rich drawing metadata の filterable 化を除去。
- `s3-vectors-store.ts` に filterable metadata 2048 bytes check と largest fields 診断を追加。
- benchmark / API test を追加・更新。
- README、OPERATIONS、REQ-FR019 の記述を、rich metadata を vector metadata に複製しない方針へ同期。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/benchmark/corpus.ts` | TypeScript | benchmark seed metadata compact 化 | R1 |
| `memorag-bedrock-mvp/apps/api/src/adapters/s3-vectors-store.ts` | TypeScript | S3 Vectors metadata budget check | R2/R3 |
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts` | TypeScript | rich drawing metadata の filterable 除外 | R1/R2 |
| `memorag-bedrock-mvp/benchmark/corpus.test.ts` | Test | compact metadata regression | R4 |
| `memorag-bedrock-mvp/apps/api/src/adapters/s3-vectors-store.test.ts` | Test | budget check regression | R4 |
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.test.ts` | Test | vector metadata から rich metadata が除外されることを確認 | R4 |
| README / OPERATIONS / REQ-FR019 | Markdown | docs 同期 | R5 |

## 6. 指示への fit 評価

総合fit: 4.7 / 5.0（約94%）

理由: P0/P1 と API fail fast は実装・検証済み。full CodeBuild benchmark は AWS / CodeBuild / S3 Vectors 環境依存のため未実行であり、そこだけ満点から差し引いた。

## 7. 実行した検証

- `npm ci` (`memorag-bedrock-mvp`): pass。初回 test が `tsx: not found` で失敗したため依存関係を導入。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark -- corpus.test.ts`: pass。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/adapters/s3-vectors-store.test.ts src/rag/memorag-service.test.ts`: pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass。
- `git diff --check`: pass。

## 8. 未対応・制約・リスク

- `npm run codebuild:run -w @memorag-mvp/benchmark` は未実行。AWS / CodeBuild / S3 Vectors 環境に依存するため。
- rich drawing metadata の外部 artifact 化は未実装。今回の修正では `.metadata.json` 生成は維持し、upload metadata と vector metadata への混入を止めた。
- `npm ci` 後に npm audit が 3 件の脆弱性を報告したが、依存関係更新は今回のスコープ外。
