# 図面 seed page metadata 付与

- 状態: done
- タスク種別: 修正
- 作業ブランチ: `codex/drawing-seed-page-metadata`
- 作成日時: 2026-05-12 23:23 JST

## 背景

PR #281 で API citation は compact な図面根拠メタデータを返せるようになった。ただし、architecture drawing benchmark の seed upload では rich drawing metadata を vector metadata から外しているため、実際の検索 hit に `pageOrSheet` / `drawingNo` などが入らない限り page grounding 指標は改善しない。

## なぜなぜ / RCA

1. なぜ citation に page/sheet metadata が出ない行が残るのか。
   - API は field を返せるが、検索 hit metadata に compact page/sheet metadata が入っていないため。
2. なぜ検索 hit metadata に入らないのか。
   - benchmark corpus upload 時に S3 Vectors metadata budget を避けるため、`drawingSheetMetadata` や `drawingRegionIndex` を落としているため。
3. なぜ単純に rich metadata を戻せないのか。
   - S3 Vectors の filterable metadata 2048 bytes 制限を超えやすく、ingest failure になるため。
4. 根本原因。
   - rich drawing metadata の保管と、検索・citation 用の小さな scalar metadata の抽出が分離されていない。

## 受け入れ条件

- [x] architecture drawing benchmark の seed upload metadata に、metadata budget を壊さない compact page/sheet metadata を追加できる。
- [x] `drawingSheetMetadata` / `drawingRegionIndex` / `drawingReferenceGraph` / `drawingExtractionArtifacts` のような rich metadata は vector metadata へ再投入しない。
- [x] 複数 page/sheet を持つ corpus では、単一値に潰して誤った page hit を作らない。
- [x] benchmark runner または corpus preparation の test で、compact metadata が渡るケースと rich metadata が落ちるケースを確認する。
- [x] 変更範囲に見合う benchmark/API test、typecheck、docs check を実行し、結果を記録する。
- [x] docs への影響を確認し、必要なら README / benchmark docs を更新する。
- [x] 認可・情報露出レビューを行い、既に benchmark seed として投入される metadata 以上の情報を露出しないことを確認する。

## 作業メモ

- まず `benchmark/corpus.ts` の `compactBenchmarkCorpusMetadata()` と architecture drawing metadata 生成処理を読む。
- 実装へ dataset row ID、期待語句、QA sample 固有分岐を入れない。

## 実施結果

- `compactBenchmarkCorpusMetadata()` が単一 sheet と判定できる corpus だけ `pageOrSheet`、`drawingNo`、`sheetTitle`、`scale` を compact scalar metadata として残すようにした。
- 単一 region の corpus だけ `regionId`、`regionType`、`bbox` を compact metadata として残すようにした。
- 複数 sheet の corpus は page/sheet を単一値に潰さず、誤 page hit を避けるようにした。
- 長すぎる scalar 値は compact metadata から落とし、metadata budget を維持するようにした。
- README に seed upload 時の compact page/sheet metadata 方針を追記した。

## 検証

- `npm ci`: pass（既存 audit: moderate 1 / high 2）
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark -- corpus.test.ts`: pass（81 tests）
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `git diff --check`: pass

## セキュリティ / 認可レビュー

- 新規 route、認証、認可、RBAC の変更はない。
- 追加する metadata は benchmark seed upload metadata から抽出した小さな scalar 値だけで、既存の benchmark seed 権限境界を変更しない。
- rich drawing metadata 配列や graph は引き続き vector metadata へ複製しない。
- 複数 sheet corpus では単一 page/sheet 値を作らず、根拠 page の誤表示を避ける。
