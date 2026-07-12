# FR-083 idempotent staged ingest recovery

- 要件ID: `FR-083`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.7 安全なRAGライフサイクル`
- L3要件: `FR-083`
- 関連カテゴリ: `1. 文書・知識ベース管理`

## 要件

- FR-083: システムは、staged ingest を tenant/corpus/document-version/input/pipeline に scoped な idempotency key、durable checkpoint、attempt generation/fencing から回復し、単独・並行 retry で duplicate や stale commit を作らず、winner attempt の partial artifact だけを reconciliation してから publish すること。

## 根拠と意図

source、chunk、embedding、vector、manifest の順次書き込み中に失敗すると、単純な再実行は duplicate または orphan を作る。lease expiry 後の stale worker と新 attempt が並行すると、新 artifact の誤削除や遅延 publish も起きる。stage ごとの確定状態と attempt generation を使い、winner 以外の commit/compensation を拒否して、整合しない artifact を公開前に修復または隔離する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-083` |
| 説明 | scoped idempotency、checkpoint、attempt fencing、winner-only reconciliation/publish を持つ staged ingest recovery |
| 根拠 | 再試行時の duplicate、orphan、部分公開を防ぐ |
| 源泉 | `docs/spec-recovery/15_rag_lifecycle_matrix_202607.md`、`docs/spec-recovery/16_current_state_gap_analysis_202607.md` の `GAP-RD-013` |
| Actor / trigger | ingest worker が stage を commit、retry または recovery するとき |
| 種類 | 機能要求 / ingest / recovery |
| 依存関係 | `FR-038`, `FR-069`, `FR-072`, `FR-082` |
| 衝突 | 現行 ingest は source/vector/manifest を順次保存し、durable stage state と compensation を持たない |
| 受け入れ基準 | `AC-FR083-001`, `AC-FR083-002`, `AC-FR083-003` |
| 優先度 | S |
| 安定性 | High |
| Confidence | inferred |
| 所有者 | RAG Platform / RAG Ops |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR083-001 checkpoint retry without duplicates

- Given: 同じ authoritative tenant、corpus、document version、input hash、pipeline version、idempotency key の ingest が chunk、embed または stage index の直後に失敗する
- When: worker が durable checkpoint から retry する
- Then: commit 済み stage を再利用し、同じ stable ID の source、chunk、vector、manifest を重複作成せず、logical document version ごとの staged result を一つに保つ

### AC-FR083-002 reconciliation before publish

- Given: manifest count/hash と object、chunk、vector、index record の間に欠損、余剰または version 不一致がある
- When: recovery または publication 前 reconciliation を実行する
- Then: 差分を再作成、補償削除または quarantine し、整合が確認されるまで candidate を publish しない

### AC-FR083-003 concurrent retry fencing

- Given: 同じ scoped idempotency key で旧 worker の lease が失効し、新 attempt がより新しい generation/fencing token を取得した後に旧 worker が再開する
- When: 両 attempt が stage commit、artifact compensation、または publish を競合して要求する
- Then: current generation の winner だけに commit/compensation/publish を許可し、stale attempt を拒否して、新 generation の artifact を削除・隔離・上書きせず、logical document version を一つの manifest に収束させる

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | 非同期 ingest の途中失敗を安全に再試行するために必要 |
| 十分性 | OK | scoped key、checkpoint、idempotency、attempt fencing、duplicate/stale commit 防止、winner-only reconciliation、publication gate を含む |
| 理解容易性 | OK | ingest recovery という一つの状態遷移責務に限定した |
| 一貫性 | OK | `FR-072` の index 切替前に staged artifact の整合を保証する |
| 標準・契約適合 | OK | 1 要件 1 主判断と要件内 Given/When/Then を満たす |
| 実現可能性 | OK | stage ledger、generation/fencing token、conditional commit、stable ID、manifest count/hash、compensation で実現可能 |
| 検証可能性 | OK | stage 別 failure injection、同一 key の単独/並行 retry、stale worker、orphan/duplicate/winner assertion で確認できる |
| ニーズ適合 | OK | 一時障害から回復しても検索対象を重複・欠損させない |
| 実装適合 | OK（confirmed） | ingest/staged publication が scoped checkpoint/idempotency、attempt fencing、winner-only commit/compensation、reconciliation state を実装し、retry/partial/concurrent fault tests を持つ |

## トレース

- 後方: `GAP-RD-013`、`FR-038`、`docs/spec-recovery/15_rag_lifecycle_matrix_202607.md`。
- 前方: ingest stage ledger、idempotency contract、fault-injection suite、`FR-072`。
