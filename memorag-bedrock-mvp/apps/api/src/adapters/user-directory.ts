import {
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType
} from "@aws-sdk/client-cognito-identity-provider"
import { config } from "../config.js"
import type { ManagedUser } from "../types.js"

type CognitoDirectoryClient = Pick<CognitoIdentityProviderClient, "send">

export interface UserDirectory {
  listUsers(): Promise<ManagedUser[]>
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

    return mapWithConcurrency(users, 5, (user) => this.toManagedUser(user))
  }

  private async toManagedUser(user: UserType): Promise<ManagedUser> {
    const username = user.Username ?? ""
    const attributes: Record<string, string> = {}
    for (const attribute of user.Attributes ?? []) {
      if (attribute.Name) attributes[attribute.Name] = attribute.Value ?? ""
    }
    const groups = await this.safeListGroups(username)
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

  private async safeListGroups(username: string): Promise<string[]> {
    try {
      return await this.listGroups(username)
    } catch (err) {
      console.warn(`Failed to list Cognito groups for ${username || "unknown user"}`, err)
      return []
    }
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
