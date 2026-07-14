import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { tenantPartitionId } from "../security/tenant-partition.js"
import type { GroupMembership } from "../types.js"
import {
  groupMembershipConflictError,
  groupMembershipId,
  groupMembershipStateVersion,
  type GroupMembershipStore,
  type VersionedGroupMembershipState
} from "./group-membership-store.js"

type GroupMembershipDb = {
  schemaVersion: 1
  memberships: GroupMembership[]
}

const membershipWriteQueues = new Map<string, Promise<void>>()

export class LocalGroupMembershipStore implements GroupMembershipStore {
  constructor(private readonly baseDir: string) {}

  async list(tenantId: string): Promise<GroupMembership[]> {
    return (await this.read(tenantId)).memberships
  }

  async listByGroupId(tenantId: string, groupId: string): Promise<GroupMembership[]> {
    return (await this.read(tenantId)).memberships.filter((membership) => membership.groupId === groupId)
  }

  async listByMember(tenantId: string, memberType: GroupMembership["memberType"], memberId: string): Promise<GroupMembership[]> {
    return (await this.read(tenantId)).memberships.filter((membership) => membership.memberType === memberType && membership.memberId === memberId)
  }

  async save(membership: GroupMembership): Promise<GroupMembership> {
    return runMembershipWrite(this.filePath(membership.tenantId), async () => {
      const db = await this.read(membership.tenantId)
      const next = normalizeMembership(membership)
      const index = db.memberships.findIndex((item) => item.groupId === next.groupId && item.memberType === next.memberType && item.memberId === next.memberId)
      if (index >= 0) db.memberships[index] = next
      else db.memberships.push(next)
      await this.write(membership.tenantId, db)
      return next
    })
  }

  async delete(tenantId: string, groupId: string, memberType: GroupMembership["memberType"], memberId: string): Promise<void> {
    await runMembershipWrite(this.filePath(tenantId), async () => {
      const db = await this.read(tenantId)
      db.memberships = db.memberships.filter((membership) => !(membership.groupId === groupId && membership.memberType === memberType && membership.memberId === memberId))
      await this.write(tenantId, db)
    })
  }

  async getVersionedGroupState(tenantId: string, groupId: string): Promise<VersionedGroupMembershipState> {
    const memberships = (await this.read(tenantId)).memberships.filter((membership) => membership.groupId === groupId)
    return { memberships, version: groupMembershipStateVersion(memberships) }
  }

  async replaceGroupState(
    tenantId: string,
    groupId: string,
    memberships: GroupMembership[],
    expectedVersion: string
  ): Promise<VersionedGroupMembershipState> {
    return runMembershipWrite(this.filePath(tenantId), async () => {
      const db = await this.read(tenantId)
      const current = db.memberships.filter((membership) => membership.groupId === groupId)
      if (groupMembershipStateVersion(current) !== expectedVersion) throw groupMembershipConflictError(groupId)
      const next = memberships.map(normalizeMembership)
      if (next.some((membership) => membership.groupId !== groupId)) throw new Error("Group membership state contains another group")
      if (next.some((membership) => membership.tenantId !== tenantId)) throw new Error("Group membership state crossed a tenant boundary")
      const keys = new Set(next.map((membership) => `${membership.memberType}:${membership.memberId}`))
      if (keys.size !== next.length) throw new Error("Group membership state contains duplicate principals")
      db.memberships = [...db.memberships.filter((membership) => membership.groupId !== groupId), ...next]
      await this.write(tenantId, db)
      return { memberships: next, version: groupMembershipStateVersion(next) }
    })
  }

  private async read(tenantId: string): Promise<GroupMembershipDb> {
    try {
      const raw = JSON.parse(await readFile(this.filePath(tenantId), "utf-8")) as Partial<GroupMembershipDb>
      const db: GroupMembershipDb = {
        schemaVersion: 1,
        memberships: Array.isArray(raw.memberships) ? raw.memberships : []
      }
      if (db.memberships.some((membership) => membership.tenantId !== tenantId)) {
        throw new Error("Group membership tenant partition is invalid")
      }
      return db
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        await this.assertNoLegacyStore()
        return { schemaVersion: 1, memberships: [] }
      }
      throw err
    }
  }

  private async write(tenantId: string, db: GroupMembershipDb): Promise<void> {
    if (db.memberships.some((membership) => membership.tenantId !== tenantId)) throw new Error("Group membership tenant partition is invalid")
    const targetPath = this.filePath(tenantId)
    const targetDir = path.dirname(targetPath)
    const tempPath = path.join(targetDir, `.group-memberships.${randomUUID()}.tmp`)
    await mkdir(targetDir, { recursive: true })
    await writeFile(tempPath, JSON.stringify({ schemaVersion: 1, memberships: db.memberships }, null, 2))
    await rename(tempPath, targetPath)
  }

  private filePath(tenantId: string): string {
    return path.join(this.baseDir, "group-memberships", tenantPartitionId(tenantId), "items.json")
  }

  private async assertNoLegacyStore(): Promise<void> {
    try {
      await readFile(path.join(this.baseDir, "group-memberships.json"), "utf-8")
      throw new Error("Legacy unscoped group memberships require tenant migration")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return
      throw error
    }
  }
}

function normalizeMembership(membership: GroupMembership): GroupMembership {
  return {
    ...membership,
    itemType: "groupMembership",
    membershipId: membership.membershipId ?? groupMembershipId(membership.groupId, membership.memberType, membership.memberId)
  }
}

async function runMembershipWrite<T>(filePath: string, task: () => Promise<T>): Promise<T> {
  const previous = membershipWriteQueues.get(filePath) ?? Promise.resolve()
  let release: () => void = () => undefined
  const current = new Promise<void>((resolve) => { release = resolve })
  const queued = previous.then(() => current, () => current)
  membershipWriteQueues.set(filePath, queued)
  await previous.catch(() => undefined)
  try {
    return await task()
  } finally {
    release()
    if (membershipWriteQueues.get(filePath) === queued) membershipWriteQueues.delete(filePath)
  }
}
