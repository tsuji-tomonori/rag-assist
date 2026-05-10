# 建築図面 QARAG 診断用サブスコア

## 受けた指示

- マージ済みの前タスク後、次の改善を一つ進める。
- 図面 QARAG 改善ロードマップのうち、最終回答の正誤だけではなく失敗箇所を切り分ける診断 metric を追加する。

## 要件整理

- summary と Markdown report に、任意入力 field ベースの図面診断 metric を追加する。
- 入力がない metric は `not_applicable` とし、0 点扱いしない。
- architecture-drawing-qarag の region index から `expectedRegionIds` を dataset row に出せるようにする。
- failure reason を retrieval / ocr / grounding / reasoning / abstention に集約して確認できるようにする。

## 実施作業

- benchmark runner に `expectedRegionIds`、`expectedExtractionValues`、`expectedCounts`、`expectedGraphResolutions` を追加した。
- `region_recall_at_k`、`region_recall_at_20`、`extraction_accuracy`、`count_mape`、`graph_resolution_accuracy` を summary / Markdown report に追加した。
- `Diagnostic Failure Breakdown` を Markdown report に追加し、failure reason を診断カテゴリへ集約した。
- architecture drawing QARAG の region index から `expectedRegionIds` を dataset row に生成するようにした。
- README、OPERATIONS、FR-019 benchmark 指標要件を更新した。
- runner test に、診断 metric の成功・失敗・未指定 not-applicable の regression test を追加した。

## 成果物

- `memorag-bedrock-mvp/benchmark/run.ts`
- `memorag-bedrock-mvp/benchmark/run.test.ts`
- `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag.ts`
- `memorag-bedrock-mvp/docs/OPERATIONS.md`
- `memorag-bedrock-mvp/docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/07_評価・debug・benchmark/05_benchmark指標/REQ_FUNCTIONAL_019.md`

## 検証

- `npm run test --workspace @memorag-mvp/benchmark`: pass
- `npm run typecheck --workspace @memorag-mvp/benchmark`: pass
- `git diff --check`: pass

## Fit 評価

- AC1 から AC4 は満たした。
- 既存 suite は新規 expected field を持たない限り、新規 metric が `not_applicable` になり、既存採点を壊さない。
- 図面向け region / extraction / count / graph の失敗を個別 failure reason と診断カテゴリで確認できる。

## 未対応・制約・リスク

- region id の正確性は現時点では heuristic region index に依存する。
- OCR / detector / graph resolver 本体は未実装で、今回の metric はそれらの artifact が返った場合の評価導線を先に整えるもの。
- `npm ci` で既存依存に 3 件の audit 指摘が出たが、本タスクでは依存更新を行っていない。
