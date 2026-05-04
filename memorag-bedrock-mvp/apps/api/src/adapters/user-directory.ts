import {
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType
} from "@aws-sdk/client-cognito-identity-provider"
import { config } from "../config.js"
import type { ManagedUser } from "../types.js"

export interface UserDirectory {
  listUsers(): Promise<ManagedUser[]>
}

export class CognitoUserDirectory implements UserDirectory {
  private readonly client: CognitoIdentityProviderClient

  constructor(
    private readonly userPoolId = config.cognitoUserPoolId,
    client?: CognitoIdentityProviderClient
  ) {
    this.client = client ?? new CognitoIdentityProviderClient({ region: config.region })
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

    return Promise.all(users.map((user) => this.toManagedUser(user)))
  }

  private async toManagedUser(user: UserType): Promise<ManagedUser> {
    const username = user.Username ?? ""
    const attributes: Record<string, string> = {}
    for (const attribute of user.Attributes ?? []) {
      if (attribute.Name) attributes[attribute.Name] = attribute.Value ?? ""
    }
    const groups = await this.listGroups(username)
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
