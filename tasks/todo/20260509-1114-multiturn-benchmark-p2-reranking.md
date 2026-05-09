# Multi-turn benchmark P2 retrieval / reranking 強化

状態: todo

## 背景

P0/P1 で conversation-aware benchmark と query trace の土台を作るが、MTRAG / ChatRAG Bench 系で正しい page / chunk を取るには reranking と page-aware retrieval の改善が必要になる。

## 目的

BM25 + dense + RRF の候補集合に対して、page/layout-aware feature と previous citation prior を使った reranking を追加する。

## スコープ

- benchmark profile での candidate pool 拡張
- `cheapRerank` への page/layout-aware feature 追加
- previous turn citation document/page soft prior
- top 50-100 reranker provider の設計検討
- expected page hit / MRR への効果測定

## 受け入れ条件

- [ ] page / section / heading / table kind などの metadata を rerank feature として使える。
- [ ] previous turn citation prior は soft boost に留まり、根拠なし回答を許さない。
- [ ] benchmark 固有 row id / expected answer 分岐を入れていない。
- [ ] 既存 single-turn retrieval の regression を検証している。

## 検証計画

- search / rerank unit test
- benchmark smoke
- `git diff --check`
