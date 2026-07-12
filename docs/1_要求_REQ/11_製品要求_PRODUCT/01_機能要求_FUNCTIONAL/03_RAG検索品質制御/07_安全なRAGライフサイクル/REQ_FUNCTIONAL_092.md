# FR-092 versioned 構造保持 chunking

- 要件ID: `FR-092`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.7 安全なRAGライフサイクル`
- L3要件: `FR-092`
- 関連カテゴリ: `1. 文書・知識ベース管理`, `4. 回答検証・ガードレール`

## 要件

- FR-092: システムは、正規化 block を、構造境界、table/list/code の保持規則、token budget、overlap、source locator、stable ID の生成規則を持つ versioned chunking policy で決定的に chunk 化し、policy の品質制約を満たさない結果を publication 対象にしないこと。

## 根拠と意図

固定長分割だけでは見出しと本文、表の header と row、例外条件と結論が分離し、検索・引用・回答支持が劣化する。一方、chunker 固有の数値を要求へ固定すると corpus や model 変更に追随できない。必要な policy 属性と決定性を要求し、具体値は versioned profile と評価で管理する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-092` |
| 説明 | structure-aware、budgeted、deterministic な versioned chunk derivation contract |
| 根拠 | 文脈・表構造・source locator を保ち、再取り込み時の chunk drift と品質未検証公開を防ぐ |
| 源泉 | RAG ガイド §3.2–3.4（PDF pp.63–77）、`docs/spec-recovery/15_rag_lifecycle_matrix_202607.md`、current ingest/chunk path |
| Actor / trigger | chunker が normalized blocks を document-version の検索単位へ変換するとき |
| 種類 | 機能要求 / ingest / chunking / data integrity |
| 依存関係 | `FR-069`, `FR-075`, `FR-082`, `FR-083` |
| 衝突 | 現行 ingest の chunk 境界・overlap・構造保持・stable ID・quality gate が一つの versioned contract になっていない |
| 受け入れ基準 | `AC-FR092-001`, `AC-FR092-002` |
| 優先度 | S |
| 安定性 | Medium |
| Confidence | inferred |
| 所有者 | RAG Platform / RAG Quality |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR092-001 構造保持と決定性

- Given: 見出し階層、段落、表 header/row、list、code block、page/span locator を含む同一 document version と同一 chunking policy version がある
- When: 独立した二つの ingest run で chunk 化する
- Then: structure/boundary/overlap/token-budget rule を同じ順序で適用し、同じ chunk content、順序、source span、stable chunk ID、policy version を生成して、`FR-069` の必須属性を各 chunk へ継承する

### AC-FR092-002 品質制約違反の公開防止

- Given: oversized table/code block、極端に短い断片、locator 欠損、overlap 不整合、budget 超過のいずれかにより approved chunking policy を満たせない block がある
- When: chunk result を stage index の candidate として検証する
- Then: silent な構造破壊や切り捨てで合格させず、影響 block/chunk と理由を記録して再分割、`partial`、または quarantine とし、manifest と工程別評価が合格するまで publish しない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | extraction 後と embedding 前の検索単位品質を規範化するために必要 |
| 十分性 | OK | structure、boundary、budget、overlap、locator、stable ID、version、品質違反を含む |
| 理解容易性 | OK | 具体的な token 数でなく、versioned policy が持つ必須決定を明示した |
| 一貫性 | OK | locator/loss は `FR-082`、派生属性は `FR-069`、retry は `FR-083`、評価は `FR-075` に分離した |
| 標準・契約適合 | OK | atomic/testable requirement と RAG ガイドの構造・chunk 品質観点に適合する |
| 実現可能性 | OK | versioned chunker profile、stable hash ID、manifest validator で実現可能 |
| 検証可能性 | OK | structured corpus、repeat-run equality、boundary/oversize fixtures、manifest assertion で確認できる |
| ニーズ適合 | OK | 表・例外・手順の文脈を保った検索と引用を可能にする |
| 原子性 | OK | normalized block から publishable chunk への derivation contract だけを規定する |
| 実装適合 | OK（confirmed） | structure-aware chunker が versioned policy、table/list/code/page/span boundary、stable ID、overlap/token budget、security envelope を強制し、determinism/quarantine tests を持つ |
| 合意 | pending | corpus/profile ごとの token budget、overlap、構造保持優先順位を承認する必要がある |

## トレース

- 後方: RAG ガイド PDF pp.63–77、`GAP-RD-013`、`FR-082`。
- 前方: chunking policy schema、structured boundary corpus、determinism test、`FR-075`, `SQ-009`, `SQ-011`。
