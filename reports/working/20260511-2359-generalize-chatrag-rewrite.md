# ChatRAG rewrite 汎化 作業レポート

## 指示

- 「ルールベースになってない? 汎化させて」
- 既存 PR の ChatRAG smoke 修正について、QA sample 固有・固定 stop word 列挙に寄った実装を避ける。

## 要件整理

| 要件ID | 要件 | 対応 |
|---|---|---|
| R1 | 固定 stop word 列挙を撤去する | 対応 |
| R2 | standalone 化を benchmark 固有句ではなく一般化する | 対応 |
| R3 | requiredFacts fallback を単語分解ではなく意味句にする | 対応 |
| R4 | sample 固有値・期待回答固有の分岐を追加しない | 対応 |
| R5 | 関連検証を実行する | 対応 |

## 検討・判断

- `who`, `can`, `what about` のような語彙列挙で失敗を抑える方式は、別ドメインや別言語で同じ品質になりにくいため撤去した。
- 代替として、語の長さ、acronym/ID らしさ、数字・記号、CJK 文字長などの表層的だがドメイン非依存な signal scoring を導入した。
- requiredFacts fallback は複数の単語 fact に分解せず、signal terms を原文順で束ねた 1 件の意味句にした。これにより `Who` のような疑問詞が missing fact になりにくい。
- LLM rewrite の導入はコスト・遅延・障害面の影響が大きいため、今回の範囲では既存ローカル rewrite の汎化に限定した。

## 実施作業

- `memorag-bedrock-mvp/apps/api/src/agent/text-signals.ts` を追加し、signal term 抽出と signal phrase 構築を共有化した。
- `build-conversation-state.ts` から英日 stop word 配列、英語疑問文専用の topic rewrite、`what about` 専用 standalone rewrite を削除した。
- 短く signal term が少ない追質問を履歴依存とみなす一般化 heuristic を追加した。
- `graph.ts` の requiredFacts fallback から `USELESS_FACT_REFERENCES` を撤去し、signal phrase 1 件にまとめる形へ変更した。
- `node-units.test.ts` に benchmark 外の SOC2/access 例を追加し、固定語彙ではなく signal scoring で低情報量語を抑制することを確認した。

## 成果物

| 成果物 | 内容 |
|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/text-signals.ts` | 汎用 signal term helper |
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/build-conversation-state.ts` | 履歴 topic/entity と standalone rewrite の汎化 |
| `memorag-bedrock-mvp/apps/api/src/agent/graph.ts` | requiredFacts fallback の意味句化 |
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/node-units.test.ts` | 汎化確認テスト |
| `tasks/do/20260511-2351-generalize-chatrag-rewrite.md` | 追加 task md |

## 実行した検証

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/agent/nodes/node-units.test.ts src/agent/graph.test.ts`: pass（npm script の glob により API workspace 203 tests が実行）
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass
- `rg -n "\\bwho\\b|\\bcan\\b|what about|how about|USELESS_FACT|STOP_WORD|extractEnglishTopic" ...`: 固定除外・固定 follow-up 句の残存なし。残存は no-answer 判定のみ。

## Fit 評価

総合fit: 4.6 / 5.0（約92%）

主要な固定 stop word / fixed follow-up 依存は撤去し、意味句 fallback と signal scoring に寄せた。完全な意味理解 rewrite ではなく lightweight heuristic の範囲に留まるため満点ではないが、sample 固有分岐を増やさず汎化性は改善した。

## 未対応・制約・リスク

- LLM による decontextualization は未導入。導入する場合は latency、cost、failure fallback を別設計する必要がある。
- no-answer 判定には拒否文の固定表現が残る。これは回答拒否文を履歴 topic に混ぜないための防御であり、今回の stop word 汎化対象とは分けて扱った。
