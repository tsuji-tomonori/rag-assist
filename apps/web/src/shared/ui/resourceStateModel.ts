import type { UiResourcePartState, UiResourceState, UiStateTarget } from "./ResourceState.js"

export function createContentResourceState(target: UiStateTarget, asOf = new Date().toISOString()): UiResourceState {
  return { kind: "content", target, parts: [], asOf }
}

export function createEmptyResourceState(
  target: UiStateTarget,
  scope: string,
  asOf = new Date().toISOString()
): UiResourceState {
  return { kind: "empty", target, parts: [], scope, asOf }
}

export function canShowResourceContent(state: UiResourceState): boolean {
  if (state.kind === "content" || state.kind === "empty" || state.kind === "partial" || state.kind === "stale" || state.kind === "recovered") return true
  return (state.kind === "loading" || state.kind === "retrying") && state.retainContent
}

export function hasConfirmedResourceResult(state: UiResourceState): boolean {
  return state.kind === "content" || state.kind === "empty" || state.kind === "partial" || state.kind === "stale" || state.kind === "recovered"
}

export function isResourceStateBusy(state: UiResourceState): boolean {
  return state.kind === "loading" || state.kind === "retrying"
}

export function resourcePartStatus(state: UiResourceState, partId: string): UiResourcePartState["status"] | undefined {
  return state.parts.find((part) => part.id === partId)?.status
}

export function isResourcePartAvailable(state: UiResourceState, partId: string): boolean {
  const status = resourcePartStatus(state, partId)
  return status === "ready" || status === "stale"
}
