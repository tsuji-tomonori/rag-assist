import type { ObjectStore } from "../../../adapters/object-store.js"
import { tenantPartitionId } from "../../../security/tenant-partition.js"

export const REINDEX_PUBLICATION_COMPENSATION_SCHEMA_VERSION = 1 as const

export type ReindexPublicationCompensationAction = "cutover" | "rollback"

export type ReindexPublicationCompensationResult = Readonly<{
  activeDocumentId: string
  compensatedAt: string
  generation: number
  fencingToken: string
  checkpoint: string
}>

export type ReindexPublicationCompensationIntent = Readonly<{
  schemaVersion: typeof REINDEX_PUBLICATION_COMPENSATION_SCHEMA_VERSION
  status: "pending" | "compensated" | "completed"
  action: ReindexPublicationCompensationAction
  tenantId: string
  migrationId: string
  publicationRunId: string
  expectedMigrationStatus: "staged" | "cutover"
  operationId: string
  attempts: number
  lastError?: string
  compensation?: ReindexPublicationCompensationResult
  createdAt: string
  updatedAt: string
  completedAt?: string
}>

export type PrepareReindexPublicationCompensationInput = Readonly<{
  action: ReindexPublicationCompensationAction
  tenantId: string
  migrationId: string
  publicationRunId: string
  expectedMigrationStatus: "staged" | "cutover"
  preparedAt: string
}>

/** Durable hand-off between a publication side effect and its migration ledger. */
export class ObjectStoreReindexPublicationCompensationRepair {
  constructor(private readonly objectStore: ObjectStore) {}

  async get(
    tenantId: string,
    migrationId: string,
    action: ReindexPublicationCompensationAction
  ): Promise<ReindexPublicationCompensationIntent | undefined> {
    return (await this.read(repairKey(tenantId, migrationId, action)))?.value
  }

  async prepare(input: PrepareReindexPublicationCompensationInput): Promise<ReindexPublicationCompensationIntent> {
    validatePrepareInput(input)
    const key = repairKey(input.tenantId, input.migrationId, input.action)
    const existing = await this.read(key)
    if (existing) {
      assertSameIntent(existing.value, input)
      return existing.value
    }
    const intent: ReindexPublicationCompensationIntent = {
      schemaVersion: REINDEX_PUBLICATION_COMPENSATION_SCHEMA_VERSION,
      status: "pending",
      action: input.action,
      tenantId: input.tenantId,
      migrationId: input.migrationId,
      publicationRunId: input.publicationRunId,
      expectedMigrationStatus: input.expectedMigrationStatus,
      operationId: `reindex-${input.action}-compensation:${input.migrationId}`,
      attempts: 0,
      createdAt: input.preparedAt,
      updatedAt: input.preparedAt
    }
    try {
      await this.objectStore.putTextIfVersion(key, JSON.stringify(intent, null, 2), undefined, "application/json")
      return intent
    } catch (error) {
      if (!isConditionalWriteError(error)) throw error
      const winner = await this.read(key)
      if (!winner) throw error
      assertSameIntent(winner.value, input)
      return winner.value
    }
  }

  markFailed(
    intent: ReindexPublicationCompensationIntent,
    error: unknown,
    updatedAt: string
  ): Promise<ReindexPublicationCompensationIntent> {
    return this.transition(intent, (current) => ({
      ...current,
      attempts: current.attempts + 1,
      lastError: failureCode(error),
      updatedAt
    }))
  }

  markCompensated(
    intent: ReindexPublicationCompensationIntent,
    compensation: ReindexPublicationCompensationResult,
    updatedAt: string
  ): Promise<ReindexPublicationCompensationIntent> {
    validateCompensation(compensation)
    return this.transition(intent, (current) => {
      if (current.status === "completed") return current
      if (current.status === "compensated") {
        if (JSON.stringify(current.compensation) !== JSON.stringify(compensation)) {
          throw new Error("Reindex publication compensation result conflicts with its durable intent")
        }
        return current
      }
      return {
        ...current,
        status: "compensated",
        attempts: current.attempts + 1,
        lastError: undefined,
        compensation,
        updatedAt
      }
    })
  }

  markCompleted(
    intent: ReindexPublicationCompensationIntent,
    completedAt: string
  ): Promise<ReindexPublicationCompensationIntent> {
    return this.transition(intent, (current) => {
      if (current.status === "completed") return current
      if (current.status !== "compensated" || !current.compensation) {
        throw new Error("Reindex publication compensation cannot complete before physical convergence")
      }
      return { ...current, status: "completed", updatedAt: completedAt, completedAt }
    })
  }

  private async transition(
    identity: ReindexPublicationCompensationIntent,
    mutate: (current: ReindexPublicationCompensationIntent) => ReindexPublicationCompensationIntent
  ): Promise<ReindexPublicationCompensationIntent> {
    const key = repairKey(identity.tenantId, identity.migrationId, identity.action)
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const stored = await this.read(key)
      if (!stored) throw new Error("Reindex publication compensation intent was not found")
      assertIdentity(stored.value, identity)
      const next = mutate(stored.value)
      if (next === stored.value) return stored.value
      validateStored(next)
      try {
        await this.objectStore.putTextIfVersion(key, JSON.stringify(next, null, 2), stored.version, "application/json")
        return next
      } catch (error) {
        if (!isConditionalWriteError(error) || attempt === 7) throw error
      }
    }
    throw new Error("Reindex publication compensation transition did not converge")
  }

  private async read(key: string): Promise<{ value: ReindexPublicationCompensationIntent; version: string } | undefined> {
    try {
      const stored = await this.objectStore.getTextWithVersion(key)
      const value = JSON.parse(stored.text) as ReindexPublicationCompensationIntent
      validateStored(value)
      return { value, version: stored.version }
    } catch (error) {
      if (isMissingObjectError(error)) return undefined
      throw error
    }
  }
}

function repairKey(tenantId: string, migrationId: string, action: ReindexPublicationCompensationAction): string {
  assertIdentifier(tenantId, "tenantId")
  assertIdentifier(migrationId, "migrationId")
  if (action !== "cutover" && action !== "rollback") throw new Error("Reindex compensation action is invalid")
  return `security/reindex-publication-compensation/${tenantPartitionId(tenantId)}/${encodeURIComponent(migrationId)}/${action}.json`
}

function validatePrepareInput(input: PrepareReindexPublicationCompensationInput): void {
  repairKey(input.tenantId, input.migrationId, input.action)
  assertIdentifier(input.publicationRunId, "publicationRunId")
  assertTimestamp(input.preparedAt, "preparedAt")
  if (
    (input.action === "cutover" && input.expectedMigrationStatus !== "staged")
    || (input.action === "rollback" && input.expectedMigrationStatus !== "cutover")
  ) throw new Error("Reindex compensation expected migration status is invalid")
}

function validateStored(intent: ReindexPublicationCompensationIntent): void {
  if (
    intent.schemaVersion !== REINDEX_PUBLICATION_COMPENSATION_SCHEMA_VERSION
    || !["pending", "compensated", "completed"].includes(intent.status)
    || intent.operationId !== `reindex-${intent.action}-compensation:${intent.migrationId}`
    || !Number.isSafeInteger(intent.attempts)
    || intent.attempts < 0
  ) throw new Error("Reindex publication compensation intent is invalid")
  validatePrepareInput({
    action: intent.action,
    tenantId: intent.tenantId,
    migrationId: intent.migrationId,
    publicationRunId: intent.publicationRunId,
    expectedMigrationStatus: intent.expectedMigrationStatus,
    preparedAt: intent.createdAt
  })
  assertTimestamp(intent.updatedAt, "updatedAt")
  if (intent.compensation) validateCompensation(intent.compensation)
  if ((intent.status === "compensated" || intent.status === "completed") && !intent.compensation) {
    throw new Error("Reindex publication compensation result is missing")
  }
  if (intent.completedAt !== undefined) assertTimestamp(intent.completedAt, "completedAt")
}

function validateCompensation(compensation: ReindexPublicationCompensationResult): void {
  assertIdentifier(compensation.activeDocumentId, "activeDocumentId")
  assertTimestamp(compensation.compensatedAt, "compensatedAt")
  assertIdentifier(compensation.fencingToken, "fencingToken")
  assertIdentifier(compensation.checkpoint, "checkpoint")
  if (!Number.isSafeInteger(compensation.generation) || compensation.generation < 1) {
    throw new Error("Reindex publication compensation generation is invalid")
  }
}

function assertSameIntent(
  intent: ReindexPublicationCompensationIntent,
  input: PrepareReindexPublicationCompensationInput
): void {
  if (
    intent.action !== input.action
    || intent.tenantId !== input.tenantId
    || intent.migrationId !== input.migrationId
    || intent.publicationRunId !== input.publicationRunId
    || intent.expectedMigrationStatus !== input.expectedMigrationStatus
  ) throw new Error("Reindex publication compensation conflicts with an existing intent")
}

function assertIdentity(
  current: ReindexPublicationCompensationIntent,
  expected: ReindexPublicationCompensationIntent
): void {
  if (
    current.operationId !== expected.operationId
    || current.tenantId !== expected.tenantId
    || current.migrationId !== expected.migrationId
    || current.action !== expected.action
  ) throw new Error("Reindex publication compensation identity changed")
}

function assertIdentifier(value: string, name: string): void {
  if (!value || value.trim() !== value) throw new Error(`Reindex publication compensation ${name} is invalid`)
}

function assertTimestamp(value: string, name: string): void {
  assertIdentifier(value, name)
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error(`Reindex publication compensation ${name} is invalid`)
  }
}

function failureCode(error: unknown): string {
  const value = error instanceof Error ? `${error.name}:${error.message}` : "UnknownError"
  return value.replace(/[^A-Za-z0-9_.:-]/gu, "_").slice(0, 240)
}

function isConditionalWriteError(error: unknown): boolean {
  const candidate = error as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } }
  return candidate.code === "PRECONDITION_FAILED" || candidate.name === "PreconditionFailed"
    || candidate.name === "ConditionalCheckFailedException" || candidate.$metadata?.httpStatusCode === 412
}

function isMissingObjectError(error: unknown): boolean {
  const candidate = error as { Code?: string; code?: string; name?: string; message?: string; $metadata?: { httpStatusCode?: number } }
  return candidate.Code === "NoSuchKey" || candidate.name === "NoSuchKey" || candidate.code === "ENOENT"
    || candidate.name === "NotFound" || candidate.$metadata?.httpStatusCode === 404
    || candidate.message?.includes("ENOENT") === true
}
