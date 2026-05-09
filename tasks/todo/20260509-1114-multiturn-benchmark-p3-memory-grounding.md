# Multi-turn benchmark P3 memory grounding 強化

状態: todo

## 背景

長文 PDF benchmark では memory retrieval が候補領域の発見に有効だが、memory summary 自体を最終 evidence とすると grounding が弱くなる。

## 目的

memory card を page-grounded / chunk-grounded にし、memory hit から source chunk / page range へ展開して回答根拠を原文 chunk に戻す。

## スコープ

- memory card への `sourceChunkIds` / `pageStart` / `pageEnd` / `sectionPath` 追加
- memory hit から evidence chunk expansion
- MMRAG-DocQA で `useMemory=true/false` ablation
- citation support / page hit / hallucination の比較

## 受け入れ条件

- [ ] memory hit が最終 citation として直接使われず、source chunk に展開される。
- [ ] `useMemory=true/false` の ablation を benchmark 設定で切り替えられる。
- [ ] page hit と citation support の効果を summary / report に記録できる。
- [ ] dataset 固有分岐を実装へ入れていない。

## 検証計画

- memory retrieval unit / integration test
- MMRAG-DocQA sample benchmark
- `git diff --check`
