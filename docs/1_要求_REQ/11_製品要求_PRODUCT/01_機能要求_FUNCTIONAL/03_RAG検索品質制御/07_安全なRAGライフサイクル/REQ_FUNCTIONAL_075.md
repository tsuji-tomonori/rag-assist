# FR-075 工程別評価と公開ゲート

- 要件ID: `FR-075`
- 種別: `REQ_FUNCTIONAL`
- 状態: Deferred for automatic deploy（cost-first mode）
- 優先度: C

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `3. RAG検索品質制御`
- L2主機能群: `3.7 安全なRAGライフサイクル`
- L3要件: `FR-075`
- 関連カテゴリ: `4. 回答検証・ガードレール`, `7. 評価・debug・benchmark`, `8. 認証・認可・管理・監査`, `FinOps`

## 現行 product decision

2026-07-23時点のMVP automatic deployは`cost_priority` profileとする。

- main push deployはproduction observation completenessを確認するためのS3 full-prefix scanを実行しない。
- repository内のapproved policyをvalidationし、model/runtime/workload/price/index/prompt/pipeline/parser/chunkerのCDK contextだけを確定する。
- automatic deployではRAG promotion gateを適用せず、deployment artifactに`promotionGateApplied=false`、`sourceObservationScan=false`、`deployAllowed=true`を記録する。
- full promotion gateは`MemoRAG CI`の明示`workflow_dispatch`または将来のowner承認済みrelease profileに限定する。
- model/prompt/index/pipeline等のRAG変更を自動公開するprofileを再導入する場合は、bounded/indexed evidence retrieval、retention、cost ceiling、owner approvalを必須とする。

## 延期された要件

- FR-075: システムは、取り込み、検索、根拠選別、生成、引用、認可・攻撃耐性、end-to-endを別々に評価し、versionedな合格条件の論理積でRAG変更の公開可否を判定すること。

この要件のpolicy evaluator、benchmark、明示CI gateは保持するが、現行cost-first automatic deployの必須前提にはしない。

## 根拠と意図

最終回答の平均点だけでは検索漏れ、根拠喪失、権限漏えい、誤拒否を区別できないため、full promotion gate自体には価値がある。一方、旧deploy workflowは5分monitorが生成した全observation履歴を`aws s3 sync`し、45分job内で完了できず、コスト削減のEventBridge変更自体をdeployできなかった。monitoringを停止した現行profileではobservation生成も止まるため、automatic deployとfull promotion gateを分離する。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `FR-075` |
| 説明 | stage-level RAG evaluation とopt-in promotion gate |
| 根拠 | RAG変更の品質評価能力を保持しつつ、cost-first infrastructure deployをblockしない |
| 源泉 | RAGガイド §7（PDF pp.156–185）、§3.8（PDF pp.93–97）、owner cost-first decision 2026-07-22/23 |
| Actor / trigger | explicit RAG release evaluation、将来のRAG promotion profile |
| 種類 | 機能要求 / evaluation / optional release control |
| 依存関係 | `FR-068`–`FR-074`, `FR-084`, `FR-088`, `FR-089`, benchmark datasets, `SQ-005`–`SQ-015` |
| 衝突 | full evidence gateと、monitoring停止中のautomatic infrastructure deploy |
| 受け入れ基準 | `AC-FR075-001`, `AC-FR075-002`, `AC-FR075-003` |
| 優先度 | C |
| 安定性 | Medium |
| Confidence | owner_decision |
| 所有者 | Product / FinOps / QA / RAG Quality |
| 変更履歴 | 2026-07-11 初版、2026-07-23 automatic deployからdefer |

## 受け入れ条件

### AC-FR075-001 明示的な工程別評価

- Given: versioned dataset、approved policy、candidate artifactがある
- When: operatorが明示promotion workflowを実行する
- Then: ingest、retrieval、evidence、generation、citation、security、performance、costを工程・slice別に評価し、欠損・未承認値・critical failureをpassへ変換しない

### AC-FR075-002 cost-first automatic deploy

- Given: `DEPLOYMENT_MODE=cost_priority`でmainまたはmanual deployを実行する
- When: deployment contextを準備する
- Then: S3 observation prefixをlist/downloadせず、repository policyをvalidationしてCDK version contextを設定し、promotion gate未適用をartifactへ明記してbuild/synth/deployへ進む

### AC-FR075-003 full gate再有効化

- Given: RAG変更をautomatic promotionする必要がある
- When: Product/FinOps/QA ownerがrelease profileを承認する
- Then: full-prefix pollingではなくindex/time partition/manifestでbounded evidenceを取得し、retention、request上限、月額見積、kill switch、rollbackを備えたgateを有効化する

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | Deferred | explicit evaluationは保持。現行automatic deployでは必須でない |
| 十分性 | Partial | evaluator/CI gateは維持。automatic deploy gateは停止 |
| 理解容易性 | OK | explicit promotionとcost-first deployを分離 |
| 一貫性 | Owner override | `SQ-015`をautomatic deployment availabilityより優先 |
| 標準・契約適合 | Trade-off accepted | full continuous validationよりMVP cost/operabilityを優先 |
| 実現可能性 | OK | local policy validationとCDK context設定でdeploy可能 |
| 検証可能性 | OK | workflow contract、artifact、GitHub Actions、CDK outputsで確認可能 |
| ニーズ適合 | OK | AWSコスト停止変更を実環境へ反映できる |
| 原子性 | OK | deploy profileのgate適用有無を規定 |
| 実装適合 | Partial（confirmed） | explicit CI gateは残る。automatic deployはcost-priority preparationへ変更 |
| 合意 | confirmed | ownerがコスト最優先とdeploy復旧を指示 |

## トレース

- 後方: `FR-019`, `FR-039`, `FR-045`, `FR-047`, `FR-048`, `SQ-015`, deploy run `29936120192`。
- 前方: explicit promotion workflow、bounded evidence index、cost-approved release profile、deployment context artifact。
