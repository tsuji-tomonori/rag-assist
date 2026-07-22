from pathlib import Path


def replace_exact(path: str, old: str, new: str, expected: int = 1) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} matches, found {count}: {old[:100]!r}")
    target.write_text(text.replace(old, new))


stack = "infra/lib/memorag-mvp-stack.ts"
replace_exact(stack, '      RAG_MONITORING_REQUIRED: "1",', '      RAG_MONITORING_REQUIRED: "0",')
replace_exact(
    stack,
    '''    const revocationCleanupSchedule = new events.Rule(this, "RevocationCleanupSchedule", {
      description: "Reconcile tenant-scoped deny-first revocation cleanup manifests.",
      schedule: events.Schedule.rate(Duration.minutes(1))
    })''',
    '''    const revocationCleanupSchedule = new events.Rule(this, "RevocationCleanupSchedule", {
      description: "Disabled by the cost-first MVP decision; explicit cleanup remains available.",
      schedule: events.Schedule.rate(Duration.minutes(1)),
      enabled: false
    })'''
)
replace_exact(
    stack,
    '''    const securityAuditReconciliationSchedule = new events.Rule(this, "SecurityAuditReconciliationSchedule", {
      description: "Finalize tenant-scoped security mutation audits after authoritative state reconciliation.",
      schedule: events.Schedule.rate(Duration.minutes(1))
    })''',
    '''    const securityAuditReconciliationSchedule = new events.Rule(this, "SecurityAuditReconciliationSchedule", {
      description: "Disabled by the cost-first MVP decision; explicit audit repair remains available.",
      schedule: events.Schedule.rate(Duration.minutes(1)),
      enabled: false
    })'''
)
replace_exact(
    stack,
    '''    const ragQualityMonitorSchedule = new events.Rule(this, "RagQualityMonitorSchedule", {
      description: "Evaluate production RAG quality/security signals and apply the approved safety runbook.",
      schedule: events.Schedule.rate(Duration.minutes(5))
    })''',
    '''    const ragQualityMonitorSchedule = new events.Rule(this, "RagQualityMonitorSchedule", {
      description: "Disabled by the cost-first MVP decision; continuous RAG monitoring is deferred.",
      schedule: events.Schedule.rate(Duration.minutes(5)),
      enabled: false
    })'''
)

interlock = "apps/api/src/rag/quality-control/production-rag-monitor.ts"
replace_exact(
    interlock,
    '''  const required = input.required ?? process.env.RAG_MONITORING_REQUIRED === "1"
  const operation = input.operation ?? "chat"''',
    '''  const required = input.required ?? process.env.RAG_MONITORING_REQUIRED === "1"
  if (!required) return
  const operation = input.operation ?? "chat"'''
)

infra_test = "infra/test/memorag-mvp-stack.test.ts"
replace_exact(infra_test, '        RAG_MONITORING_REQUIRED: "1",', '        RAG_MONITORING_REQUIRED: "0",')
replace_exact(
    infra_test,
    '''  template.hasResourceProperties("AWS::Events::Rule", {
    ScheduleExpression: "rate(5 minutes)",
    State: "ENABLED"
  })''',
    '''  const backgroundSchedules = Object.entries(template.toJSON().Resources ?? {})
    .filter(([logicalId, resource]) => (
      ["RagQualityMonitorSchedule", "RevocationCleanupSchedule", "SecurityAuditReconciliationSchedule"]
        .some((prefix) => logicalId.startsWith(prefix))
      && (resource as any).Type === "AWS::Events::Rule"
    ))
  assert.equal(backgroundSchedules.length, 3)
  for (const [, schedule] of backgroundSchedules) {
    assert.equal((schedule as any).Properties.State, "DISABLED")
  }'''
)
replace_exact(infra_test, '  assert.equal(schedule.Properties.State, "ENABLED")', '  assert.equal(schedule.Properties.State, "DISABLED")')

monitor_test = "apps/api/src/rag/production-rag-monitor.test.ts"
replace_exact(
    monitor_test,
    '''test("FR-093 required monitoring fails closed when safety state is absent", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-monitor-missing-")))
  await assert.rejects(
    () => assertRagSafetyInterlock({ objectStore: store, runtimeProfileVersion: "runtime-v2", required: true }),
    /safety state is unavailable/
  )
  await assert.doesNotReject(
    () => assertRagSafetyInterlock({ objectStore: store, runtimeProfileVersion: "runtime-v2", required: false })
  )
})''',
    '''test("FR-093 required monitoring fails closed when safety state is absent", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-monitor-missing-")))
  await assert.rejects(
    () => assertRagSafetyInterlock({ objectStore: store, runtimeProfileVersion: "runtime-v2", required: true }),
    /safety state is unavailable/
  )
  await assert.doesNotReject(
    () => assertRagSafetyInterlock({ objectStore: store, runtimeProfileVersion: "runtime-v2", required: false })
  )
})

test("cost-first mode ignores a stale safety-state object when monitoring is disabled", async () => {
  const store = new LocalObjectStore(await mkdtemp(path.join(os.tmpdir(), "rag-monitor-disabled-")))
  await store.putText(RAG_SAFETY_STATE_KEY, JSON.stringify({
    schemaVersion: 1,
    stateVersion: 1,
    policyId: "legacy-monitor",
    policyVersion: "legacy",
    activeRuntimeProfileVersion: "runtime-v1",
    quarantinedRuntimeProfileVersions: ["runtime-v2"],
    promotionFrozen: true,
    documentQuarantineRequired: true,
    responseMode: "refuse",
    updatedAt: "2020-01-01T00:00:00.000Z",
    validUntil: "2020-01-01T00:10:00.000Z"
  } satisfies RagSafetyState))

  await assert.doesNotReject(() => assertRagSafetyInterlock({
    objectStore: store,
    runtimeProfileVersion: "runtime-v2",
    required: false,
    now: "2026-07-22T00:00:00.000Z"
  }))
})'''
)

fr093 = Path("docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/03_RAG検索品質制御/07_安全なRAGライフサイクル/REQ_FUNCTIONAL_093.md")
fr093.write_text('''# FR-093 本番 RAG 品質・安全 monitoring control loop

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

- `RagQualityMonitorSchedule` は CloudFormation 上で `DISABLED` とする。
- API / worker は `RAG_MONITORING_REQUIRED=0` とし、既存または期限切れの safety-state objectを読まずに通常処理を継続する。
- source sample / observation prefix 全列挙、benchmark run enumeration、集約、alert、SNS通知、safe action、compatibility heartbeatを実行しない。
- full monitoringを再導入する場合は、time-partitioned key、queue/index、retention、bounded reads、`SQ-015` cost ceiling、owner承認を先に満たす。

## 延期された要件

- FR-093: システムは、本番 RAG の ingest、retrieval、authorization、evidence、generation、citation、injection、performance、reliability、cost の品質・安全信号を version/slice 別に集約し、承認済み monitoring profile への違反または drift を検出したとき、責任者への通知と承認済みの安全な縮退・隔離・rollback 対応を実行すること。

この要件は設計・domain primitive・local testを保持するが、live scheduled production pathでは満たさない。

## 根拠と意図

公開前 benchmark 後の drift 検出は有用だが、旧実装は5分ごとに増加し続ける S3 prefix 全体を列挙し、対象windowを読み込み後にfilterしていた。利用者操作がなくても LIST/GET/PUT/Lambda/Logs/SNS周辺コストが発生するため、MVPの現行価値に対して過剰と判断した。

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
| 変更履歴 | 2026-07-11 初版、2026-07-22 cost-first modeで延期、2026-07-23 EventBridge ruleを無効化 |

## 受け入れ条件

### AC-FR093-001 cost-priority deployment

- Given: cost-first MVP stackをsynthesize/deployする
- When: EventBridge rulesとAPI runtime environmentを確認する
- Then: `RagQualityMonitorSchedule`は`DISABLED`、`RAG_MONITORING_REQUIRED=0`であり、scheduled monitoring Lambdaは起動されない

### AC-FR093-002 full monitoring（deferred）

- Given: time-partitioned/indexed source、approved profile、cost ceiling、retentionがある
- When: ownerがfull monitoringを明示的に再有効化する
- Then: version/slice別signalを欠損補完なしで集約し、alertとapproved safe actionを実行できる

### AC-FR093-003 recurring cost guard

- Given: pending dataまたは新規sampleが0件である
- When: 24時間stackを維持する
- Then: RAG monitoring由来のEventBridge invocation、Lambda execution、S3 LIST/GET/PUT、observation/alert/action生成、SNS publishを0件とする

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | Deferred | full control loopは現行MVPの必須価値ではない |
| 十分性 | Not active | domain implementationは保持するがscheduled pathは停止 |
| 理解容易性 | OK | active behaviorと将来要件を分離した |
| 一貫性 | OK | release gateやper-run traceは別要件として維持可能 |
| 標準・契約適合 | Trade-off accepted | continuous validationよりcost-first product decisionを優先 |
| 実現可能性 | Future | queue/index/time partitionへの再設計が必要 |
| 検証可能性 | OK | CloudFormation rule stateとruntime envを確認できる |
| ニーズ適合 | OK | 利用者が少ないMVPで予算を優先する |
| 原子性 | OK | full monitoring停止を単独で検証できる |
| 実装適合 | Deferred（confirmed） | domain source/testsは残る。EventBridge scheduleはdisabled、runtime interlockはoptional modeでbypassする |
| 合意 | confirmed | 2026-07-22 ownerが常時monitoring不要を決定 |

## トレース

- 後方: RAGガイド、`FR-074`, `FR-075`, `SQ-005`–`SQ-015`、2026-07-22 AWS cost investigation。
- 前方: low-cost event-driven monitoring design、retention/index strategy、cost budget/alarm、explicit opt-in deployment profile。
''')

ops = Path("docs/4_運用_OPS/21_監視_MONITORING/OPS_MONITORING_001.md")
ops_text = ops.read_text()
start = ops_text.index("## 現行 cost-first mode")
end = ops_text.index("## 現行の観測点")
replacement = '''## 現行 cost-first mode

| Control | CloudFormation / runtime state | S3 LIST | Scheduled invocation |
| --- | --- | ---: | ---: |
| RAG quality monitor | `RagQualityMonitorSchedule.State=DISABLED`、`RAG_MONITORING_REQUIRED=0` | 0 | 0 |
| Revocation cleanup | `RevocationCleanupSchedule.State=DISABLED` | 0 | 0 |
| Security audit reconciliation | `SecurityAuditReconciliationSchedule.State=DISABLED` | 0 | 0 |

3つのdomain primitiveとLambda sourceは、明示保守や将来のevent-driven再設計に備えて保持する。停止対象はEventBridge scheduleとproduction runtime dependencyである。

## 残る費用

EventBridge rule、Lambda、IAM、log group、alarm、SNS topicはCloudFormation上に残るが、ruleがdisabledのため定期Lambda invocationと定期log ingestionは発生しない。残余候補はresource自体の固定費、API実利用、deploy、benchmark、手動実行である。

物理resource削除はgenerated infra inventory、CDK snapshot、change set、deploy/rollbackを伴う独立IaC最小化として `tasks/todo/20260722-physical-remove-unused-background-control-infra.md` で追跡する。

## 維持する安全境界

### FR-066

- mutation時のauthoritative denyは維持する。
- periodic physical cleanupは停止する。
- 残存artifactの削除が必要な場合はtenant/resource/operationを明示した保守処理で行う。

### FR-086

- mutation pathのdurable audit intent生成は維持する。
- pending intentを探すperiodic S3 scan/finalizationは停止する。
- `reconciliation_required`が発生した場合は対象intent IDを明示してrepairする。

### FR-093

- full source aggregation、drift detection、alert、safe actionは停止する。
- API/workerは`RAG_MONITORING_REQUIRED=0`で、既存または期限切れのsafety-state objectを参照しない。
- monitoring Lambdaのcompatibility heartbeatも実行しない。

'''
ops.write_text(ops_text[:start] + replacement + ops_text[end:])

ops_text = ops.read_text()
if "## Compatibility heartbeat確認" in ops_text:
    hb_start = ops_text.index("## Compatibility heartbeat確認")
    hb_end = ops_text.index("## Explicit maintenance")
    ops_text = ops_text[:hb_start] + '''## EventBridge停止確認

CloudFormation templateまたはdeployed ruleで次を確認する。

- `RagQualityMonitorSchedule`: `DISABLED`
- `RevocationCleanupSchedule`: `DISABLED`
- `SecurityAuditReconciliationSchedule`: `DISABLED`
- API / Heavy API / worker環境変数: `RAG_MONITORING_REQUIRED=0`

旧`quality-control/runtime/safety-state.json`が残っていても、cost-first runtimeは読み込まない。

''' + ops_text[hb_end:]
ops_text = ops_text.replace("3 scheduled entrypointがS3 prefix listingを行わないこと。", "3つのEventBridge scheduleがDISABLEDで、scheduled Lambda invocationを行わないこと。")
ops_text = ops_text.replace("RAG compatibility heartbeatがdirect GET/PUTだけでAPI availabilityを維持すること。", "RAG monitoringをoptional化し、stale safety-stateに依存せずAPI availabilityを維持すること。")
ops.write_text(ops_text)

for path in [
    "tasks/done/20260722-2300-cost-first-disable-background-s3-scans.md",
    "reports/working/20260722-2330-cost-first-disable-background-s3-scans.md",
    "tasks/todo/20260722-physical-remove-unused-background-control-infra.md",
]:
    target = Path(path)
    text = target.read_text()
    text = text.replace("compatibility heartbeatは5分ごとにS3 GET 1件、PUT 1件、zero-failure metrics logを実行する。", "EventBridge schedulesをdisabledにし、compatibility heartbeat、S3 GET/PUT、metrics logを定期実行しない。")
    text = text.replace("EventBridge/Lambda/Logs/Alarm/SNSの小額costは残る。", "EventBridge/Lambda/Logs/Alarm/SNS resourceは残るが、disabled rule由来の定期invocation/log costは停止する。")
    text = text.replace("RAG monitorを物理削除する前に、`RAG_MONITORING_REQUIRED`とsafety stateの依存を解消する必要があります。", "`RAG_MONITORING_REQUIRED=0`とstale safety-state bypassは実装済みであり、残る作業はresourceの物理削除である。")
    text = text.replace("1. deploy時に十分長いvalidityのnormal stateを作成する\n2. `RAG_MONITORING_REQUIRED`をcost-first production profileでは無効化する\n3. request pathで有料pollingを伴わずにstateを導出する", "`RAG_MONITORING_REQUIRED=0`とoptional interlock bypassを維持する")
    target.write_text(text)
