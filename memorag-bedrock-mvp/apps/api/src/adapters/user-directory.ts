import {
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType
} from "@aws-sdk/client-cognito-identity-provider"
import { config } from "../config.js"
import { rolePermissions } from "../authorization.js"
import type { ManagedUser } from "../types.js"

type CognitoDirectoryClient = Pick<CognitoIdentityProviderClient, "send">

export interface UserDirectory {
  listUsers(): Promise<ManagedUser[]>
  setUserGroups?(username: string, groups: string[]): Promise<void>
}

export class CognitoUserDirectory implements UserDirectory {
  private readonly client: CognitoDirectoryClient

  constructor(
    private readonly userPoolId = config.cognitoUserPoolId,
    client?: CognitoDirectoryClient
  ) {
    this.client = client ?? new CognitoIdentityProviderClient({ region: config.cognitoRegion })
  }

  async listUsers(): Promise<ManagedUser[]> {
    if (!this.userPoolId) return []
    const users: UserType[] = []
    let paginationToken: string | undefined

    do {
      const result = await this.client.send(new ListUsersCommand({
        UserPoolId: this.userPoolId,
        PaginationToken: paginationToken
      }))
      users.push(...(result.Users ?? []))
      paginationToken = result.PaginationToken
    } while (paginationToken)

    const groupLookupFailures: Array<{ username: string; errorName: string; message: string }> = []
    const managedUsers = await mapWithConcurrency(users, 5, (user) => this.toManagedUser(user, groupLookupFailures))
    this.logGroupLookupFailureSummary(users.length, groupLookupFailures)
    return managedUsers
  }

  async setUserGroups(username: string, groups: string[]): Promise<void> {
    if (!this.userPoolId) return
    const desiredGroups = new Set(groups)
    const managedGroups = new Set(Object.keys(rolePermissions))
    const currentGroups = await this.listGroups(username)

    for (const group of groups) {
      if (currentGroups.includes(group)) continue
      await this.client.send(new AdminAddUserToGroupCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        GroupName: group
      }))
    }

    for (const group of currentGroups) {
      if (!managedGroups.has(group) || desiredGroups.has(group)) continue
      await this.client.send(new AdminRemoveUserFromGroupCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        GroupName: group
      }))
    }
  }

  private async toManagedUser(user: UserType, groupLookupFailures: Array<{ username: string; errorName: string; message: string }>): Promise<ManagedUser> {
    const username = user.Username ?? ""
    const attributes: Record<string, string> = {}
    for (const attribute of user.Attributes ?? []) {
      if (attribute.Name) attributes[attribute.Name] = attribute.Value ?? ""
    }
    const groups = await this.safeListGroups(username, groupLookupFailures)
    const email = attributes.email || username || attributes.sub || "unknown@example.local"
    const createdAt = user.UserCreateDate?.toISOString() ?? new Date(0).toISOString()
    const updatedAt = user.UserLastModifiedDate?.toISOString() ?? createdAt

    return {
      userId: attributes.sub || username || email,
      email,
      displayName: attributes.name || email.split("@")[0],
      status: user.Enabled === false ? "suspended" : "active",
      groups,
      createdAt,
      updatedAt
    }
  }

  private async safeListGroups(username: string, groupLookupFailures: Array<{ username: string; errorName: string; message: string }>): Promise<string[]> {
    try {
      return await this.listGroups(username)
    } catch (err) {
      const failure = {
        username: username || "unknown user",
        errorName: err instanceof Error ? err.name : "UnknownError",
        message: err instanceof Error ? err.message : String(err)
      }
      groupLookupFailures.push(failure)
      console.warn(JSON.stringify({
        level: "warn",
        event: "cognito_user_directory_group_lookup_failed",
        userPoolId: this.userPoolId,
        ...failure
      }))
      return []
    }
  }

  private logGroupLookupFailureSummary(totalUsers: number, failures: Array<{ username: string; errorName: string; message: string }>): void {
    if (failures.length === 0) return
    console.warn(JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: "MemoRAG/Admin",
            Dimensions: [["UserPoolId"]],
            Metrics: [
              { Name: "CognitoGroupLookupFailureCount", Unit: "Count" },
              { Name: "CognitoGroupLookupFailureRate", Unit: "Percent" }
            ]
          }
        ]
      },
      level: "warn",
      event: "cognito_user_directory_group_lookup_failure_summary",
      UserPoolId: this.userPoolId,
      totalUsers,
      CognitoGroupLookupFailureCount: failures.length,
      CognitoGroupLookupFailureRate: totalUsers > 0 ? Math.round((failures.length / totalUsers) * 10000) / 100 : 0,
      failedUsernames: failures.slice(0, 20).map((failure) => failure.username)
    }))
  }

  private async listGroups(username: string): Promise<string[]> {
    if (!username) return []
    const groups: string[] = []
    let nextToken: string | undefined

    do {
      const result = await this.client.send(new AdminListGroupsForUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        NextToken: nextToken
      }))
      groups.push(...(result.Groups ?? []).map((group) => group.GroupName).filter((group): group is string => Boolean(group)))
      nextToken = result.NextToken
    } while (nextToken)

    return groups
  }
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  let nextIndex = 0
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      const item = items[index]
      if (item !== undefined) results[index] = await fn(item, index)
    }
  })
  await Promise.all(workers)
  return results
}
