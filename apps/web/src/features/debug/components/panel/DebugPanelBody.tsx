import type { DebugStep, DebugTrace } from "../../types.js"
import { Icon } from "../../../../shared/components/Icon.js"
import { formatLatency } from "../../../../shared/utils/format.js"
import {
  buildEvidenceRows,
  extractAnswerSupport,
  extractContextAssembly,
  extractFactCoverage,
  stringifyDebugJson,
  type DebugGraphNode,
  type DebugReplayEnvelope,
  type FactCoverageRow
} from "../../utils/debugTraceReplay.js"
import { formatGraphGroup } from "./debugPanelUtils.js"

export function DebugPanelBody({
  pending,
  envelope,
  activeTrace,
  steps,
  selectedNode,
  selectedDetail,
  allExpanded,
  expandedStepId,
  onSelectNode,
  onToggleStep
}: {
  pending: boolean
  envelope?: DebugReplayEnvelope | null
  activeTrace?: DebugTrace
  steps: DebugStep[]
  selectedNode?: DebugGraphNode
  selectedDetail: unknown
  allExpanded: boolean
  expandedStepId: number | null
  onSelectNode: (nodeId: string) => void
  onToggleStep: (stepId: number) => void
}) {
  const factCoverage = activeTrace ? extractFactCoverage(activeTrace) : []
  const answerSupport = activeTrace ? extractAnswerSupport(activeTrace) : undefined
  const contextAssembly = activeTrace ? extractContextAssembly(activeTrace) : undefined
  const evidenceRows = activeTrace ? buildEvidenceRows(activeTrace) : []

  return envelope ? (
    <div className="debug-console">
      <DebugRunSummaryView envelope={envelope} />
      <div className="debug-flow-layout">
        <div className="debug-flow-board" aria-label="RAG実行フローチャート">
          {envelope.graph.nodes.map((node, index) => (
            <DebugFlowNodeButton
              key={node.id}
              node={node}
              selected={selectedNode?.id === node.id}
              edgeLabel={index > 0 ? envelope.graph.edges[index - 1]?.label : undefined}
              onSelect={() => onSelectNode(node.id)}
            />
          ))}
        </div>
        <DebugNodeDetailPanel node={selectedNode} detail={selectedDetail} />
      </div>
      <DebugDiagnosticsGrid
        factCoverage={factCoverage}
        evidenceRows={evidenceRows}
        citationsCount={activeTrace?.citations.length ?? 0}
        answerSupport={answerSupport}
        contextAssembly={contextAssembly}
      />
    </div>
  ) : (
    <DebugStepList
      steps={steps}
      pending={pending}
      allExpanded={allExpanded}
      expandedStepId={expandedStepId}
      onToggleStep={onToggleStep}
    />
  )
}

function DebugRunSummaryView({ envelope }: { envelope: DebugReplayEnvelope }) {
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
          <dt>target</dt>
          <dd>{summary.targetType ?? "未設定"}</dd>
        </div>
        <div>
          <dt>visibility</dt>
          <dd>{summary.visibility ?? "未設定"}</dd>
        </div>
        <div>
          <dt>sanitize</dt>
          <dd>{summary.sanitizePolicyVersion ?? "未設定"}</dd>
        </div>
        <div>
          <dt>embedding</dt>
          <dd>{String(versions.embeddingModelId ?? "-")}</dd>
        </div>
        <div>
          <dt>redaction</dt>
          <dd>{summary.exportRedaction ? `${summary.exportRedaction.redactedFields.length} fields` : "未設定"}</dd>
        </div>
        <div>
          <dt>failure</dt>
          <dd>{summary.mainFailureStage ?? summary.refusalReason ?? "-"}</dd>
        </div>
      </dl>
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

function DebugStepList({
  steps,
  pending,
  allExpanded,
  expandedStepId,
  onToggleStep
}: {
  steps: DebugStep[]
  pending: boolean
  allExpanded: boolean
  expandedStepId: number | null
  onToggleStep: (stepId: number) => void
}) {
  return (
    <div className="debug-steps">
      {steps.map((step) => {
        const expandedStep = allExpanded || expandedStepId === step.id
        return (
          <article className={`debug-step ${step.status} ${pending ? "processing" : ""}`} key={step.id}>
            <div className="step-index">{step.id}</div>
            <div className="step-body">
              <button className="step-summary" type="button" aria-expanded={expandedStep} onClick={() => onToggleStep(step.id)}>
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
              {expandedStep && step.detail && <pre className="step-detail">{step.detail}</pre>}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function DebugDiagnosticsGrid({
  factCoverage,
  evidenceRows,
  citationsCount,
  answerSupport,
  contextAssembly
}: {
  factCoverage: FactCoverageRow[]
  evidenceRows: ReturnType<typeof buildEvidenceRows>
  citationsCount: number
  answerSupport?: Record<string, unknown>
  contextAssembly?: Record<string, unknown>
}) {
  return (
    <div className="debug-diagnostics-grid">
      <FactCoverageTable rows={factCoverage} />
      <EvidenceDebugTable rows={evidenceRows} citationsCount={citationsCount} />
      <AnswerSupportPanel support={answerSupport} />
      <ContextAssemblyPanel contextAssembly={contextAssembly} />
    </div>
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
