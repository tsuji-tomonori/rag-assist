import assert from "node:assert/strict"
import test from "node:test"
import {
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  ListUsersCommand,
  type AdminGetUserCommandOutput
} from "@aws-sdk/client-cognito-identity-provider"
import { CognitoVerifiedIdentityProvider } from "./verified-identity-provider.js"

test("CognitoVerifiedIdentityProvider reads current account, tenant, and paginated groups from Cognito", async () => {
  const captured: Array<AdminGetUserCommand | AdminListGroupsForUserCommand | ListUsersCommand> = []
  let groupPage = 0
  const provider = new CognitoVerifiedIdentityProvider("pool-1", {
    async send(command) {
      captured.push(command)
      if (command instanceof AdminGetUserCommand) return identityOutput(true)
      if (command instanceof AdminListGroupsForUserCommand) {
        groupPage += 1
        return groupPage === 1
          ? { $metadata: {}, Groups: [{ GroupName: "CHAT_USER" }], NextToken: "next" }
          : { $metadata: {}, Groups: [{ GroupName: "ANSWER_EDITOR" }, { GroupName: "CHAT_USER" }] }
      }
      return { $metadata: {}, Users: [] }
    }
  }, "tenant-1")

  assert.deepEqual(await provider.getCurrentIdentity("cognito-user"), {
    username: "cognito-user",
    userId: "subject-1",
    email: "verified@example.com",
    accountStatus: "active",
    cognitoGroups: ["ANSWER_EDITOR", "CHAT_USER"],
    tenantId: "tenant-1"
  })
  assert.deepEqual((captured[0] as AdminGetUserCommand).input, { UserPoolId: "pool-1", Username: "cognito-user" })
})

test("CognitoVerifiedIdentityProvider re-reads the current Enabled value for each lookup", async () => {
  let enabled = true
  let getCalls = 0
  const provider = new CognitoVerifiedIdentityProvider("pool-1", {
    async send(command) {
      if (command instanceof AdminGetUserCommand) {
        getCalls += 1
        return identityOutput(enabled)
      }
      if (command instanceof AdminListGroupsForUserCommand) return { $metadata: {}, Groups: [] }
      return { $metadata: {}, Users: [] }
    }
  }, "tenant-1")

  assert.equal((await provider.getCurrentIdentity("cognito-user"))?.accountStatus, "active")
  enabled = false
  assert.equal((await provider.getCurrentIdentity("cognito-user"))?.accountStatus, "suspended")
  assert.equal(getCalls, 2)
})

test("CognitoVerifiedIdentityProvider exposes the authoritative session revocation epoch", async () => {
  const provider = new CognitoVerifiedIdentityProvider("pool-1", {
    async send(command) {
      if (command instanceof AdminGetUserCommand) {
        const output = identityOutput(true)
        output.UserAttributes?.push({ Name: "custom:session_invalid_after", Value: "1783728000123" })
        return output
      }
      if (command instanceof AdminListGroupsForUserCommand) return { $metadata: {}, Groups: [] }
      return { $metadata: {}, Users: [] }
    }
  }, "tenant-1")

  assert.equal((await provider.getCurrentIdentity("cognito-user"))?.sessionInvalidAfterEpochMs, 1_783_728_000_123)
})

test("CognitoVerifiedIdentityProvider resolves a worker principal by subject and re-reads its current state", async () => {
  const commands: Array<AdminGetUserCommand | AdminListGroupsForUserCommand | ListUsersCommand> = []
  const provider = new CognitoVerifiedIdentityProvider("pool-1", {
    async send(command) {
      commands.push(command)
      if (command instanceof ListUsersCommand) {
        return {
          $metadata: {},
          Users: [{ Username: "cognito-user", Attributes: [{ Name: "sub", Value: "subject-1" }] }]
        }
      }
      if (command instanceof AdminGetUserCommand) return identityOutput(true)
      return { $metadata: {}, Groups: [{ GroupName: "CHAT_USER" }] }
    }
  }, "tenant-1")

  assert.equal((await provider.getCurrentIdentityBySubject("subject-1"))?.username, "cognito-user")
  assert.deepEqual((commands[0] as ListUsersCommand).input, {
    UserPoolId: "pool-1",
    Filter: 'sub = "subject-1"',
    Limit: 2
  })
  assert.ok(commands[1] instanceof AdminGetUserCommand)
  assert.ok(commands[2] instanceof AdminListGroupsForUserCommand)
})

test("CognitoVerifiedIdentityProvider treats a missing Cognito user as deleted", async () => {
  const provider = new CognitoVerifiedIdentityProvider("pool-1", {
    async send(command) {
      if (command instanceof AdminListGroupsForUserCommand) return { $metadata: {}, Groups: [] }
      if (command instanceof ListUsersCommand) return { $metadata: {}, Users: [] }
      const error = new Error("missing")
      error.name = "UserNotFoundException"
      throw error
    }
  }, "tenant-1")

  assert.equal(await provider.getCurrentIdentity("deleted-user"), undefined)
})

test("CognitoVerifiedIdentityProvider fails closed when server-managed fields are absent", async () => {
  const missingSubject = new CognitoVerifiedIdentityProvider("pool-1", {
    async send(command) {
      if (command instanceof AdminListGroupsForUserCommand) return { $metadata: {}, Groups: [] }
      if (command instanceof ListUsersCommand) return { $metadata: {}, Users: [] }
      return { $metadata: {}, Username: "cognito-user", Enabled: true, UserAttributes: [] }
    }
  }, "tenant-1")
  const missingStatus = new CognitoVerifiedIdentityProvider("pool-1", {
    async send(command) {
      if (command instanceof AdminListGroupsForUserCommand) return { $metadata: {}, Groups: [] }
      if (command instanceof ListUsersCommand) return { $metadata: {}, Users: [] }
      return {
        $metadata: {},
        Username: "cognito-user",
        UserAttributes: [{ Name: "sub", Value: "subject-1" }]
      }
    }
  }, "tenant-1")

  await assert.rejects(missingSubject.getCurrentIdentity("cognito-user"), /does not contain a subject/)
  await assert.rejects(missingStatus.getCurrentIdentity("cognito-user"), /authoritative account status/)
})

function identityOutput(enabled: boolean): AdminGetUserCommandOutput {
  return {
    $metadata: {},
    Username: "cognito-user",
    Enabled: enabled,
    UserAttributes: [
      { Name: "sub", Value: "subject-1" },
      { Name: "email", Value: "verified@example.com" }
    ]
  }
}
