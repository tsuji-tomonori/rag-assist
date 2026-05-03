import { type ChangeEvent, useEffect, useMemo, useState } from "react"
import type { DebugStep, DebugTrace } from "../types.js"
import { Icon } from "../../../shared/components/Icon.js"
import { downloadDebugTrace } from "../../../shared/utils/downloads.js"
import { formatLatency } from "../../../shared/utils/format.js"
import {
  buildDebugReplayEnvelope,
  buildEvidenceRows,
  extractAnswerSupport,
  extractContextAssembly,
  extractFactCoverage,
  parseDebugReplayJson,
  stringifyDebugJson,
  type DebugGraphNode,
  type DebugReplayEnvelope,
  type FactCoverageRow
} from "../utils/debugTraceReplay.js"

export function DebugPanel({
  trace,
  pending = false,
  pendingQuestion,
  allExpanded,
  expandedStepId,
  onToggleAll,
  onToggleStep
}: {
  trace?: DebugTrace
  pending?: boolean
  pendingQuestion?: string
  allExpanded: boolean
  expandedStepId: number | null
  onToggleAll: () => void
  onToggleStep: (stepId: number) => void
}) {
  const [replayEnvelope, setReplayEnvelope] = useState<DebugReplayEnvelope | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const envelope = useMemo(() => (pending ? null : replayEnvelope ?? (trace ? buildDebugReplayEnvelope(trace) : null)), [pending, replayEnvelope, trace])
  const activeTrace = envelope?.rawTrace ?? trace
  const steps = pending ? getProcessingSteps(pendingQuestion) : trace?.steps ?? getPlaceholderSteps()
  const selectedNode = envelope?.graph.nodes.find((node) => node.id === selectedNodeId) ?? envelope?.graph.nodes[0]
  const selectedDetail = selectedNode ? envelope?.details[selectedNode.detailRef] : undefined
  const statusLabel = pending
    ? "処理中"
    : envelope
      ? envelope.runSummary.status === "answered"
        ? "回答"
        : envelope.runSummary.status === "refused"
          ? "拒否"
          : envelope.runSummary.status === "warning"
            ? "注意"
            : "失敗"
      : "未実行"
  const factCoverage = activeTrace ? extractFactCoverage(activeTrace) : []
  const answerSupport = activeTrace ? extractAnswerSupport(activeTrace) : undefined
  const contextAssembly = activeTrace ? extractContextAssembly(activeTrace) : undefined
  const evidenceRows = activeTrace ? buildEvidenceRows(activeTrace) : []

  useEffect(() => {
    setSelectedNodeId(null)
  }, [trace?.runId, replayEnvelope?.runSummary.runId])

  async function onUploadDebugJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ""
    if (!file) return

    try {
      const parsed = JSON.parse(await file.text()) as unknown
      const nextEnvelope = parseDebugReplayJson(parsed)
      setReplayEnvelope(nextEnvelope)
      setSelectedNodeId(nextEnvelope.graph.nodes[0]?.id ?? null)
      setUploadError(null)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : String(error))
    }
  }

  function clearReplay() {
    setReplayEnvelope(null)
    setUploadError(null)
    setSelectedNodeId(null)
  }

  return (
    <aside className={`debug-card ${pending ? "processing" : ""}`} aria-label="デバッグパネル" aria-busy={pending}>
      <header className="debug-head">
        <div>
          <h2>デバッグパネル</h2>
          <span>{pending ? "実行中" : envelope ? `${envelope.graph.nodes.length} ノード` : `${steps.length} ステップ`}</span>
          {replayEnvelope && <span className="debug-source-chip">ローカルJSON</span>}
        </div>
        <div className="debug-head-actions">
          <button type="button" onClick={() => void downloadDebugTrace(activeTrace)} disabled={!activeTrace || pending || Boolean(replayEnvelope)} title="保存済みJSONをダウンロード">
            <Icon name="download" />
            <span>保存JSON</span>
          </button>
          <button type="button" onClick={() => downloadDebugReplayEnvelope(envelope)} disabled={!envelope || pending} title="可視化JSONをダウンロード">
            <Icon name="download" />
            <span>可視化JSON</span>
          </button>
          <label className="debug-upload-button" title="JSONをアップロード">
            <Icon name="plus" />
            <span>JSONをアップロード</span>
            <input type="file" accept="application/json,.json" onChange={(event) => void onUploadDebugJson(event)} />
          </label>
          {replayEnvelope && (
            <button type="button" onClick={clearReplay} title="アップロード表示を解除">
              解除
            </button>
          )}
          {!envelope && (
            <button type="button" onClick={onToggleAll}>{allExpanded ? "すべて閉じる" : "すべて展開"}</button>
          )}
          <button type="button" title="拡大表示">
            <Icon name="expand" />
          </button>
        </div>
      </header>

      {envelope ? (
        <div className="debug-console">
          <DebugRunSummaryView envelope={envelope} uploadError={uploadError} />
          <div className="debug-flow-layout">
            <div className="debug-flow-board" aria-label="RAG実行フローチャート">
              {envelope.graph.nodes.map((node, index) => (
                <DebugFlowNodeButton
                  key={node.id}
                  node={node}
                  selected={selectedNode?.id === node.id}
                  edgeLabel={index > 0 ? envelope.graph.edges[index - 1]?.label : undefined}
                  onSelect={() => setSelectedNodeId(node.id)}
                />
              ))}
            </div>
            <DebugNodeDetailPanel node={selectedNode} detail={selectedDetail} />
          </div>
          <div className="debug-diagnostics-grid">
            <FactCoverageTable rows={factCoverage} />
            <EvidenceDebugTable rows={evidenceRows} citationsCount={activeTrace?.citations.length ?? 0} />
            <AnswerSupportPanel support={answerSupport} />
            <ContextAssemblyPanel contextAssembly={contextAssembly} />
          </div>
        </div>
      ) : (
        <div className="debug-steps">
          {steps.map((step) => {
            const expanded = allExpanded || expandedStepId === step.id
            return (
              <article className={`debug-step ${step.status} ${pending ? "processing" : ""}`} key={step.id}>
                <div className="step-index">{step.id}</div>
                <div className="step-body">
                  <button className="step-summary" type="button" onClick={() => onToggleStep(step.id)}>
                    <span className="step-state">
                      {pending ? <span className="loading-spinner" aria-hidden="true" /> : <Icon name={step.status === "warning" ? "warning" : "check"} />}
                    </span>
                    <strong>{step.label}</strong>
                    <span className="step-latency">{formatLatency(step.latencyMs)}</span>
                    {step.modelId && <span className="model-chip">{step.modelId}</span>}
                    {step.hitCount !== undefined && <span className="sub-chip">ヒット数: {step.hitCount}件</span>}
                    {step.tokenCount !== undefined && <span className="sub-chip">トークン: {step.tokenCount}</span>}
                    <span className="step-description">{step.summary}</span>
                    <Icon name="chevron" />
                  </button>
                  {expanded && step.detail && <pre className="step-detail">{step.detail}</pre>}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <footer className={`debug-footer ${pending ? "processing" : activeTrace?.status ?? "idle"}`}>
        <span className="footer-status">
          {pending ? <span className="loading-spinner" aria-hidden="true" /> : <Icon name={activeTrace?.status === "warning" ? "warning" : "check"} />}
          <strong>{statusLabel}</strong>
        </span>
        <span>{pending ? "検索と回答生成を実行しています" : activeTrace ? (activeTrace.isAnswerable ? "正常に完了しました" : "回答拒否として完了しました") : "質問すると実行トレースを保存します"}</span>
        <span className="footer-latency">合計レイテンシ <strong>{pending ? "計測中" : activeTrace ? formatLatency(activeTrace.totalLatencyMs) : "-"}</strong></span>
      </footer>
    </aside>
  )
}

function DebugRunSummaryView({ envelope, uploadError }: { envelope: DebugReplayEnvelope; uploadError: string | null }) {
  const summary = envelope.runSummary
  const versions = envelope.pipelineVersions
  return (
    <section className="debug-run-summary" aria-label="実行サマリ">
      <div>
        <span className={`debug-status-badge ${summary.status}`}>{summary.status}</span>
        <strong>{summary.runId}</strong>
        <span>{summary.isAnswerable ? "answerable" : "refusal"}</span>
      </div>
      <p>{summary.question}</p>
      <dl>
        <div>
          <dt>latency</dt>
          <dd>{formatLatency(summary.totalLatencyMs)}</dd>
        </div>
        <div>
          <dt>model</dt>
          <dd>{String(versions.modelId ?? "-")}</dd>
        </div>
        <div>
          <dt>embedding</dt>
          <dd>{String(versions.embeddingModelId ?? "-")}</dd>
        </div>
        <div>
          <dt>failure</dt>
          <dd>{summary.mainFailureStage ?? summary.refusalReason ?? "-"}</dd>
        </div>
      </dl>
      {uploadError && <p className="debug-upload-error">{uploadError}</p>}
    </section>
  )
}

function DebugFlowNodeButton({
  node,
  selected,
  edgeLabel,
  onSelect
}: {
  node: DebugGraphNode
  selected: boolean
  edgeLabel?: string
  onSelect: () => void
}) {
  return (
    <div className="debug-flow-item">
      {edgeLabel && <span className={`debug-flow-edge-label ${edgeLabel === "continue_search" ? "loop" : ""}`}>{edgeLabel}</span>}
      <button
        type="button"
        className={`debug-flow-node ${node.status} ${node.type} ${selected ? "selected" : ""}`}
        onClick={onSelect}
        aria-pressed={selected}
      >
        <span className="debug-flow-group">{formatGraphGroup(node.group)}</span>
        <strong>{node.label}</strong>
        <span>{node.iteration ? `#${node.iteration}` : formatLatency(node.latencyMs)}</span>
        {node.decision && <em>{node.decision}</em>}
      </button>
    </div>
  )
}

function DebugNodeDetailPanel({ node, detail }: { node?: DebugGraphNode; detail: unknown }) {
  return (
    <section className="debug-node-detail" aria-label="ノード詳細">
      <div className="debug-node-detail-head">
        <span>ノード詳細</span>
        <strong>{node?.label ?? "未選択"}</strong>
      </div>
      {node ? (
        <>
          <dl className="debug-node-meta">
            <div>
              <dt>status</dt>
              <dd>{node.status}</dd>
            </div>
            <div>
              <dt>type</dt>
              <dd>{node.type}</dd>
            </div>
            <div>
              <dt>group</dt>
              <dd>{formatGraphGroup(node.group)}</dd>
            </div>
            <div>
              <dt>latency</dt>
              <dd>{formatLatency(node.latencyMs)}</dd>
            </div>
          </dl>
          {node.summary && <p className="debug-node-summary">{node.summary}</p>}
          <pre className="debug-json-block">{stringifyDebugJson(detail ?? {})}</pre>
        </>
      ) : (
        <p>フローチャートのノードを選択してください。</p>
      )}
    </section>
  )
}

function FactCoverageTable({ rows }: { rows: FactCoverageRow[] }) {
  return (
    <section className="debug-diagnostic-panel" aria-label="Fact coverage">
      <h3>Fact coverage</h3>
      {rows.length === 0 ? (
        <p>retrieval evaluator の fact coverage はありません。</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Fact</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.description}</strong>
                  <span>{row.id}</span>
                </td>
                <td>
                  <span className={`debug-mini-badge ${row.status}`}>{row.status}</span>
                </td>
                <td>{row.reason ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function EvidenceDebugTable({ rows, citationsCount }: { rows: ReturnType<typeof buildEvidenceRows>; citationsCount: number }) {
  return (
    <section className="debug-diagnostic-panel" aria-label="Evidence viewer">
      <h3>Evidence</h3>
      <p>
        retrieved {rows.length} / cited {citationsCount}
      </p>
      {rows.length === 0 ? (
        <p>evidence はありません。</p>
      ) : (
        <div className="debug-evidence-list">
          {rows.slice(0, 12).map((row) => (
            <article key={`${row.documentId}:${row.chunkId ?? row.fileName}`}>
              <div>
                <strong>{row.chunkId ?? row.documentId}</strong>
                <span>{row.fileName}</span>
                <span>{row.score.toFixed(3)}</span>
              </div>
              <div className="debug-tag-row">
                {row.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <p>{row.text}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function AnswerSupportPanel({ support }: { support?: Record<string, unknown> }) {
  return (
    <section className="debug-diagnostic-panel" aria-label="Answer support">
      <h3>Answer support</h3>
      {support ? <pre className="debug-json-block compact">{stringifyDebugJson(support)}</pre> : <p>answer support の詳細はありません。</p>}
    </section>
  )
}

function ContextAssemblyPanel({ contextAssembly }: { contextAssembly?: Record<string, unknown> }) {
  return (
    <section className="debug-diagnostic-panel" aria-label="Context assembly">
      <h3>Context</h3>
      {contextAssembly ? <pre className="debug-json-block compact">{stringifyDebugJson(contextAssembly)}</pre> : <p>context assembly の詳細は trace にありません。</p>}
    </section>
  )
}

function formatGraphGroup(group: DebugGraphNode["group"]): string {
  switch (group) {
    case "preprocess":
      return "preprocess"
    case "search-loop":
      return "search loop"
    case "context":
      return "context"
    case "answer":
      return "answer"
    case "finalize":
      return "finalize"
    case "other":
      return "other"
  }
}

function downloadDebugReplayEnvelope(envelope?: DebugReplayEnvelope | null) {
  if (!envelope) return

  const json = stringifyDebugJson(envelope)
  const blob = new Blob([json], { type: "application/json;charset=utf-8" })
  const objectUrl = typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : undefined
  const link = document.createElement("a")
  link.href = objectUrl ?? `data:application/json;charset=utf-8,${encodeURIComponent(json)}`
  link.download = `debug-replay-${sanitizeFileName(envelope.runSummary.runId)}.json`
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
  if (objectUrl && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(objectUrl)
}

function sanitizeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_")
}

function getPlaceholderSteps(): DebugStep[] {
  const now = new Date().toISOString()
  return ["入力解析", "クエリ正規化", "MemoRAGメモリ検索", "ベクトル検索", "再ランキング", "根拠チェック", "Bedrock推論", "最終回答"].map((label, index) => ({
    id: index + 1,
    label,
    status: "success" as const,
    latencyMs: 0,
    summary: "質問を送信すると、このステップの実行内容が表示されます。",
    startedAt: now,
    completedAt: now
  }))
}

function getProcessingSteps(question?: string): DebugStep[] {
  const now = new Date().toISOString()
  const compactQuestion = question?.replace(/\s+/g, " ").trim()
  const summaries = [
    compactQuestion ? `質問を受け付けました: ${compactQuestion.slice(0, 72)}` : "質問を受け付けました。",
    "検索しやすい形に整えています。",
    "関連するメモリとドキュメントを探しています。",
    "候補の根拠を確認しています。",
    "回答を生成しています。"
  ]

  return ["入力受付", "クエリ準備", "根拠検索", "根拠チェック", "回答生成"].map((label, index) => ({
    id: index + 1,
    label,
    status: "success" as const,
    latencyMs: 0,
    summary: summaries[index] ?? "処理しています。",
    startedAt: now,
    completedAt: now
  }))
}
