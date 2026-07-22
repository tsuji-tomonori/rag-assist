# FR-093 本番 RAG 品質・安全 monitoring control loop

- 要件ID: `FR-093`
- 種別: `REQ_FUNCTIONAL`
- 状態: Deferred（cost-first mode）
- 優先度: C

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.7 安全なRAGライフサイクル`
- L3要件: `FR-093`
- 関連カテゴリ: `7. 評価・debug・benchmark`, `8. 認証・認可・管理・監査`, `運用`, `FinOps`

## 現行 product decision

2026-07-22 の owner 判断により、現行 MVP は production RAG の常時 quality/safety control loop より AWS コスト最小化を優先する。

- 5分ごとの source sample / observation prefix 全列挙、集約、alert処理、safe action実行を停止する。
- scheduled entrypoint は API の既存 safety-state contractを失効させないため、active policyを1件直接取得し、normal heartbeatを1件直接保存するだけとする。
- heartbeat は `ListObjectsV2`、benchmark run enumeration、observation生成、SNS publish、action生成を行わない。
- full monitoringを再導入する場合は、time-partitioned key、queue/index、retention、bounded reads、`SQ-015` cost ceiling、owner承認を先に満たす。

## 延期された要件

- FR-093: システムは、本番 RAG の ingest、retrieval、authorization、evidence、generation、citation、injection、performance、reliability、cost の品質・安全信号を version/slice 別に集約し、承認済み monitoring profile への違反または drift を検出したとき、責任者への通知と承認済みの安全な縮退・隔離・rollback 対応を実行すること。

この要件は設計・domain primitive・local testを保持するが、live scheduled production pathでは満たさない。

## 根拠と意図

公開前 benchmark 後の drift 検出は有用だが、現行実装は5分ごとに増加し続ける S3 prefix 全体を列挙し、対象windowを読み込み後にfilterする。利用者操作がなくても LIST/GET/PUT/Lambda/Logs/SNS周辺コストが発生するため、MVPの現行価値に対して過剰と判断した。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-093` |
| 説明 | production RAG control loop。現行MVPではdeferred |
| 根拠 | 将来のdrift検出候補。現時点はcost-first decisionを優先 |
| 源泉 | RAGガイド §7、§8.4–8.8、requirements baseline、owner decision 2026-07-22 |
| Actor / trigger | 将来のapproved monitoring window / critical event / version change |
| 種類 | 機能要求 / production monitoring / optional advanced control |
| 依存関係 | `FR-074`, `FR-075`, `FR-088`, `FR-089`, `SQ-005`–`SQ-015`, approved runbook |
| 衝突 | continuous validation と idle時の recurring cloud cost |
| 受け入れ基準 | `AC-FR093-001`, `AC-FR093-002`, `AC-FR093-003` |
| 優先度 | C |
| 安定性 | Low |
| Confidence | owner_decision |
| 所有者 | Product / FinOps / RAG Ops |
| 変更履歴 | 2026-07-11 初版、2026-07-22 cost-first modeで延期 |

## 受け入れ条件

### AC-FR093-001 cost-priority scheduled entrypoint

- Given: EventBridge が既存 `RagQualityMonitorFunction` を起動する
- When: cost-first modeのscheduled handlerが実行される
- Then: S3 prefix listing、source sample/observation全件読込、benchmark列挙、alert/action処理を行わず、active policyのdirect GETとsafety-stateのdirect PUTだけで終了する

### AC-FR093-002 full monitoring（deferred）

- Given: time-partitioned/indexed source、approved profile、cost ceiling、retentionがある
- When: ownerがfull monitoringを明示的に再有効化する
- Then: version/slice別signalを欠損補完なしで集約し、alertとapproved safe actionを実行できる

### AC-FR093-003 recurring cost guard

- Given: pending dataまたは新規sampleが0件である
- When: background controlがidle状態を確認する
- Then: 空を確認するためのS3 LISTや全件GET、observation/alert/action PUT、SNS publishを実行しない。暫定compatibility heartbeatは1回あたりactive policy GET 1件、safety-state PUT 1件、zero-failure metrics log 1件を上限とし、物理resource削除taskでさらに縮退する

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | Deferred | full control loopは現行MVPの必須価値ではない |
| 十分性 | Not active | domain implementationは保持するがscheduled pathはheartbeatのみ |
| 理解容易性 | OK | active behaviorと将来要件を分離した |
| 一貫性 | OK | release gateやper-run traceは別要件として維持可能 |
| 標準・契約適合 | Trade-off accepted | continuous validationよりcost-first product decisionを優先 |
| 実現可能性 | Future | queue/index/time partitionへの再設計が必要 |
| 検証可能性 | OK | scheduled handlerのcall surfaceでListObjectsV2不在を検証できる |
| ニーズ適合 | OK | 利用者が少ないMVPで予算を優先する |
| 原子性 | OK | compatibility heartbeatのみを独立させた |
| 実装適合 | Deferred（confirmed） | producer/monitor/domain testsは残る。scheduled workerはaggregation/evaluationを呼ばずheartbeatのみを保存する |
| 合意 | confirmed | 2026-07-22 ownerが常時monitoring不要を決定 |

## トレース

- 後方: RAGガイド、`FR-074`, `FR-075`, `SQ-005`–`SQ-015`、2026-07-22 AWS cost investigation。
- 前方: low-cost event-driven monitoring design、retention/index strategy、cost budget/alarm、explicit opt-in deployment profile。
