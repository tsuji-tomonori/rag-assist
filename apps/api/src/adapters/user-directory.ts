import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUserGlobalSignOutCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType
} from "@aws-sdk/client-cognito-identity-provider"
import { config } from "../config.js"
import { rolePermissions } from "../authorization.js"
import type { ManagedUser } from "../types.js"
import {
  APPLICATION_ROLES,
  COGNITO_SESSION_INVALID_AT_USER_ATTRIBUTE,
  isApplicationRole,
  type ApplicationRole
} from "@memorag-mvp/contract/access-control"

type CognitoDirectoryClient = Pick<CognitoIdentityProviderClient, "send">

export type CreatedDirectoryUser = ManagedUser & { username: string }

export type ReplaceApplicationRolesInput = Readonly<{
  expectedRoles: readonly ApplicationRole[]
  desiredRoles: readonly ApplicationRole[]
  operationId: string
  fencingToken: string
  assertFence: () => Promise<void>
}>

export interface UserDirectory {
  listUsers(): Promise<ManagedUser[]>
  createUser?(input: { username: string; email: string; displayName: string }): Promise<CreatedDirectoryUser>
  setUserGroups?(username: string, groups: string[]): Promise<void>
  replaceApplicationRoles?(username: string, input: ReplaceApplicationRolesInput): Promise<void>
  disableUser?(username: string): Promise<void>
  enableUser?(username: string): Promise<void>
  deleteUser?(username: string): Promise<void>
  revokeSessions?(username: string): Promise<void>
}

export class CognitoUserDirectory implements UserDirectory {
  private readonly client: CognitoDirectoryClient

  constructor(
    private readonly userPoolId = config.cognitoUserPoolId,
    client?: CognitoDirectoryClient,
    private readonly now: () => Date = () => new Date()
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

  async createUser(input: { username: string; email: string; displayName: string }): Promise<CreatedDirectoryUser> {
    this.assertMutationConfigured(input.username)
    const email = input.email.trim().toLowerCase()
    const displayName = input.displayName.trim()
    if (!email || email !== input.email || !displayName || !input.username.trim() || input.username.trim() !== input.username) {
      throw new Error("Cognito user create input is not canonical")
    }
    const result = await this.client.send(new AdminCreateUserCommand({
      UserPoolId: this.userPoolId,
      Username: input.username,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "name", Value: displayName }
      ],
      DesiredDeliveryMediums: ["EMAIL"]
    }))
    const created = (result as { User?: UserType }).User
    const attributes = new Map((created?.Attributes ?? [])
      .filter((attribute): attribute is { Name: string; Value?: string } => Boolean(attribute.Name))
      .map((attribute) => [attribute.Name, attribute.Value]))
    const userId = attributes.get("sub")?.trim()
    const username = created?.Username?.trim() || input.username
    if (!userId || !username) throw new Error("Cognito create did not return an authoritative subject")
    const createdAt = created?.UserCreateDate?.toISOString() ?? this.now().toISOString()
    const updatedAt = created?.UserLastModifiedDate?.toISOString() ?? createdAt
    return {
      username,
      userId,
      email: attributes.get("email")?.trim() || email,
      displayName: attributes.get("name")?.trim() || displayName,
      status: created?.Enabled === false ? "suspended" : "active",
      groups: [],
      createdAt,
      updatedAt
    }
  }

  async setUserGroups(username: string, groups: string[]): Promise<void> {
    if (!this.userPoolId) return
    const desiredGroups = new Set(groups)
    const managedGroups = new Set(Object.keys(rolePermissions))
    const currentGroups = await this.listGroups(username)

    // Revoke managed roles before granting new ones. A partial Cognito failure
    // therefore converges deny-first and is safe for reconciliation.
    for (const group of currentGroups) {
      if (!managedGroups.has(group) || desiredGroups.has(group)) continue
      await this.client.send(new AdminRemoveUserFromGroupCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        GroupName: group
      }))
    }

    for (const group of groups) {
      if (currentGroups.includes(group)) continue
      await this.client.send(new AdminAddUserToGroupCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        GroupName: group
      }))
    }
  }

  async replaceApplicationRoles(username: string, input: ReplaceApplicationRolesInput): Promise<void> {
    this.assertMutationConfigured(username)
    if (!input.operationId.trim() || !input.fencingToken.trim()) {
      throw new Error("Application-role mutation fence identity is missing")
    }
    const expectedRoles = canonicalApplicationRoles(input.expectedRoles, true)
    const desiredRoles = canonicalApplicationRoles(input.desiredRoles)
    await input.assertFence()
    const currentGroups = await this.listGroups(username)
    const currentRoles = canonicalApplicationRoles(currentGroups.filter(isApplicationRole), true)
    if (!sameStringValues(currentRoles, expectedRoles)) {
      throw Object.assign(new Error("Authoritative application roles changed before fenced mutation"), {
        code: "PRECONDITION_FAILED"
      })
    }

    // Every external write rechecks the durable tenant fence. Removals happen
    // before additions so a partial Cognito failure remains fail-closed.
    for (const role of currentRoles) {
      if (desiredRoles.includes(role)) continue
      await input.assertFence()
      await this.client.send(new AdminRemoveUserFromGroupCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        GroupName: role
      }))
    }
    for (const role of desiredRoles) {
      if (currentRoles.includes(role)) continue
      await input.assertFence()
      await this.client.send(new AdminAddUserToGroupCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        GroupName: role
      }))
    }

    await input.assertFence()
    const verifiedRoles = canonicalApplicationRoles((await this.listGroups(username)).filter(isApplicationRole), true)
    if (!sameStringValues(verifiedRoles, desiredRoles)) {
      throw new Error("Authoritative application-role mutation verification failed")
    }
  }

  async disableUser(username: string): Promise<void> {
    this.assertMutationConfigured(username)
    await this.client.send(new AdminDisableUserCommand({ UserPoolId: this.userPoolId, Username: username }))
  }

  async enableUser(username: string): Promise<void> {
    this.assertMutationConfigured(username)
    await this.client.send(new AdminEnableUserCommand({ UserPoolId: this.userPoolId, Username: username }))
  }

  async deleteUser(username: string): Promise<void> {
    this.assertMutationConfigured(username)
    await this.client.send(new AdminDeleteUserCommand({ UserPoolId: this.userPoolId, Username: username }))
  }

  async revokeSessions(username: string): Promise<void> {
    this.assertMutationConfigured(username)
    await this.client.send(new AdminUpdateUserAttributesCommand({
      UserPoolId: this.userPoolId,
      Username: username,
      UserAttributes: [{ Name: COGNITO_SESSION_INVALID_AT_USER_ATTRIBUTE, Value: String(this.now().getTime()) }]
    }))
    await this.client.send(new AdminUserGlobalSignOutCommand({ UserPoolId: this.userPoolId, Username: username }))
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

  private assertMutationConfigured(username: string): void {
    if (!this.userPoolId || !username.trim()) throw new Error("Cognito user mutation is not configured")
  }
}

function canonicalApplicationRoles(values: readonly string[], allowEmpty = false): ApplicationRole[] {
  if ((!allowEmpty && values.length === 0) || values.some((value) => !isApplicationRole(value)) || new Set(values).size !== values.length) {
    throw new Error("Application-role set is invalid")
  }
  const selected = new Set(values as readonly ApplicationRole[])
  return APPLICATION_ROLES.filter((role) => selected.has(role))
}

function sameStringValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
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
