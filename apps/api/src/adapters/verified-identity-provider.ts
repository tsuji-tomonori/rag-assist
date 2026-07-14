import {
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type AdminGetUserCommandOutput,
  type AdminListGroupsForUserCommandOutput,
  type ListUsersCommandOutput
} from "@aws-sdk/client-cognito-identity-provider"
import { config } from "../config.js"

export type AccountStatus = "active" | "suspended" | "deleted"

export type ServerManagedIdentity = {
  username: string
  userId: string
  email?: string
  accountStatus: Exclude<AccountStatus, "deleted">
  cognitoGroups: string[]
  tenantId: string
  sessionInvalidAfterEpochMs?: number
}

export interface VerifiedIdentityProvider {
  getCurrentIdentity(username: string): Promise<ServerManagedIdentity | undefined>
  getCurrentIdentityBySubject(subject: string): Promise<ServerManagedIdentity | undefined>
}

type CognitoIdentityClient = {
  send(command: AdminGetUserCommand | AdminListGroupsForUserCommand | ListUsersCommand): Promise<unknown>
}

export class CognitoVerifiedIdentityProvider implements VerifiedIdentityProvider {
  private readonly client: CognitoIdentityClient

  constructor(
    private readonly userPoolId = config.cognitoUserPoolId,
    client?: CognitoIdentityClient,
    private readonly tenantId = config.authTenantId
  ) {
    this.client = client ?? new CognitoIdentityProviderClient({ region: config.cognitoRegion })
  }

  async getCurrentIdentity(username: string): Promise<ServerManagedIdentity | undefined> {
    const canonicalUsername = username.trim()
    const canonicalTenantId = this.tenantId.trim()
    if (!this.userPoolId || !canonicalUsername || !canonicalTenantId) throw new Error("Verified identity lookup is not configured")

    let result
    try {
      result = await this.client.send(new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: canonicalUsername
      })) as AdminGetUserCommandOutput
    } catch (error) {
      if (isUserNotFoundError(error)) return undefined
      throw error
    }

    const attributes = new Map(
      (result.UserAttributes ?? [])
        .filter((attribute): attribute is { Name: string; Value?: string } => Boolean(attribute.Name))
        .map((attribute) => [attribute.Name, attribute.Value])
    )
    const userId = attributes.get("sub")?.trim()
    if (!userId) throw new Error("Cognito identity does not contain a subject")
    if (result.Enabled !== true && result.Enabled !== false) {
      throw new Error("Cognito identity does not contain an authoritative account status")
    }

    const email = attributes.get("email")?.trim()
    const sessionInvalidAfterEpochMs = parseOptionalEpochMs(attributes.get("custom:session_invalid_after"))
    const cognitoGroups = await this.listCurrentGroups(canonicalUsername)
    return {
      username: result.Username?.trim() || canonicalUsername,
      userId,
      email: email || undefined,
      accountStatus: result.Enabled ? "active" : "suspended",
      cognitoGroups,
      tenantId: canonicalTenantId,
      ...(sessionInvalidAfterEpochMs === undefined ? {} : { sessionInvalidAfterEpochMs })
    }
  }

  async getCurrentIdentityBySubject(subject: string): Promise<ServerManagedIdentity | undefined> {
    const canonicalSubject = subject.trim()
    if (!this.userPoolId || !canonicalSubject) throw new Error("Verified identity lookup is not configured")

    let result
    try {
      result = await this.client.send(new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Filter: `sub = "${escapeCognitoFilterValue(canonicalSubject)}"`,
        Limit: 2
      })) as ListUsersCommandOutput
    } catch (error) {
      if (isUserNotFoundError(error)) return undefined
      throw error
    }
    const exactMatches = (result.Users ?? []).filter((user) => (
      user.Attributes?.some((attribute) => attribute.Name === "sub" && attribute.Value === canonicalSubject)
    ))
    if (exactMatches.length === 0) return undefined
    if (exactMatches.length !== 1) throw new Error("Cognito subject lookup is not unique")
    const username = exactMatches[0]?.Username?.trim()
    if (!username) throw new Error("Cognito identity does not contain a username")
    const identity = await this.getCurrentIdentity(username)
    if (identity && identity.userId !== canonicalSubject) throw new Error("Cognito subject changed during identity lookup")
    return identity
  }

  private async listCurrentGroups(username: string): Promise<string[]> {
    const groups: string[] = []
    let nextToken: string | undefined
    do {
      const result = await this.client.send(new AdminListGroupsForUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        NextToken: nextToken
      })) as AdminListGroupsForUserCommandOutput
      groups.push(...(result.Groups ?? [])
        .map((group) => group.GroupName?.trim())
        .filter((group): group is string => Boolean(group)))
      nextToken = result.NextToken
    } while (nextToken)
    return [...new Set(groups)].sort()
  }
}

function isUserNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.name === "UserNotFoundException"
}

function escapeCognitoFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function parseOptionalEpochMs(value: string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Cognito identity contains an invalid session revocation epoch")
  return parsed
}
