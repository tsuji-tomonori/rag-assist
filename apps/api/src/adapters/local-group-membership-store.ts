import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { GroupMembership } from "../types.js"
import { groupMembershipId, type GroupMembershipStore } from "./group-membership-store.js"

type GroupMembershipDb = {
  schemaVersion: 1
  memberships: GroupMembership[]
}

export class LocalGroupMembershipStore implements GroupMembershipStore {
  constructor(private readonly baseDir: string) {}

  async list(): Promise<GroupMembership[]> {
    return (await this.read()).memberships
  }

  async listByGroupId(groupId: string): Promise<GroupMembership[]> {
    return (await this.read()).memberships.filter((membership) => membership.groupId === groupId)
  }

  async listByMember(memberType: GroupMembership["memberType"], memberId: string): Promise<GroupMembership[]> {
    return (await this.read()).memberships.filter((membership) => membership.memberType === memberType && membership.memberId === memberId)
  }

  async save(membership: GroupMembership): Promise<GroupMembership> {
    const db = await this.read()
    const next = {
      ...membership,
      itemType: "groupMembership" as const,
      membershipId: membership.membershipId ?? groupMembershipId(membership.groupId, membership.memberType, membership.memberId)
    }
    const index = db.memberships.findIndex((item) => item.groupId === next.groupId && item.memberType === next.memberType && item.memberId === next.memberId)
    if (index >= 0) db.memberships[index] = next
    else db.memberships.push(next)
    await this.write(db)
    return next
  }

  async delete(groupId: string, memberType: GroupMembership["memberType"], memberId: string): Promise<void> {
    const db = await this.read()
    db.memberships = db.memberships.filter((membership) => !(membership.groupId === groupId && membership.memberType === memberType && membership.memberId === memberId))
    await this.write(db)
  }

  private async read(): Promise<GroupMembershipDb> {
    try {
      const raw = JSON.parse(await readFile(this.filePath(), "utf-8")) as Partial<GroupMembershipDb>
      return {
        schemaVersion: 1,
        memberships: Array.isArray(raw.memberships) ? raw.memberships : []
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: 1, memberships: [] }
      throw err
    }
  }

  private async write(db: GroupMembershipDb): Promise<void> {
    const targetPath = this.filePath()
    const targetDir = path.dirname(targetPath)
    const tempPath = path.join(targetDir, `.group-memberships.${randomUUID()}.tmp`)
    await mkdir(targetDir, { recursive: true })
    await writeFile(tempPath, JSON.stringify({ schemaVersion: 1, memberships: db.memberships }, null, 2))
    await rename(tempPath, targetPath)
  }

  private filePath(): string {
    return path.join(this.baseDir, "group-memberships.json")
  }
}
