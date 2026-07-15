import { useCallback, useRef, useState } from "react"
import type { UiResourcePartState, UiResourceState, UiStateTarget } from "./ResourceState.js"
import { canShowResourceContent } from "./resourceStateModel.js"

export type ResourcePartLoader = {
  id: string
  label: string
  load: () => Promise<unknown>
}

export type ResourceLoadIntent = "initial" | "retry" | "refresh" | "background"

export function useResourceStateController<Key extends string>(targets: Record<Key, UiStateTarget>) {
  const [states, setStates] = useState<Record<Key, UiResourceState>>(() => mapTargets(targets, (target) => ({
    kind: "loading",
    target,
    parts: [],
    operation: `${target.source}から取得中`,
    retainContent: false
  })))
  const statesRef = useRef(states)
  const requestIdsRef = useRef<Record<Key, number>>(mapTargets(targets, () => 0))

  const publish = useCallback((key: Key, state: UiResourceState) => {
    statesRef.current = { ...statesRef.current, [key]: state }
    setStates(statesRef.current)
  }, [])

  const setPermission = useCallback((key: Key, message: string) => {
    const target = targets[key]
    publish(key, { kind: "permission", target, parts: [], message })
  }, [publish, targets])

  const setContent = useCallback((key: Key) => {
    const target = targets[key]
    publish(key, { kind: "content", target, parts: [], asOf: new Date().toISOString() })
  }, [publish, targets])

  const run = useCallback(async (key: Key, loaders: ResourcePartLoader[], intent: ResourceLoadIntent = "initial") => {
    if (loaders.length === 0) {
      setContent(key)
      return statesRef.current[key]
    }

    const target = targets[key]
    const previous = statesRef.current[key]
    const requestId = requestIdsRef.current[key] + 1
    requestIdsRef.current[key] = requestId
    const retainContent = canShowResourceContent(previous)
    const pendingParts = mergeParts(previous.parts, loaders.map((loader): UiResourcePartState => ({
      id: loader.id,
      label: loader.label,
      status: intent === "retry" || intent === "refresh" ? "retrying" : "loading",
      asOf: previous.parts.find((part) => part.id === loader.id)?.asOf
    })))

    if (intent !== "background") {
      publish(key, intent === "retry" || intent === "refresh"
        ? { kind: "retrying", target, parts: pendingParts, operation: `${target.source}へ再要求中`, retainContent }
        : { kind: "loading", target, parts: pendingParts, operation: `${target.source}から取得中`, retainContent })
    }

    const settled = await Promise.allSettled(loaders.map((loader) => loader.load()))
    if (requestIdsRef.current[key] !== requestId) return statesRef.current[key]

    const now = new Date().toISOString()
    const attemptedParts = loaders.map((loader, index): UiResourcePartState => {
      if (settled[index]?.status === "fulfilled") return { id: loader.id, label: loader.label, status: "ready", asOf: now }
      console.warn(`Failed to load ${target.id}:${loader.id}`, settled[index]?.status === "rejected" ? settled[index].reason : undefined)
      const previousPart = previous.parts.find((part) => part.id === loader.id)
      return {
        id: loader.id,
        label: loader.label,
        status: isPermissionError(settled[index]?.status === "rejected" ? settled[index].reason : undefined)
          ? "permission"
          : previousPart?.status === "ready" || previousPart?.status === "stale"
            ? "stale"
            : "failed",
        asOf: previousPart?.asOf,
        requestReference: `ui-${target.id}-${loader.id}-${requestId}`
      }
    })
    const parts = mergeParts(previous.parts, attemptedParts)
    const readyParts = parts.filter((part) => part.status === "ready")
    const staleParts = parts.filter((part) => part.status === "stale")
    const failedParts = parts.filter((part) => part.status === "failed")
    const permissionParts = parts.filter((part) => part.status === "permission")
    const recovered = previous.kind === "error" || previous.kind === "partial" || previous.kind === "stale" || previous.kind === "retrying"
    let next: UiResourceState

    if (failedParts.length === 0 && staleParts.length === 0 && permissionParts.length === 0) {
      next = recovered
        ? { kind: "recovered", target, parts, message: "再試行した対象を最新の状態へ更新しました。", asOf: now }
        : { kind: "content", target, parts, asOf: now }
    } else if (readyParts.length > 0) {
      next = {
        kind: "partial",
        target,
        parts,
        message: "取得できた項目を表示し、未更新の項目は利用不可または古い状態として区別しています。",
        asOf: newestAsOf(parts)
      }
    } else if (permissionParts.length > 0 && failedParts.length === 0) {
      next = {
        kind: "permission",
        target,
        parts,
        message: "この情報を参照する権限がありません。利用可能な画面へ戻るか、管理者へ確認してください。"
      }
    } else if (staleParts.length > 0 || retainContent) {
      next = {
        kind: "stale",
        target,
        parts,
        message: "更新に失敗したため、最後に確認できた内容を表示しています。",
        asOf: newestAsOf(parts) ?? now
      }
    } else {
      next = {
        kind: "error",
        target,
        parts,
        message: "通信またはサービスの状態を確認して、もう一度お試しください。"
      }
    }

    publish(key, next)
    return next
  }, [publish, setContent, targets])

  return { states, run, setPermission, setContent }
}

function mapTargets<Key extends string, Value>(targets: Record<Key, UiStateTarget>, factory: (target: UiStateTarget) => Value): Record<Key, Value> {
  return Object.fromEntries(Object.entries(targets).map(([key, target]) => [key, factory(target as UiStateTarget)])) as Record<Key, Value>
}

function mergeParts(previous: UiResourcePartState[], attempted: UiResourcePartState[]): UiResourcePartState[] {
  const attemptedIds = new Set(attempted.map((part) => part.id))
  return [...previous.filter((part) => !attemptedIds.has(part.id)), ...attempted]
}

function newestAsOf(parts: UiResourcePartState[]): string | undefined {
  return parts.map((part) => part.asOf).filter((value): value is string => Boolean(value)).sort().at(-1)
}

function isPermissionError(error: unknown): error is { status: number } {
  if (!error || typeof error !== "object" || !("status" in error)) return false
  const status = (error as { status?: unknown }).status
  return status === 401 || status === 403
}
