# FR-073 正本性・時点・矛盾を保つ根拠集合

- 要件ID: `FR-073`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: A

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.7 安全なRAGライフサイクル`
- L3要件: `FR-073`
- 関連カテゴリ: `2. チャットQA・根拠提示・回答不能制御`, `4. 回答検証・ガードレール`

## 要件

- FR-073: システムは、回答前の根拠集合に、論点、支持役割、正本性、文書版、適用期間、原文位置を保持し、重大な未解消矛盾を黙って除去しないこと。

## 根拠と意図

高スコアだけで旧版や反証を落とすと、流暢だが誤った回答になる。根拠不足・矛盾時は追加検索、限定回答、確認質問、保留へ分岐する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-073` |
| 説明 | provenance/time/conflict-aware evidence set |
| 根拠 | 正本・施行時点・反証を回答判断へ残す |
| 源泉 | RAG ガイド §5.5–5.6（PDF pp.137–144）、§6.1（PDF pp.146–147） |
| Actor / trigger | rerank/context pack/answerability/generation |
| 種類 | 機能要求 / RAG evidence |
| 依存関係 | `FR-069`, `FR-070`, `FR-004`, `FR-005`, `FR-014`, `FR-015` |
| 衝突 | current source-priority/temporal/conflict policy は未承認 |
| 受け入れ基準 | `AC-FR073-001`, `AC-FR073-002` |
| 優先度 | A |
| 安定性 | Medium |
| Confidence | inferred |
| 所有者 | Business owner / RAG Quality |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR073-001 evidence structure

- Given: supporting、conflicting、outdated、background の候補がある
- When: final evidence set を構築する
- Then: claim/topic、role、document/version/effective period、page/section/span locator、authorization decision を保持する

### AC-FR073-002 unresolved conflict

- Given: 同等の正本性・適用範囲・時点で解消できない重大矛盾がある
- When: answerability と generation を行う
- Then: 反証を黙って捨てず、矛盾を示す限定回答、確認質問、または回答保留を選ぶ

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 古い版や反証を黙って除外し、正本性・適用時点を誤った回答を生成することを防ぐために必要 |
| 十分性 | OK | support/conflict/outdated/background role、version/effective period、source span、未解消矛盾時の応答を扱う |
| 理解容易性 | OK | final evidence set に残す属性と、重大矛盾を検出した後の選択肢を明示した |
| 一貫性 | OK | citation `FR-004`、answerability `FR-014`、support verification `FR-015`、authorized retrieval `FR-070` と整合する |
| 標準・契約適合 | OK | RAG ガイドの provenance/time/conflict-aware evidence と grounded response 原則に適合する |
| 実現可能性 | OK | evidence schema、source authority policy、temporal filter、answerability state で実現できる |
| 検証可能性 | OK | version/time/source-priority/conflict dataset と citation locator assertion で確認できる |
| ニーズ適合 | OK | 利用者が適用時点と矛盾を把握した根拠付き回答または正直な保留を得られる |
| 原子性 | OK | final evidence set の情報保持を規定する |
| 実装適合 | partial | citation/support gate はあるが authority/time/conflict contract は限定的 |
| 合意 | pending | source priority と業務基準日時が未確定 |

## トレース

- 後方: `FR-004`, `FR-014`–`FR-016`, RAG ガイド PDF pp.137–154。
- 前方: evidence schema、answer states、`FR-074`, `FR-075`, `SQ-007`。
