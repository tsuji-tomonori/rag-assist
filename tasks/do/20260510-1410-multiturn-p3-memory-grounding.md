# Multi-turn benchmark P3 memory grounding 強化

状態: do

## 背景

長文 PDF benchmark では memory retrieval が候補領域の発見に有効だが、memory summary 自体を最終 evidence とすると grounding が弱くなる。

## 目的

memory card を page-grounded / chunk-grounded にし、memory hit から source chunk / page range へ展開して回答根拠を原文 chunk に戻す。

## スコープ

- memory card への `sourceChunkIds` / `pageStart` / `pageEnd` / `sectionPath` 追加
- memory hit から evidence chunk expansion
- MMRAG-DocQA で `useMemory=true/false` ablation
- citation support / page hit / hallucination の比較

## ドキュメント保守計画

内部 retrieval / memory grounding ロジックの変更に留まる場合は、OpenAPI や public API docs の更新は不要。
benchmark row / summary schema を変更する場合のみ、関連 docs と generated docs の更新要否を確認する。

## 受け入れ条件

- [x] memory hit が最終 citation として直接使われず、source chunk に展開される。
- [x] `useMemory=true/false` の ablation を benchmark 設定で切り替えられる。
- [x] page hit と citation support の効果を summary / report に記録できる。
- [x] dataset 固有分岐を実装へ入れていない。

## 検証計画

- `npm exec -w @memorag-mvp/api -- tsx --test src/agent/nodes/node-units.test.ts`
- `npm test -w @memorag-mvp/api`
- `npm run test:coverage -w @memorag-mvp/api`
- `npm run typecheck -w @memorag-mvp/api`
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`
- `npm test -w @memorag-mvp/benchmark -- mmrag-docqa.test.ts`
- `npm run typecheck -w @memorag-mvp/benchmark`
- `npm run build -w @memorag-mvp/api`
- `npm run build -w @memorag-mvp/benchmark`
- `npm run docs:openapi:check`
- `git diff --check`

## 実施メモ

- memory vector metadata に `sourceChunkIds` / `pageStart` / `pageEnd` を保存し、検索時は memory hit から raw chunk を再読込して `kind: "chunk"` の evidence として返す。
- MMRAG-DocQA converter に `MMRAG_DOCQA_USE_MEMORY=1` を追加し、既定 `useMemory=false` との ablation を dataset 生成時に切り替えられるようにした。
- benchmark runner 既存の expected page hit / citation support summary をそのまま利用するため、dataset 固有 metric 分岐は追加していない。

## PR レビュー観点

- memory summary 自体を最終 citation に使っていないか。
- memory hit から raw chunk への展開が ACL / scope / benchmark filter を弱めていないか。
- `useMemory=true/false` の ablation が dataset 固有分岐ではなく設定・row field で切り替えられるか。
- page hit / citation support の既存 metric を壊していないか。
