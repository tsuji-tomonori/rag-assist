# citation 図面メタデータ返却

- 状態: done
- タスク種別: 修正
- 作業ブランチ: `codex/citation-drawing-metadata`
- 作成日時: 2026-05-12 21:54 JST

## 背景

`architecture-drawing-qarag-v0.1` では benchmark 側の page gate は修正済みだが、API の `citations` / `finalEvidence` には `pageOrSheet` や region 系の図面メタデータが返らないため、図面 QA の page/sheet grounding を評価・改善しにくい。

## なぜなぜ / RCA

1. なぜ `expected_page_hit_rate` が意味を持ちにくいのか。
   - citation に page/sheet を示すメタデータがないため。
2. なぜ citation に出ないのか。
   - `Citation` schema/type と `toCitation()` が `pageStart` / `pageEnd` 以外の図面メタデータを返さないため。
3. なぜ返していないのか。
   - S3 Vectors の metadata budget 対応で rich drawing metadata を filterable metadata から外しており、API 応答用の compact field との責務分離が不足しているため。
4. 根本原因。
   - 検索用 metadata budget と、回答根拠表示・benchmark 評価用 metadata の API contract が分離されていない。

## 受け入れ条件

- [x] `Citation` の API schema/type が、互換性を保った optional field として `pageOrSheet`、`drawingNo`、`sheetTitle`、`scale`、`regionId`、`regionType`、`sourceType`、`bbox` を表現できる。
- [x] citation 生成処理が、検索 hit metadata に存在する compact drawing metadata を `citations` / `finalEvidence` に渡す。
- [x] benchmark の page key 判定が direct `pageOrSheet` / `drawingNo` も認識する。
- [x] S3 Vectors の filterable metadata budget 対応を弱めず、rich drawing metadata の配列や graph を再投入しない。
- [x] 変更範囲に見合う API / benchmark test、typecheck、OpenAPI check を実行し、結果を記録する。
- [x] README / docs / 運用手順への影響を確認し、必要なら更新する。不要なら理由を記録する。
- [x] 認可・情報露出レビューを行い、既に認可済みの evidence metadata 以外を返さないことを確認する。

## 作業メモ

- まず既存の `Citation` schema/type、`toCitation()`、vector metadata 生成箇所、S3 Vectors metadata trimming を確認する。
- 実装へ benchmark 固有の期待値や QA sample 固有値を hard-code しない。

## 実施結果

- `Citation` / conversation citation の API schema、agent state schema、contract schema に compact drawing metadata の optional field を追加した。
- `toCitation()` が検索 hit metadata の `pageOrSheet`、`drawingNo`、`sheetTitle`、`scale`、`regionId`、`regionType`、`sourceType`、`bbox` を返すようにした。
- document ingest metadata から小さな scalar drawing metadata だけを vector metadata へ渡し、`drawingSheetMetadata`、`drawingRegionIndex`、`drawingReferenceGraph`、`drawingExtractionArtifacts` は引き続き vector metadata へ複製しないことを test で確認した。
- benchmark runner が direct `pageOrSheet` / `drawingNo` / `sheetTitle` も page key として評価するようにした。
- README、benchmark 指標要求、生成 OpenAPI Markdown を更新した。

## 検証

- `npm ci`: pass（既存 audit: moderate 1 / high 2）
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/rag/text-processing.test.ts src/rag/memorag-service.test.ts src/contract/api-contract.test.ts`: pass（211 tests）
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark -- run.test.ts`: pass（80 tests）
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run docs:openapi:check`: pass
- `git diff --check`: pass
- `pre-commit run --files ...`: pass

## セキュリティ / 認可レビュー

- 新規 route、認証、認可、RBAC の変更はない。
- 追加 field は、アクセス制御後に返される検索 hit metadata から citation に写す optional metadata に限定した。
- 任意の rich metadata 配列や reference graph は API citation へ展開していない。
- `bbox` は既に検索 hit に存在する JSON 値だけを返し、dataset 固有値や推定値は生成していない。
