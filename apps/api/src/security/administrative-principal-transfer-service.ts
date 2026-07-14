import type { AppUser } from "../auth.js"
import { hasPermission, isActiveAccount } from "../authorization.js"
import type { Dependencies } from "../dependencies.js"
import type { DocumentGroup, DocumentManifest, JsonValue, UserGroup, VectorMetadata, VectorRecord } from "../types.js"
import type { VectorStore } from "../adapters/vector-store.js"
import type { ResourceUserPrincipal } from "./resource-group-membership-service.js"
import {
  ObjectStoreSecurityMutationAuditOutbox,
  type SecurityMutationAuditOutboxPort
} from "./security-mutation-audit-outbox.js"
import { assertManifestTenant, tenantManifestPrefix } from "../rag/_shared/storage/tenant-artifacts.js"
import {
  AdministrativePrincipalTransferFenceError,
  ObjectStoreAdministrativePrincipalTransferFence,
  type AdministrativePrincipalTransferFencePort,
  type AdministrativePrincipalTransferMode
} from "./administrative-principal-transfer-fence.js"

export const ADMINISTRATIVE_PRINCIPAL_TRANSFER_POLICY_VERSION = "administrative-principal-transfer-v1" as const

type TransferDeps = Pick<Dependencies,
  | "objectStore"
  | "evidenceVectorStore"
  | "memoryVectorStore"
  | "documentGroupStore"
  | "userGroupStore"
  | "securityAuditOutbox"
  | "administrativePrincipalTransferFence"
  | "localTestIngestAdmissionContext"
  | "legacyGlobalDocumentArtifacts"
>

type DocumentTransfer = {
  sourceVersion: string
  source: DocumentManifest
  target: DocumentManifest
}

type TransferInventory = {
  folders: DocumentGroup[]
  resourceGroups: UserGroup[]
  documents: Array<Pick<DocumentTransfer, "source" | "sourceVersion">>
}

type TransferIntent = {
  schemaVersion: 1
  operationId: string
  status: "prepared" | "transferring" | "rollback_pending" | "rolled_back" | "committed"
  actorId: string
  tenantId: string
  sourceUserId: string
  successorUserId: string
  reason: string
  folders: Array<{ source: DocumentGroup; target: DocumentGroup }>
  resourceGroups: Array<{ source: UserGroup; target: UserGroup }>
  documents: DocumentTransfer[]
  auditIntentId: string
  lastError?: string
  createdAt: string
  updatedAt: string
}

type VersionedState<T> = { value: T; version: string }

export type AdministrativePrincipalTransferResult = Readonly<{
  operationId?: string
  transferredFolders: number
  transferredResourceGroups: number
  transferredDocuments: number
}>

export type AdministrativePrincipalInventoryCounts = Readonly<{
  folders: number
  resourceGroups: number
  documents: number
  total: number
}>

export class AdministrativePrincipalTransferError extends Error {
  constructor(message: string, readonly reconciliationRequired = false) {
    super(message)
    this.name = "AdministrativePrincipalTransferError"
  }
}

/** Transfers every live administrative reference before permanent account deletion. */
export class AdministrativePrincipalTransferService {
  private readonly auditOutbox: SecurityMutationAuditOutboxPort
  private readonly transferFence: AdministrativePrincipalTransferFencePort

  constructor(
    private readonly deps: TransferDeps,
    private readonly clock: () => Date = () => new Date()
  ) {
    this.auditOutbox = deps.securityAuditOutbox ?? new ObjectStoreSecurityMutationAuditOutbox(deps.objectStore, clock)
    this.transferFence = deps.administrativePrincipalTransferFence ?? new ObjectStoreAdministrativePrincipalTransferFence(deps.objectStore, clock)
  }

  async inspectBeforePermanentDelete(input: {
    actor: AppUser
    sourceUserId: string
    tenantId: string
  }): Promise<AdministrativePrincipalInventoryCounts> {
    this.validateActor(input.actor, input.tenantId)
    if (!isCanonical(input.sourceUserId)) {
      throw new AdministrativePrincipalTransferError("Source administrative principal is invalid")
    }
    return inventoryCounts(await this.inventory(input.sourceUserId, input.tenantId))
  }

  /**
   * Generic precondition for owner/adminPrincipal changes and tenant exit.
   * Permanent deletion delegates to the same durable transfer state machine.
   */
  transferBeforeAdministrativePrincipalChange(input: {
    actor: AppUser
    sourceUserId: string
    tenantId: string
    successor?: ResourceUserPrincipal
    reason: string
  }): Promise<AdministrativePrincipalTransferResult> {
    return this.transfer(input, "administrative_change")
  }

  async transferBeforePermanentDelete(input: {
    actor: AppUser
    sourceUserId: string
    tenantId: string
    successor?: ResourceUserPrincipal
    reason: string
  }): Promise<AdministrativePrincipalTransferResult> {
    return this.transfer(input, "permanent_delete")
  }

  confirmPermanentDeleteAccountDeny(input: {
    tenantId: string
    sourceUserId: string
    operationId: string
  }) {
    return this.transferFence.confirmAccountDeny(input)
  }

  releasePermanentDeleteFenceAfterAccountRestore(input: {
    tenantId: string
    sourceUserId: string
  }) {
    return this.transferFence.releaseAfterAccountRestore(input)
  }

  private async transfer(input: {
    actor: AppUser
    sourceUserId: string
    tenantId: string
    successor?: ResourceUserPrincipal
    reason: string
  }, mode: AdministrativePrincipalTransferMode): Promise<AdministrativePrincipalTransferResult> {
    const preliminaryInventory = await this.inventory(input.sourceUserId, input.tenantId)
    const preliminaryCounts = inventoryCounts(preliminaryInventory)

    const audit = await this.auditOutbox.prepare({
      actorId: input.actor.userId,
      tenantId: input.tenantId,
      targetType: "administrativePrincipal",
      targetId: input.sourceUserId,
      operation: "ownership.transfer",
      before: inventoryAuditValue(input.sourceUserId, preliminaryCounts),
      proposedAfter: {
        successorUserId: input.successor?.userId ?? null,
        folderCount: preliminaryCounts.folders,
        resourceGroupCount: preliminaryCounts.resourceGroups,
        documentCount: preliminaryCounts.documents
      },
      reason: input.reason,
      policyVersion: ADMINISTRATIVE_PRINCIPAL_TRANSFER_POLICY_VERSION
    })

    try {
      this.validateActor(input.actor, input.tenantId)
      if (!isCanonical(input.sourceUserId)) {
        throw new AdministrativePrincipalTransferError("Source administrative principal is invalid")
      }
    } catch (error) {
      await this.auditOutbox.complete(audit.intentId, input.tenantId, "denied", inventoryAuditValue(input.sourceUserId, preliminaryCounts))
      throw error
    }
    const stateKey = transferStateKey(input.tenantId, input.sourceUserId)
    let stored: VersionedState<TransferIntent> | undefined
    try {
      stored = await this.readState<TransferIntent>(stateKey)
    } catch (error) {
      await this.auditOutbox.complete(audit.intentId, input.tenantId, "failed", inventoryAuditValue(input.sourceUserId, preliminaryCounts))
      throw error
    }
    let fence
    try {
      fence = await this.transferFence.acquire({
        tenantId: input.tenantId,
        sourceUserId: input.sourceUserId,
        ...(input.successor ? { successorUserId: input.successor.userId } : {}),
        ...(stored && stored.value.status !== "rolled_back" && stored.value.successorUserId === input.successor?.userId
          ? { operationId: stored.value.operationId }
          : {}),
        mode
      })
    } catch (error) {
      const result = error instanceof AdministrativePrincipalTransferFenceError && error.conflict ? "conflict" : "failed"
      await this.auditOutbox.complete(audit.intentId, input.tenantId, result, inventoryAuditValue(input.sourceUserId, preliminaryCounts))
      throw new AdministrativePrincipalTransferError(errorMessage(error), result === "failed")
    }
    const fenceLease = {
      tenantId: input.tenantId,
      sourceUserId: input.sourceUserId,
      operationId: fence.operationId,
      fencingToken: fence.fencingToken
    }

    let inventory: TransferInventory
    let counts: AdministrativePrincipalInventoryCounts
    try {
      await this.transferFence.renew(fenceLease)
      inventory = await this.inventory(input.sourceUserId, input.tenantId)
      counts = inventoryCounts(inventory)
      stored = await this.readState<TransferIntent>(stateKey)
    } catch (error) {
      await this.auditOutbox.complete(audit.intentId, input.tenantId, "failed", inventoryAuditValue(input.sourceUserId, preliminaryCounts))
      throw new AdministrativePrincipalTransferError(`Ownership inventory under transfer fence failed: ${errorMessage(error)}`, true)
    }

    try {
      if (counts.total > 0 || stored) validateSuccessor(input.sourceUserId, input.tenantId, input.successor)
    } catch (error) {
      await this.auditOutbox.complete(audit.intentId, input.tenantId, "denied", inventoryAuditValue(input.sourceUserId, counts))
      await this.transferFence.release(fenceLease)
      throw error
    }
    let successor = input.successor

    if (counts.total === 0 && !stored) {
      const stable = await this.confirmStableZeroInventory(input, fenceLease)
      counts = inventoryCounts(stable)
      if (counts.total === 0) {
        await this.auditOutbox.complete(
          audit.intentId,
          input.tenantId,
          "success",
          inventoryAuditValue(input.sourceUserId, counts)
        )
        if (mode === "administrative_change") {
          await this.transferFence.release(fenceLease)
        }
        return emptyTransferResult(fence.operationId)
      }
      inventory = stable
      try {
        validateSuccessor(input.sourceUserId, input.tenantId, successor)
      } catch (error) {
        await this.auditOutbox.complete(audit.intentId, input.tenantId, "denied", inventoryAuditValue(input.sourceUserId, counts))
        await this.transferFence.release(fenceLease)
        throw error
      }
    }
    successor = successor as ResourceUserPrincipal

    if (stored?.value.status === "committed") {
      if (stored.value.successorUserId !== successor.userId) {
        await this.auditOutbox.complete(audit.intentId, input.tenantId, "conflict", inventoryAuditValue(input.sourceUserId, counts))
        await this.transferFence.release(fenceLease)
        throw new AdministrativePrincipalTransferError("Administrative principal was already transferred to another successor")
      }
    }
    if (stored && stored.value.status !== "rolled_back" && stored.value.successorUserId !== successor.userId) {
      await this.auditOutbox.complete(audit.intentId, input.tenantId, "conflict", inventoryAuditValue(input.sourceUserId, counts))
      await this.transferFence.release(fenceLease)
      throw new AdministrativePrincipalTransferError("Another administrative-principal transfer is in progress")
    }
    if (stored?.value.status === "rollback_pending") {
      await this.rollback(stateKey, stored, () => this.transferFence.renew(fenceLease).then(() => undefined))
      if (audit.intentId !== stored.value.auditIntentId) {
        await this.auditOutbox.complete(audit.intentId, input.tenantId, "failed", inventoryAuditValue(input.sourceUserId, counts))
      }
      await this.transferFence.release(fenceLease)
      throw new AdministrativePrincipalTransferError("Previous ownership transfer was rolled back")
    }
    if (!stored || stored.value.status === "rolled_back") {
      const now = this.clock().toISOString()
      const operationId = fence.operationId
      const intent: TransferIntent = {
        schemaVersion: 1,
        operationId,
        status: "prepared",
        actorId: input.actor.userId,
        tenantId: input.tenantId,
        sourceUserId: input.sourceUserId,
        successorUserId: successor.userId,
        reason: input.reason,
        folders: inventory.folders.map((source) => ({
          source,
          target: transferFolder(source, input.sourceUserId, successor.userId, operationId, now)
        })),
        resourceGroups: inventory.resourceGroups.map((source) => ({
          source,
          target: { ...source, createdBy: successor.userId, updatedAt: transferTimestamp(operationId, now) }
        })),
        documents: inventory.documents.map((document) => ({
          ...document,
          target: transferDocumentOwner(document.source, input.sourceUserId, successor.userId, operationId, now)
        })),
        auditIntentId: audit.intentId,
        createdAt: now,
        updatedAt: now
      }
      try {
        stored = await this.writeState(stateKey, intent, stored?.version)
      } catch (error) {
        if (!isConditionalWriteError(error)) throw error
        const winner = await this.readState<TransferIntent>(stateKey)
        if (!winner || winner.value.successorUserId !== successor.userId) {
          await this.auditOutbox.complete(audit.intentId, input.tenantId, "conflict", inventoryAuditValue(input.sourceUserId, counts))
          await this.transferFence.release(fenceLease)
          throw new AdministrativePrincipalTransferError("Administrative-principal transfer lost the state CAS race")
        }
        stored = winner
      }
    }

    stored = await this.mergeInventory(stateKey, stored, inventory, successor.userId)
    if (stored.value.status === "prepared" || stored.value.status === "committed") {
      stored = await this.advance(stateKey, stored, { status: "transferring", updatedAt: this.clock().toISOString() })
    }
    try {
      let consecutiveEmptyInventories = 0
      for (let pass = 0; pass < 16; pass += 1) {
        for (const folder of stored.value.folders) {
          await this.transferFence.renew(fenceLease)
          await this.applyFolder(folder)
        }
        for (const resourceGroup of stored.value.resourceGroups) {
          await this.transferFence.renew(fenceLease)
          await this.applyResourceGroup(resourceGroup)
        }
        for (const document of stored.value.documents) {
          await this.transferFence.renew(fenceLease)
          await this.applyDocument(document, stored.value.operationId)
        }

        await this.transferFence.renew(fenceLease)
        await eventLoopTurn()
        const remaining = await this.inventory(input.sourceUserId, input.tenantId)
        const remainingCounts = inventoryCounts(remaining)
        if (remainingCounts.total === 0) {
          consecutiveEmptyInventories += 1
          if (consecutiveEmptyInventories >= 2) break
          continue
        }
        consecutiveEmptyInventories = 0
        stored = await this.mergeInventory(stateKey, stored, remaining, successor.userId)
        if (pass === 15) {
          throw new AdministrativePrincipalTransferError(
            "Ownership inventory did not drain while the source principal was fenced",
            true
          )
        }
      }
      if (consecutiveEmptyInventories < 2) {
        throw new AdministrativePrincipalTransferError(
          "Ownership inventory could not be proven empty while the source principal was fenced",
          true
        )
      }
    } catch (error) {
      if (fence.status === "account_deny_confirmed") {
        if (audit.intentId !== stored.value.auditIntentId) {
          await this.auditOutbox.complete(audit.intentId, input.tenantId, "failed", {
            sourceUserId: input.sourceUserId,
            folders: counts.folders,
            resourceGroups: counts.resourceGroups,
            documents: counts.documents,
            total: counts.total,
            reconciliationRequired: true
          })
        }
        throw new AdministrativePrincipalTransferError(
          `Ownership transfer after confirmed account deny requires reconciliation: ${errorMessage(error)}`,
          true
        )
      }
      try {
        await this.transferFence.renew(fenceLease)
      } catch (fenceError) {
        if (audit.intentId !== stored.value.auditIntentId) {
          await this.auditOutbox.complete(audit.intentId, input.tenantId, "failed", {
            sourceUserId: input.sourceUserId,
            folders: counts.folders,
            resourceGroups: counts.resourceGroups,
            documents: counts.documents,
            total: counts.total,
            reconciliationRequired: true
          })
        }
        throw new AdministrativePrincipalTransferError(
          `Ownership transfer worker lost its durable fence and cannot roll back safely: ${errorMessage(error)}; fence: ${errorMessage(fenceError)}`,
          true
        )
      }
      stored = await this.advance(stateKey, stored, {
        status: "rollback_pending",
        lastError: errorMessage(error),
        updatedAt: this.clock().toISOString()
      })
      try {
        await this.rollback(stateKey, stored, () => this.transferFence.renew(fenceLease).then(() => undefined))
      } catch (rollbackError) {
        if (audit.intentId !== stored.value.auditIntentId) {
          await this.auditOutbox.complete(audit.intentId, input.tenantId, "failed", {
            sourceUserId: input.sourceUserId,
            folders: counts.folders,
            resourceGroups: counts.resourceGroups,
            documents: counts.documents,
            total: counts.total,
            reconciliationRequired: true
          })
        }
        throw new AdministrativePrincipalTransferError(
          `Ownership transfer failed and requires reconciliation: ${errorMessage(error)}; rollback: ${errorMessage(rollbackError)}`,
          true
        )
      }
      if (audit.intentId !== stored.value.auditIntentId) {
        await this.auditOutbox.complete(audit.intentId, input.tenantId, "failed", inventoryAuditValue(input.sourceUserId, counts))
      }
      await this.transferFence.release(fenceLease)
      throw new AdministrativePrincipalTransferError(`Ownership transfer failed and was rolled back: ${errorMessage(error)}`)
    }

    await this.auditOutbox.complete(
      stored.value.auditIntentId,
      stored.value.tenantId,
      "success",
      transferAuditValue(stored.value)
    )
    if (audit.intentId !== stored.value.auditIntentId) {
      await this.auditOutbox.complete(audit.intentId, input.tenantId, "success", transferAuditValue(stored.value))
    }
    stored = await this.advance(stateKey, stored, { status: "committed", updatedAt: this.clock().toISOString() })
    if (mode === "administrative_change") {
      await this.transferFence.release(fenceLease)
    } else {
      await this.transferFence.assertHeld(fenceLease)
    }
    return resultFor(stored.value)
  }

  private async confirmStableZeroInventory(
    input: { tenantId: string; sourceUserId: string },
    fenceLease: { tenantId: string; sourceUserId: string; operationId: string; fencingToken: string }
  ): Promise<TransferInventory> {
    let latest: TransferInventory = { folders: [], resourceGroups: [], documents: [] }
    for (let pass = 0; pass < 2; pass += 1) {
      await eventLoopTurn()
      await this.transferFence.renew(fenceLease)
      latest = await this.inventory(input.sourceUserId, input.tenantId)
      if (inventoryCounts(latest).total > 0) return latest
    }
    return latest
  }

  private async mergeInventory(
    stateKey: string,
    stored: VersionedState<TransferIntent>,
    inventory: TransferInventory,
    successorUserId: string
  ): Promise<VersionedState<TransferIntent>> {
    const folderIds = new Set(stored.value.folders.map((entry) => entry.source.groupId))
    const resourceGroupIds = new Set(stored.value.resourceGroups.map((entry) => entry.source.groupId))
    const documentKeys = new Set(stored.value.documents.map((entry) => entry.source.manifestObjectKey))
    const newFolders = inventory.folders.filter((source) => !folderIds.has(source.groupId))
    const newResourceGroups = inventory.resourceGroups.filter((source) => !resourceGroupIds.has(source.groupId))
    const newDocuments = inventory.documents.filter((entry) => !documentKeys.has(entry.source.manifestObjectKey))
    if (newFolders.length === 0 && newResourceGroups.length === 0 && newDocuments.length === 0) return stored

    const now = this.clock().toISOString()
    return this.advance(stateKey, stored, {
      status: "transferring",
      folders: [
        ...stored.value.folders,
        ...newFolders.map((source) => ({
          source,
          target: transferFolder(source, stored.value.sourceUserId, successorUserId, stored.value.operationId, now)
        }))
      ],
      resourceGroups: [
        ...stored.value.resourceGroups,
        ...newResourceGroups.map((source) => ({
          source,
          target: { ...source, createdBy: successorUserId, updatedAt: transferTimestamp(stored.value.operationId, now) }
        }))
      ],
      documents: [
        ...stored.value.documents,
        ...newDocuments.map((document) => ({
          ...document,
          target: transferDocumentOwner(
            document.source,
            stored.value.sourceUserId,
            successorUserId,
            stored.value.operationId,
            now
          )
        }))
      ],
      updatedAt: now
    })
  }

  private validateActor(actor: AppUser, tenantId: string): void {
    if (
      !isActiveAccount(actor) ||
      !isCanonical(actor.userId) ||
      actor.tenantId !== tenantId ||
      !hasPermission(actor, "user:delete")
    ) throw new AdministrativePrincipalTransferError("Actor cannot transfer administrative principals")
  }

  private async inventory(sourceUserId: string, tenantId: string) {
    if (!this.deps.documentGroupStore || !this.deps.userGroupStore || !this.deps.objectStore) {
      throw new AdministrativePrincipalTransferError("Ownership inventory is not configured")
    }
    const [folders, resourceGroups, manifestKeys] = await Promise.all([
      this.deps.documentGroupStore.list(tenantId),
      this.deps.userGroupStore.list(tenantId),
      this.deps.objectStore.listKeys(tenantManifestPrefix(this.deps, tenantId))
    ])
    const documents: Array<{ source: DocumentManifest; sourceVersion: string }> = []
    for (const key of manifestKeys.filter((candidate) => candidate.endsWith(".json"))) {
      let stored
      try {
        stored = await this.deps.objectStore.getTextWithVersion(key)
      } catch (error) {
        if (isMissingObjectError(error)) continue
        throw error
      }
      const manifest = JSON.parse(stored.text) as DocumentManifest
      assertManifestTenant(manifest, tenantId, key)
      if (
        (manifest.lifecycleStatus ?? "active") === "active" &&
        manifestTenantId(manifest) === tenantId &&
        documentIsOwnedBy(manifest, sourceUserId)
      ) documents.push({ source: manifest, sourceVersion: stored.version })
    }
    return {
      folders: folders.filter((folder) => folder.status === "active" && folder.tenantId === tenantId && (
        folder.ownerUserId === sourceUserId ||
        (folder.adminPrincipalType ?? "user") === "user" && folder.adminPrincipalId === sourceUserId
      )),
      resourceGroups: resourceGroups.filter((group) => group.status === "active" && group.tenantId === tenantId && group.createdBy === sourceUserId),
      documents
    }
  }

  private async applyFolder(transfer: TransferIntent["folders"][number]): Promise<void> {
    const current = await this.deps.documentGroupStore.get(transfer.source.tenantId, transfer.source.groupId)
    if (!current) throw new Error(`Folder disappeared: ${transfer.source.groupId}`)
    if (folderMatches(current, transfer.target)) return
    if (current.updatedAt !== transfer.source.updatedAt || !folderMatches(current, transfer.source)) {
      throw preconditionError(`Folder changed: ${transfer.source.groupId}`)
    }
    await this.deps.documentGroupStore.updateWithPathLocks(transfer.source.tenantId, [{ current, next: transfer.target }])
  }

  private async applyResourceGroup(transfer: TransferIntent["resourceGroups"][number]): Promise<void> {
    const current = await this.deps.userGroupStore.get(requiredUserGroupTenantId(transfer.source), transfer.source.groupId)
    if (!current) throw new Error(`Resource group disappeared: ${transfer.source.groupId}`)
    if (current.createdBy === transfer.target.createdBy && current.updatedAt === transfer.target.updatedAt) return
    if (current.updatedAt !== transfer.source.updatedAt || current.createdBy !== transfer.source.createdBy) {
      throw preconditionError(`Resource group changed: ${transfer.source.groupId}`)
    }
    await this.deps.userGroupStore.replace(transfer.target, transfer.source.updatedAt)
  }

  private async applyDocument(transfer: DocumentTransfer, operationId: string): Promise<void> {
    const current = await readManifest(this.deps, transfer.source.manifestObjectKey)
    if (documentTransferMarker(current.value) === operationId) {
      await this.rewriteDocumentProjections(transfer.target)
      return
    }
    if (current.version !== transfer.sourceVersion || !documentIsOwnedBy(current.value, documentOwner(transfer.source))) {
      throw preconditionError(`Document changed: ${transfer.source.documentId}`)
    }
    await this.rewriteDocumentProjections(transfer.target)
    try {
      await this.deps.objectStore.putTextIfVersion(
        transfer.target.manifestObjectKey,
        JSON.stringify(transfer.target, null, 2),
        transfer.sourceVersion,
        "application/json"
      )
    } catch (error) {
      await this.rewriteDocumentProjections(transfer.source).catch(() => undefined)
      if (isConditionalWriteError(error)) throw preconditionError(`Document changed: ${transfer.source.documentId}`)
      throw error
    }
  }

  private async rollback(
    stateKey: string,
    stored: VersionedState<TransferIntent>,
    assertFence: () => Promise<void> = async () => undefined
  ): Promise<void> {
    const failures: unknown[] = []
    for (const document of [...stored.value.documents].reverse()) {
      try { await assertFence(); await this.rollbackDocument(document, stored.value.operationId) } catch (error) { failures.push(error) }
    }
    for (const resourceGroup of [...stored.value.resourceGroups].reverse()) {
      try { await assertFence(); await this.rollbackResourceGroup(resourceGroup) } catch (error) { failures.push(error) }
    }
    for (const folder of [...stored.value.folders].reverse()) {
      try { await assertFence(); await this.rollbackFolder(folder) } catch (error) { failures.push(error) }
    }
    if (failures.length > 0) throw new AggregateError(failures, "Ownership transfer rollback failed")
    await assertFence()
    await this.auditOutbox.complete(
      stored.value.auditIntentId,
      stored.value.tenantId,
      "failed",
      inventoryAuditValue(stored.value.sourceUserId, {
        folders: stored.value.folders.length,
        resourceGroups: stored.value.resourceGroups.length,
        documents: stored.value.documents.length,
        total: stored.value.folders.length + stored.value.resourceGroups.length + stored.value.documents.length
      })
    )
    await this.advance(stateKey, stored, { status: "rolled_back", updatedAt: this.clock().toISOString() })
  }

  private async rollbackFolder(transfer: TransferIntent["folders"][number]): Promise<void> {
    const current = await this.deps.documentGroupStore.get(transfer.source.tenantId, transfer.source.groupId)
    if (!current || folderMatches(current, transfer.source)) return
    if (!folderMatches(current, transfer.target)) throw preconditionError(`Transferred folder changed: ${transfer.source.groupId}`)
    await this.deps.documentGroupStore.updateWithPathLocks(transfer.source.tenantId, [{ current, next: transfer.source }])
  }

  private async rollbackResourceGroup(transfer: TransferIntent["resourceGroups"][number]): Promise<void> {
    const current = await this.deps.userGroupStore.get(requiredUserGroupTenantId(transfer.source), transfer.source.groupId)
    if (!current || current.createdBy === transfer.source.createdBy && current.updatedAt === transfer.source.updatedAt) return
    if (current.createdBy !== transfer.target.createdBy || current.updatedAt !== transfer.target.updatedAt) {
      throw preconditionError(`Transferred resource group changed: ${transfer.source.groupId}`)
    }
    await this.deps.userGroupStore.replace(transfer.source, transfer.target.updatedAt)
  }

  private async rollbackDocument(transfer: DocumentTransfer, operationId: string): Promise<void> {
    const current = await readManifest(this.deps, transfer.source.manifestObjectKey)
    if (documentTransferMarker(current.value) !== operationId) {
      if (documentIsOwnedBy(current.value, documentOwner(transfer.source))) {
        await this.rewriteDocumentProjections(transfer.source)
        return
      }
      throw preconditionError(`Transferred document changed: ${transfer.source.documentId}`)
    }
    await this.rewriteDocumentProjections(transfer.source)
    try {
      await this.deps.objectStore.putTextIfVersion(
        transfer.source.manifestObjectKey,
        JSON.stringify(transfer.source, null, 2),
        current.version,
        "application/json"
      )
    } catch (error) {
      if (isConditionalWriteError(error)) throw preconditionError(`Transferred document changed: ${transfer.source.documentId}`)
      throw error
    }
  }

  private async rewriteDocumentProjections(manifest: DocumentManifest): Promise<void> {
    const results = await Promise.allSettled([
      rewriteVectorOwners(this.deps.evidenceVectorStore, manifest.evidenceVectorKeys ?? manifest.vectorKeys, manifest),
      rewriteVectorOwners(this.deps.memoryVectorStore, manifest.memoryVectorKeys ?? manifest.vectorKeys, manifest)
    ])
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected")
    if (failures.length > 0) throw new AggregateError(failures.map((failure) => failure.reason), "Document owner projection rewrite failed")
  }

  private async advance(
    stateKey: string,
    stored: VersionedState<TransferIntent>,
    patch: Partial<TransferIntent>
  ): Promise<VersionedState<TransferIntent>> {
    try {
      return await this.writeState(stateKey, { ...stored.value, ...patch }, stored.version)
    } catch (error) {
      if (!isConditionalWriteError(error)) throw error
      const current = await this.readState<TransferIntent>(stateKey)
      if (!current || current.value.operationId !== stored.value.operationId) {
        throw new AdministrativePrincipalTransferError("Ownership transfer state changed concurrently")
      }
      return current
    }
  }

  private async readState<T>(key: string): Promise<VersionedState<T> | undefined> {
    try {
      const stored = await this.deps.objectStore.getTextWithVersion(key)
      return { value: JSON.parse(stored.text) as T, version: stored.version }
    } catch (error) {
      if (isMissingObjectError(error)) return undefined
      throw error
    }
  }

  private async writeState<T>(key: string, value: T, expectedVersion: string | undefined): Promise<VersionedState<T>> {
    await this.deps.objectStore.putTextIfVersion(key, JSON.stringify(value, null, 2), expectedVersion, "application/json")
    const stored = await this.deps.objectStore.getTextWithVersion(key)
    return { value: JSON.parse(stored.text) as T, version: stored.version }
  }
}

function validateSuccessor(sourceUserId: string, tenantId: string, successor: ResourceUserPrincipal | undefined): void {
  if (
    !successor ||
    successor.userId === sourceUserId ||
    successor.status !== "active" ||
    successor.tenantId !== tenantId ||
    !isCanonical(successor.userId)
  ) throw new AdministrativePrincipalTransferError("An active same-tenant successor is required")
}

function transferFolder(
  source: DocumentGroup,
  sourceUserId: string,
  successorUserId: string,
  operationId: string,
  now: string
): DocumentGroup {
  const tenantId = source.tenantId as string
  const adminPrincipalType = source.adminPrincipalType ?? "user"
  const adminPrincipalId = adminPrincipalType === "user" && source.adminPrincipalId === sourceUserId
    ? successorUserId
    : source.adminPrincipalId ?? source.ownerUserId
  const ownerUserId = source.ownerUserId === sourceUserId ? successorUserId : source.ownerUserId
  return {
    ...source,
    adminPrincipalType,
    adminPrincipalId,
    ownerUserId,
    managerUserIds: replaceUserId(source.managerUserIds ?? [], sourceUserId, successorUserId, ownerUserId),
    adminPathPk: `${tenantId}#${adminPrincipalType}#${adminPrincipalId}`,
    parentPathPk: `${tenantId}#${adminPrincipalType}#${adminPrincipalId}#${source.parentGroupId ?? "ROOT"}`,
    updatedAt: transferTimestamp(operationId, now)
  }
}

function transferDocumentOwner(
  source: DocumentManifest,
  sourceUserId: string,
  successorUserId: string,
  operationId: string,
  now: string
): DocumentManifest {
  const metadata = { ...(source.metadata ?? {}) }
  if (metadata.ownerUserId === sourceUserId) metadata.ownerUserId = successorUserId
  if (Array.isArray(metadata.allowedUsers)) {
    metadata.allowedUsers = replaceUserId(metadata.allowedUsers.filter((value): value is string => typeof value === "string"), sourceUserId, successorUserId)
  }
  metadata.administrativeTransferOperationId = operationId
  return {
    ...source,
    metadata,
    admission: source.admission?.ownerUserId === sourceUserId
      ? { ...source.admission, ownerUserId: successorUserId }
      : source.admission,
    updatedAt: transferTimestamp(operationId, now)
  }
}

async function rewriteVectorOwners(store: VectorStore, rawKeys: readonly string[], manifest: DocumentManifest): Promise<void> {
  const keys = [...new Set(rawKeys)]
  if (keys.length === 0) return
  if (!store?.getByKeys) throw new Error("Vector store cannot read ownership projections")
  const records = await store.getByKeys(keys)
  if (records.length !== keys.length) throw new Error("Document ownership projection is incomplete")
  const ownerUserId = documentOwner(manifest)
  await store.put(records.map((record): VectorRecord => ({
    ...record,
    metadata: transferVectorOwner(record.metadata, ownerUserId, manifest)
  })))
}

function transferVectorOwner(current: VectorMetadata, ownerUserId: string, manifest: DocumentManifest): VectorMetadata {
  const next = { ...current, ownerUserId }
  const allowedUsers = manifest.metadata?.allowedUsers
  if (Array.isArray(allowedUsers)) next.allowedUsers = allowedUsers.filter((value): value is string => typeof value === "string")
  return next
}

async function readManifest(deps: TransferDeps, key: string): Promise<VersionedState<DocumentManifest>> {
  const stored = await deps.objectStore.getTextWithVersion(key)
  const value = JSON.parse(stored.text) as DocumentManifest
  if (value.manifestObjectKey !== key) throw new Error("Document manifest identity is invalid")
  return { value, version: stored.version }
}

function documentIsOwnedBy(manifest: DocumentManifest, userId: string): boolean {
  return manifest.metadata?.ownerUserId === userId || manifest.admission?.ownerUserId === userId
}

function documentOwner(manifest: DocumentManifest): string {
  const owner = typeof manifest.metadata?.ownerUserId === "string" ? manifest.metadata.ownerUserId : manifest.admission?.ownerUserId
  if (!isCanonical(owner)) throw new Error("Document owner is missing")
  return owner
}

function documentTransferMarker(manifest: DocumentManifest): string | undefined {
  return typeof manifest.metadata?.administrativeTransferOperationId === "string"
    ? manifest.metadata.administrativeTransferOperationId
    : undefined
}

function manifestTenantId(manifest: DocumentManifest): string | undefined {
  return typeof manifest.metadata?.tenantId === "string" ? manifest.metadata.tenantId : manifest.admission?.tenantId
}

function folderMatches(left: DocumentGroup, right: DocumentGroup): boolean {
  return left.updatedAt === right.updatedAt &&
    left.ownerUserId === right.ownerUserId &&
    left.adminPrincipalType === right.adminPrincipalType &&
    left.adminPrincipalId === right.adminPrincipalId &&
    left.adminPathPk === right.adminPathPk &&
    left.parentPathPk === right.parentPathPk
}

function replaceUserId(values: readonly string[], source: string, successor: string, required?: string): string[] {
  return [...new Set([
    ...values.map((value) => value === source ? successor : value),
    ...(required ? [required] : [])
  ])]
}

function transferTimestamp(operationId: string, now: string): string {
  void operationId
  return now
}

function inventoryCounts(inventory: { folders: unknown[]; resourceGroups: unknown[]; documents: unknown[] }) {
  const result = {
    folders: inventory.folders.length,
    resourceGroups: inventory.resourceGroups.length,
    documents: inventory.documents.length,
    total: inventory.folders.length + inventory.resourceGroups.length + inventory.documents.length
  }
  return result
}

function inventoryAuditValue(sourceUserId: string, counts: ReturnType<typeof inventoryCounts>): JsonValue {
  return { sourceUserId, ...counts }
}

function transferAuditValue(intent: TransferIntent): JsonValue {
  return {
    sourceUserId: intent.sourceUserId,
    successorUserId: intent.successorUserId,
    folderIds: intent.folders.map((entry) => entry.source.groupId),
    resourceGroupIds: intent.resourceGroups.map((entry) => entry.source.groupId),
    documentIds: intent.documents.map((entry) => entry.source.documentId)
  }
}

function resultFor(intent: TransferIntent): AdministrativePrincipalTransferResult {
  return {
    operationId: intent.operationId,
    transferredFolders: intent.folders.length,
    transferredResourceGroups: intent.resourceGroups.length,
    transferredDocuments: intent.documents.length
  }
}

function emptyTransferResult(operationId: string): AdministrativePrincipalTransferResult {
  return { operationId, transferredFolders: 0, transferredResourceGroups: 0, transferredDocuments: 0 }
}

function eventLoopTurn(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

function transferStateKey(tenantId: string, sourceUserId: string): string {
  return `security/ownership-transfer/${encodeURIComponent(tenantId)}/${encodeURIComponent(sourceUserId)}.json`
}

function preconditionError(message: string): Error {
  return Object.assign(new Error(message), { code: "PRECONDITION_FAILED" })
}

function isConditionalWriteError(error: unknown): boolean {
  return error instanceof Error && (
    (error as Error & { code?: string }).code === "PRECONDITION_FAILED" ||
    error.name === "PreconditionFailed" ||
    error.name === "ConditionalCheckFailedException"
  )
}

function isMissingObjectError(error: unknown): boolean {
  return error instanceof Error && (
    (error as NodeJS.ErrnoException).code === "ENOENT" || error.name === "NoSuchKey" || error.name === "NotFound"
  )
}

function isCanonical(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value
}

function requiredUserGroupTenantId(group: UserGroup): string {
  if (!isCanonical(group.tenantId)) throw new Error(`Resource group tenant is missing: ${group.groupId}`)
  return group.tenantId
}

function errorMessage(error: unknown): string {
  if (error instanceof AggregateError) return error.errors.map(errorMessage).join("; ")
  return error instanceof Error ? error.message : String(error)
}
