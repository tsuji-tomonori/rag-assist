# 作業完了レポート

保存先: `reports/working/20260510-1456-multiturn-p3-memory-grounding.md`

## 1. 受けた指示

- 主な依頼: P2/P3 の残り対応を進める。
- 今回の実施範囲: P2 は merged 済みであることを確認し、P3 の memory grounding を実装した。
- 条件: worktree task PR flow に従い、task、検証、commit、PR、コメントまで進める。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | memory hit を source chunk / page range に展開する | 高 | 対応 |
| R2 | memory summary 自体を最終 citation にしない | 高 | 対応 |
| R3 | MMRAG-DocQA の `useMemory` ablation を切り替えられる | 高 | 対応 |
| R4 | page hit / citation support 評価へ接続する | 中 | 既存 summary 指標を利用 |
| R5 | dataset 固有分岐を実装に入れない | 高 | 対応 |

## 3. 検討・判断したこと

- P2 は PR #242 が main に merge 済みだったため、今回の主対象は P3 に絞った。
- memory hit は global/section summary として有効だが、回答根拠には raw chunk が必要なため、検索結果へ追加するのは `kind: "chunk"` の source chunk に限定した。
- benchmark の page hit / citation support は既存 runner が集計済みのため、新しい dataset 固有 metric は足さず、`MMRAG_DOCQA_USE_MEMORY=1` で同一 corpus / evaluator profile の ablation を取れる形にした。

## 4. 実施した作業

- `MemoryCard` / `VectorMetadata` に `sourceChunkIds`、`pageStart`、`pageEnd` を追加した。
- memory vector metadata に source chunk / page 情報を書き込み、reput 時にも保持するようにした。
- `search-evidence` で memory hit から manifest / chunks を読み直し、source chunk を retrieval 候補へ展開した。
- duplicate chunk は hybrid と memory の source marker を統合し、trace diagnostics に `sourceCounts.memory` を追加した。
- MMRAG-DocQA converter に `MMRAG_DOCQA_USE_MEMORY=1` を追加し、unit test と docs を更新した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/nodes/search-evidence.ts` | TypeScript | memory hit から source chunk へ展開 | P3 |
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts` | TypeScript | memory card metadata 永続化 | P3 |
| `memorag-bedrock-mvp/benchmark/mmrag-docqa.ts` | TypeScript | `MMRAG_DOCQA_USE_MEMORY` ablation | P3 |
| `memorag-bedrock-mvp/docs/LOCAL_VERIFICATION.md` | Markdown | ablation 手順を追記 | Docs |
| `tasks/do/20260510-1410-multiturn-p3-memory-grounding.md` | Markdown | task 状態と受け入れ条件 | Worktree flow |

## 6. 実行した検証

- `npm ci`: pass
- `git diff --check`: pass
- `npm exec -w @memorag-mvp/api -- tsx --test src/agent/nodes/node-units.test.ts`: fail -> 修正後 pass
- `npm run typecheck -w @memorag-mvp/api`: fail -> 修正後 pass
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`: pass
- `npm test -w @memorag-mvp/api`: fail -> 修正後 pass
- `npm run test:coverage -w @memorag-mvp/api`: pass
- `npm run build -w @memorag-mvp/api`: pass
- `npm run typecheck -w @memorag-mvp/benchmark`: pass
- `npm test -w @memorag-mvp/benchmark -- mmrag-docqa.test.ts`: pass
- `npm run build -w @memorag-mvp/benchmark`: pass
- `npm run docs:openapi:check`: pass

## 7. 指示への fit 評価

総合fit: 4.8 / 5.0（約96%）

理由: P3 の主要実装、ablation、検証、作業レポートまで対応した。実ベンチマーク本番 run は外部 corpus / API 実行環境が必要なため、この作業内では unit / full API test / benchmark converter test に留めた。

## 8. 未対応・制約・リスク

- MMRAG-DocQA 全量 benchmark の実測比較は未実施。`MMRAG_DOCQA_USE_MEMORY=1` と既定 dataset の両方を同じ evaluator profile で実行して page hit / citation support を比較する必要がある。
- 既存に ingest 済みの memory vector は `sourceChunkIds` metadata を持たない場合がある。section/concept memory は text 内の `Source chunks:` fallback を使えるが、document memory の再生成には reindex / ingest が必要。
