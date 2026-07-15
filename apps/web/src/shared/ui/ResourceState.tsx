import { useEffect, useId, useRef, type ReactNode } from "react"
import { canShowResourceContent, createEmptyResourceState } from "./resourceStateModel.js"

export type UiStateTarget = {
  id: string
  label: string
  regionId: string
  source: string
}

export type UiResourcePartState = {
  id: string
  label: string
  status: "loading" | "ready" | "failed" | "permission" | "stale" | "retrying"
  asOf?: string
  requestReference?: string
}

type UiResourceStateBase = {
  target: UiStateTarget
  parts: UiResourcePartState[]
}

export type UiResourceState =
  | (UiResourceStateBase & {
      kind: "loading"
      operation: string
      retainContent: boolean
    })
  | (UiResourceStateBase & {
      kind: "content"
      asOf: string
    })
  | (UiResourceStateBase & {
      kind: "empty"
      scope: string
      asOf: string
    })
  | (UiResourceStateBase & {
      kind: "error"
      message: string
    })
  | (UiResourceStateBase & {
      kind: "permission"
      message: string
    })
  | (UiResourceStateBase & {
      kind: "partial"
      message: string
      asOf?: string
    })
  | (UiResourceStateBase & {
      kind: "stale"
      message: string
      asOf: string
    })
  | (UiResourceStateBase & {
      kind: "retrying"
      operation: string
      retainContent: boolean
    })
  | (UiResourceStateBase & {
      kind: "recovered"
      message: string
      asOf: string
    })

export function ResourceStateBoundary({
  state,
  isEmpty = false,
  emptyScope,
  emptyTitle,
  emptyDescription,
  onRetry,
  onBack,
  onSupport,
  children,
  className
}: {
  state: UiResourceState
  isEmpty?: boolean
  emptyScope?: string
  emptyTitle?: string
  emptyDescription?: string
  onRetry?: () => void
  onBack?: () => void
  onSupport?: () => void
  children: ReactNode
  className?: string
}) {
  const busy = state.kind === "loading" || state.kind === "retrying"
  const visibleState = state.kind === "content" && isEmpty
    ? createEmptyResourceState(state.target, emptyScope ?? state.target.label, state.asOf)
    : state
  const showContent = canShowResourceContent(visibleState) && visibleState.kind !== "empty"
  const classes = ["ui-resource-boundary", className].filter(Boolean).join(" ")

  return (
    <div id={state.target.regionId} className={classes} aria-busy={busy ? "true" : undefined}>
      {visibleState.kind !== "content" && (
        <ResourceStatePanel
          state={visibleState}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          onRetry={onRetry}
          onBack={onBack}
          onSupport={onSupport}
        />
      )}
      {showContent ? children : null}
    </div>
  )
}

export function ResourceStatePanel({
  state,
  emptyTitle,
  emptyDescription,
  onRetry,
  onBack,
  onSupport,
  focusOnMount = false
}: {
  state: Exclude<UiResourceState, { kind: "content" }>
  emptyTitle?: string
  emptyDescription?: string
  onRetry?: () => void
  onBack?: () => void
  onSupport?: () => void
  focusOnMount?: boolean
}) {
  const headingId = useId()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const urgent = state.kind === "error" || state.kind === "permission"
  const busy = state.kind === "loading" || state.kind === "retrying"
  const presentation = statePresentation(state, emptyTitle, emptyDescription)
  const retryLabel = state.kind === "stale"
    ? "最新情報を取得"
    : state.kind === "partial"
      ? "失敗した項目を再試行"
      : "再試行"

  useEffect(() => {
    if (focusOnMount) panelRef.current?.focus()
  }, [focusOnMount])

  return (
    <div
      ref={panelRef}
      className={`ui-resource-state ui-resource-state-${state.kind}`}
      role={urgent ? "alert" : "status"}
      aria-live={urgent ? "assertive" : "polite"}
      aria-labelledby={headingId}
      data-state-kind={state.kind}
      data-state-target={state.target.id}
      tabIndex={focusOnMount ? -1 : undefined}
    >
      <div className="ui-resource-state-heading">
        <span className="ui-resource-state-marker" aria-hidden="true" />
        <strong id={headingId}>{presentation.title}</strong>
      </div>
      {presentation.description ? <p>{presentation.description}</p> : null}
      {state.kind === "partial" && <PartResultSummary parts={state.parts} />}
      {state.parts.some((part) => part.requestReference) && (
        <p className="ui-resource-state-meta">問い合わせ参照: {state.parts.flatMap((part) => part.requestReference ? [part.requestReference] : []).join(" / ")}</p>
      )}
      {state.kind === "stale" && (
        <p className="ui-resource-state-meta">
          source: {state.target.source} / 最終確認: <time dateTime={state.asOf}>{formatAsOf(state.asOf)}</time>
        </p>
      )}
      {state.kind === "recovered" && (
        <p className="ui-resource-state-meta">
          更新: <time dateTime={state.asOf}>{formatAsOf(state.asOf)}</time>
        </p>
      )}
      <div className="ui-resource-state-actions">
        {onRetry && (state.kind === "error" || state.kind === "partial" || state.kind === "stale") ? (
          <button type="button" onClick={onRetry} aria-controls={state.target.regionId}>{retryLabel}</button>
        ) : null}
        {busy ? <button type="button" disabled aria-controls={state.target.regionId}>処理中</button> : null}
        {onBack && (state.kind === "permission" || state.kind === "empty") ? <button type="button" onClick={onBack}>戻る</button> : null}
        {onSupport && (state.kind === "error" || state.kind === "permission") ? <button type="button" onClick={onSupport}>サポート情報</button> : null}
      </div>
    </div>
  )
}

function PartResultSummary({ parts }: { parts: UiResourcePartState[] }) {
  const succeeded = parts.filter((part) => part.status === "ready")
  const unavailable = parts.filter((part) => part.status === "failed" || part.status === "permission" || part.status === "stale")
  return (
    <dl className="ui-resource-part-summary">
      <div>
        <dt>取得済み</dt>
        <dd>{succeeded.length > 0 ? succeeded.map((part) => part.label).join("、") : "なし"}</dd>
      </div>
      <div>
        <dt>未更新</dt>
        <dd>{unavailable.length > 0 ? unavailable.map((part) => part.status === "permission" ? `${part.label}（権限なし）` : part.label).join("、") : "なし"}</dd>
      </div>
    </dl>
  )
}

function statePresentation(
  state: Exclude<UiResourceState, { kind: "content" }>,
  emptyTitle?: string,
  emptyDescription?: string
): { title: string; description?: string } {
  if (state.kind === "loading") return { title: `${state.target.label}を読み込んでいます`, description: state.operation }
  if (state.kind === "empty") return { title: emptyTitle ?? `${state.scope}はありません`, description: emptyDescription ?? "取得は完了しており、対象は 0 件です。" }
  if (state.kind === "error") return { title: `${state.target.label}を取得できませんでした`, description: state.message }
  if (state.kind === "permission") return { title: `${state.target.label}を表示できません`, description: state.message }
  if (state.kind === "partial") return { title: `${state.target.label}の一部を取得できませんでした`, description: state.message }
  if (state.kind === "stale") return { title: `${state.target.label}は最新ではありません`, description: state.message }
  if (state.kind === "retrying") return { title: `${state.target.label}を再試行しています`, description: state.operation }
  return { title: `${state.target.label}を更新しました`, description: state.message }
}

function formatAsOf(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "時刻不明"
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(parsed)
}
