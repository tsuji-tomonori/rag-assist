# FR-093 本番 RAG 品質・安全 monitoring control loop

- 要件ID: `FR-093`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft（閾値未承認）
- 優先度: S

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.7 安全なRAGライフサイクル`
- L3要件: `FR-093`
- 関連カテゴリ: `7. 評価・debug・benchmark`, `8. 認証・認可・管理・監査`, `運用`

## 要件

- FR-093: システムは、本番 RAG の ingest、retrieval、authorization、evidence、generation、citation、injection、performance、reliability、cost の品質・安全信号を version/slice 別に集約し、承認済み monitoring profile への違反または drift を検出したとき、責任者への通知と承認済みの安全な縮退・隔離・rollback 対応を実行すること。

## 根拠と意図

公開前 benchmark が合格しても、本番 corpus、権限構成、依存 service、model、traffic が変化すれば品質・安全性は劣化する。個別 run の再現 trace は `FR-074`、公開判定は `FR-075`、fallback の安全 invariant は `FR-089` に分離し、本要件は本番 signal から対応までの control loop を規定する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-093` |
| 説明 | production RAG quality/security signal の versioned aggregation、drift detection、safe response |
| 根拠 | release 後の corpus/model/policy/dependency drift と critical security regression を検出・封じ込める |
| 源泉 | RAG ガイド §7、§8.4–8.8（PDF pp.156–185, 195–208）、`docs/spec-recovery/15_rag_lifecycle_matrix_202607.md` |
| Actor / trigger | monitoring window 終了、critical event 発生、model/index/policy/corpus version 変更時 |
| 種類 | 機能要求 / production monitoring / safety control loop |
| 依存関係 | `FR-074`, `FR-075`, `FR-088`, `FR-089`, `SQ-005`–`SQ-015`, approved runbook |
| 衝突 | 現行 trace/benchmark は個別実行中心で、production stage/slice drift と対応 action の versioned contract がない |
| 受け入れ基準 | `AC-FR093-001`, `AC-FR093-002` |
| 優先度 | S |
| 安定性 | Medium |
| Confidence | inferred |
| 所有者 | RAG Ops / Security / RAG Quality / SRE |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-FR093-001 version・slice 別 signal 集約

- Given: 本番 request/run に policy、index、model、prompt、pipeline、parser、chunker version と非機微な tenant/role/use-case slice があり、reviewed sample または遅延 ground truth を相関できる
- When: approved observation window を集計する
- Then: ingest completeness/quarantine、authorized retrieval/false denial、unauthorized exposure、faithfulness、citation、answerability、injection、latency/error/backlog、cost を利用可能性と confidence とともに version/slice 別に報告し、欠損 signal を正常値または green に補完しない

### AC-FR093-002 違反・drift の安全な対応

- Given: zero-tolerance security event、approved threshold 違反、baseline からの承認済み drift 条件、または必須 monitoring signal 欠損が検出される
- When: critical event を即時評価するか observation window を確定する
- Then: profile version、影響 version/slice、根拠 trace、severity を付けて責任者へ通知し、runbook に定義した promotion freeze、candidate/文書 quarantine、last-known-safe rollback、限定回答、回答保留の該当 action を実行し、`FR-089` の safety guard を無効化しない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | release gate 後に生じる本番 drift と critical regression を検出・対応するために必要 |
| 十分性 | OK | ingest から cost までの signal、version/slice、missing data、alert、safe action を含む |
| 理解容易性 | OK | per-run trace、promotion gate、safe fallback から production control loop を分離した |
| 一貫性 | OK | `FR-075` / `SQ-005`–`SQ-015` と同じ metric/profile を本番 observation に適用する |
| 標準・契約適合 | OK | observability、continuous validation、incident response、data minimization に適合する |
| 実現可能性 | OK | metric/trace aggregation、versioned alert rules、runbook automation で実現可能 |
| 検証可能性 | OK | synthetic drift/critical event、missing-signal、alert/action correlation、rollback drill で確認できる |
| ニーズ適合 | OK | 利用者・運用者が公開後も品質と非漏えいを継続監視できる |
| 原子性 | OK | production signal の違反検出から承認済み安全 action までの control loop を規定する |
| 実装適合 | OK（confirmed、live AWS 未検証） | production producer/monitor/worker が versioned observations、missing-unavailable、alert/runbook、freeze/quarantine/rollback/limited/refuse interlock を実装した。governance restriction→current deny→実 role と全 provenance dimension 付き probe→aggregate→monitor の一貫 test で source validity と gate 判定を確認した。 |
| 合意 | pending | monitoring window、slice、閾値、severity、on-call、auto/manual action を承認する必要がある |

## トレース

- 後方: RAG ガイド PDF pp.156–185, 195–208、`FR-074`, `FR-075`, `SQ-005`–`SQ-015`。
- 前方: production quality/security dashboard、versioned alert rules、incident runbook、drift/rollback drill。
