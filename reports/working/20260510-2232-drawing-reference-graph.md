# 図面参照グラフ改善 作業完了レポート

## 受けた指示

- マージ済みの前回改善に続き、次の改善を実施する。
- すぐやらない施策は task として管理し、Worktree Task PR Flow に従う。

## 要件整理

- 図面 benchmark の detail / section / callout QA で、参照元と参照先を graph として保持する。
- dataset row に `expectedGraphResolutions` を付け、既存の `graph_resolution_accuracy` 診断に接続する。
- corpus metadata / benchmark seed metadata / vector metadata で `drawingReferenceGraph` を保持する。
- source hierarchy と graph evidence 不足時の abstention 方針を docs に反映する。

## 実施作業

- `architecture-drawing-qarag` の metadata 生成に `drawingReferenceGraph` schema を追加した。
- page / region / detail / section / callout node と contains / references edge、`detailIndex`、`calloutEdges`、source priority conflict を生成するようにした。
- detail / section / callout QA から `expectedGraphResolutions` と `metadata.expectedGraphEdges` を出力するようにした。
- corpus metadata reader、API の benchmark seed allowlist / validator、vector metadata、debug state schema に `drawingReferenceGraph` を通した。
- benchmark / API 契約テストに graph metadata の fixture と validation を追加した。
- README、OPERATIONS、FR-019 要件 docs に graph artifact と abstention 方針を追記した。

## 成果物

- `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag.ts`
- `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag.test.ts`
- `memorag-bedrock-mvp/apps/api/src/routes/benchmark-seed.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts`
- `memorag-bedrock-mvp/apps/api/src/types.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/state.ts`
- `memorag-bedrock-mvp/README.md`
- `memorag-bedrock-mvp/docs/OPERATIONS.md`
- `memorag-bedrock-mvp/docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/07_評価・debug・benchmark/05_benchmark指標/REQ_FUNCTIONAL_019.md`

## 検証

- `npm ci`: pass。既存依存関係で 3 vulnerabilities (1 moderate, 2 high) が報告された。
- `npm run test --workspace @memorag-mvp/benchmark`: pass
- `npm run typecheck --workspace @memorag-mvp/benchmark`: pass
- `npm run test --workspace @memorag-mvp/api`: pass
- `npm run typecheck --workspace @memorag-mvp/api`: pass
- `npm run lint`: pass
- `git diff --check`: pass
- `npm run docs:check --workspace @memorag-mvp/api`: script 未定義のため未実施

## fit 評価

- 参照元 bbox と参照先 bbox を graph artifact と dataset 診断に保持できるため、detail reference QA の根拠到達を最終回答と分けて評価できる。
- source hierarchy は `evidenceSufficiency` と graph conflict metadata の双方に明記し、検索 score 任せにしない方針を維持した。
- 完全な CAD graph、部屋境界、配管接続、記号検出 graph は本 task の対象外として残した。

## 未対応・制約・リスク

- `drawingReferenceGraph` の bbox は現時点では region heuristic / page extent 由来であり、実測 OCR crop や CAD primitive ではない。
- 参照先抽出は seed QA の task/category/text から汎用的な識別子候補を拾う初期実装で、専用検出器や cross-sheet resolver は後続 task の対象。
- docs check 専用 script は API workspace に存在しなかったため未実施。
