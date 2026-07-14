import assert from "node:assert/strict"
import { setTimeout as delay } from "node:timers/promises"
import test from "node:test"
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUpdateUserAttributesCommand,
  AdminUserGlobalSignOutCommand,
  ListUsersCommand
} from "@aws-sdk/client-cognito-identity-provider"
import { CognitoUserDirectory } from "./user-directory.js"

test("Cognito user directory paginates users and groups while tolerating per-user group failures", async () => {
  const warn = console.warn
  const warnings: unknown[][] = []
  console.warn = (...args: unknown[]) => warnings.push(args)
  try {
    const directory = new CognitoUserDirectory("pool-1", {
      send: async (command) => {
        if (command instanceof ListUsersCommand) {
          const token = (command as any).input.PaginationToken
          return token
            ? {
                Users: [
                  {
                    Username: "user-2",
                    Attributes: [
                      { Name: "sub", Value: "sub-2" },
                      { Name: "email", Value: "user2@example.com" }
                    ],
                    Enabled: true,
                    UserCreateDate: new Date("2026-05-01T00:00:00.000Z"),
                    UserLastModifiedDate: new Date("2026-05-01T00:00:00.000Z")
                  }
                ]
              }
            : {
                Users: [
                  {
                    Username: "user-1",
                    Attributes: [
                      { Name: "sub", Value: "sub-1" },
                      { Name: "email", Value: "user1@example.com" },
                      { Name: "name", Value: "User One" }
                    ],
                    Enabled: true,
                    UserCreateDate: new Date("2026-05-01T00:00:00.000Z"),
                    UserLastModifiedDate: new Date("2026-05-02T00:00:00.000Z")
                  }
                ],
                PaginationToken: "next-page"
              }
        }
        if (command instanceof AdminListGroupsForUserCommand) {
          const input = (command as any).input
          if (input.Username === "user-2") throw new Error("group throttled")
          return input.NextToken
            ? { Groups: [{ GroupName: "ANSWER_EDITOR" }] }
            : { Groups: [{ GroupName: "CHAT_USER" }], NextToken: "next-group-page" }
        }
        throw new Error("unexpected command")
      }
    })

    const users = await directory.listUsers()

    assert.deepEqual(users.map((user) => user.userId), ["sub-1", "sub-2"])
    assert.deepEqual(users[0]?.groups, ["CHAT_USER", "ANSWER_EDITOR"])
    assert.deepEqual(users[1]?.groups, [])
    assert.equal(warnings.length, 2)
    assert.equal(JSON.parse(String(warnings[0]?.[0])).event, "cognito_user_directory_group_lookup_failed")
    const metricLog = JSON.parse(String(warnings[1]?.[0]))
    assert.equal(metricLog.event, "cognito_user_directory_group_lookup_failure_summary")
    assert.equal(metricLog.CognitoGroupLookupFailureCount, 1)
    assert.equal(metricLog.CognitoGroupLookupFailureRate, 50)
    assert.deepEqual(metricLog.failedUsernames, ["user-2"])
    assert.equal(metricLog._aws.CloudWatchMetrics[0].Namespace, "MemoRAG/Admin")
  } finally {
    console.warn = warn
  }
})

test("Cognito user directory limits concurrent group lookups", async () => {
  let activeGroupLookups = 0
  let maxActiveGroupLookups = 0
  const directory = new CognitoUserDirectory("pool-1", {
    send: async (command) => {
      if (command instanceof ListUsersCommand) {
        return {
          Users: Array.from({ length: 12 }, (_, index) => ({
            Username: `user-${index}`,
            Attributes: [
              { Name: "sub", Value: `sub-${index}` },
              { Name: "email", Value: `user${index}@example.com` }
            ],
            Enabled: true
          }))
        }
      }
      if (command instanceof AdminListGroupsForUserCommand) {
        activeGroupLookups += 1
        maxActiveGroupLookups = Math.max(maxActiveGroupLookups, activeGroupLookups)
        await delay(10)
        activeGroupLookups -= 1
        return { Groups: [{ GroupName: "CHAT_USER" }] }
      }
      throw new Error("unexpected command")
    }
  })

  const users = await directory.listUsers()

  assert.equal(users.length, 12)
  assert.equal(maxActiveGroupLookups <= 5, true)
})

test("Cognito user directory syncs managed role groups while preserving external groups", async () => {
  const commands: unknown[] = []
  const directory = new CognitoUserDirectory("pool-1", {
    send: async (command) => {
      commands.push(command)
      if (command instanceof AdminListGroupsForUserCommand) {
        return {
          Groups: [
            { GroupName: "CHAT_USER" },
            { GroupName: "EXTERNAL_GROUP" }
          ]
        }
      }
      if (command instanceof AdminAddUserToGroupCommand || command instanceof AdminRemoveUserFromGroupCommand) {
        return {}
      }
      throw new Error("unexpected command")
    }
  })

  await directory.setUserGroups("user@example.com", ["ANSWER_EDITOR", "BENCHMARK_OPERATOR"])

  const addCommands = commands.filter((command) => command instanceof AdminAddUserToGroupCommand)
  const removeCommands = commands.filter((command) => command instanceof AdminRemoveUserFromGroupCommand)
  assert.deepEqual(addCommands.map((command) => (command as any).input.GroupName), ["ANSWER_EDITOR", "BENCHMARK_OPERATOR"])
  assert.deepEqual(removeCommands.map((command) => (command as any).input.GroupName), ["CHAT_USER"])
  assert.equal(removeCommands.some((command) => (command as any).input.GroupName === "EXTERNAL_GROUP"), false)
  assert.ok(commands.indexOf(removeCommands[0]) < commands.indexOf(addCommands[0]))
})

test("FR-080 Cognito role replacement enforces expected roles and revalidates the durable fence at each identity write", async () => {
  const commands: unknown[] = []
  const groups = new Set(["SYSTEM_ADMIN", "EXTERNAL_GROUP"])
  const directory = new CognitoUserDirectory("pool-1", {
    send: async (command) => {
      commands.push(command)
      if (command instanceof AdminListGroupsForUserCommand) {
        return { Groups: [...groups].map((GroupName) => ({ GroupName })) }
      }
      if (command instanceof AdminRemoveUserFromGroupCommand) {
        groups.delete((command as any).input.GroupName)
        return {}
      }
      if (command instanceof AdminAddUserToGroupCommand) {
        groups.add((command as any).input.GroupName)
        return {}
      }
      throw new Error("unexpected command")
    }
  })
  let fenceAssertions = 0

  await directory.replaceApplicationRoles?.("admin-user", {
    expectedRoles: ["SYSTEM_ADMIN"],
    desiredRoles: ["CHAT_USER"],
    operationId: "application-role:audit-1",
    fencingToken: "fence-1",
    assertFence: async () => { fenceAssertions += 1 }
  })

  assert.deepEqual([...groups].sort(), ["CHAT_USER", "EXTERNAL_GROUP"])
  assert.equal(fenceAssertions, 4)
  const writes = commands.filter((command) => (
    command instanceof AdminRemoveUserFromGroupCommand || command instanceof AdminAddUserToGroupCommand
  ))
  assert.deepEqual(writes.map((command) => (command as any).input.GroupName), ["SYSTEM_ADMIN", "CHAT_USER"])

  await assert.rejects(() => directory.replaceApplicationRoles!("admin-user", {
    expectedRoles: ["SYSTEM_ADMIN"],
    desiredRoles: ["ANSWER_EDITOR"],
    operationId: "application-role:audit-2",
    fencingToken: "fence-2",
    assertFence: async () => undefined
  }), /changed before fenced mutation/)
})

test("Cognito user directory applies account lifecycle and global session revocation authoritatively", async () => {
  const commands: unknown[] = []
  const directory = new CognitoUserDirectory("pool-1", {
    send: async (command) => {
      commands.push(command)
      return {}
    }
  }, () => new Date("2026-07-11T00:00:00.123Z"))

  await directory.disableUser("cognito-user")
  await directory.revokeSessions("cognito-user")
  await directory.enableUser("cognito-user")
  await directory.deleteUser("cognito-user")

  assert.deepEqual(commands.map((command) => (command as object).constructor), [
    AdminDisableUserCommand,
    AdminUpdateUserAttributesCommand,
    AdminUserGlobalSignOutCommand,
    AdminEnableUserCommand,
    AdminDeleteUserCommand
  ])
  assert.deepEqual(commands.map((command) => (command as any).input), [
    { UserPoolId: "pool-1", Username: "cognito-user" },
    {
      UserPoolId: "pool-1",
      Username: "cognito-user",
      UserAttributes: [{ Name: "custom:session_invalid_after", Value: "1783728000123" }]
    },
    { UserPoolId: "pool-1", Username: "cognito-user" },
    { UserPoolId: "pool-1", Username: "cognito-user" },
    { UserPoolId: "pool-1", Username: "cognito-user" }
  ])
})

test("Cognito user directory creates an authoritative identity before role assignment", async () => {
  const commands: unknown[] = []
  const directory = new CognitoUserDirectory("pool-1", {
    send: async (command) => {
      commands.push(command)
      if (command instanceof AdminCreateUserCommand) {
        return {
          User: {
            Username: "managed-001",
            Attributes: [
              { Name: "sub", Value: "subject-001" },
              { Name: "email", Value: "worker@example.com" },
              { Name: "name", Value: "Worker One" }
            ],
            Enabled: true,
            UserCreateDate: new Date("2026-07-11T00:00:00.000Z"),
            UserLastModifiedDate: new Date("2026-07-11T00:00:01.000Z")
          }
        }
      }
      throw new Error("unexpected command")
    }
  })

  const created = await directory.createUser?.({
    username: "managed-001",
    email: "worker@example.com",
    displayName: "Worker One"
  })

  assert.deepEqual(created, {
    username: "managed-001",
    userId: "subject-001",
    email: "worker@example.com",
    displayName: "Worker One",
    status: "active",
    groups: [],
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:01.000Z"
  })
  assert.deepEqual((commands[0] as any).input, {
    UserPoolId: "pool-1",
    Username: "managed-001",
    UserAttributes: [
      { Name: "email", Value: "worker@example.com" },
      { Name: "name", Value: "Worker One" }
    ],
    DesiredDeliveryMediums: ["EMAIL"]
  })
})

test("Cognito user directory handles empty pools, fallback attributes, and empty usernames", async () => {
  const emptyPool = new CognitoUserDirectory("", {
    send: async () => {
      throw new Error("client should not be called without a pool")
    }
  })
  assert.deepEqual(await emptyPool.listUsers(), [])
  await emptyPool.setUserGroups?.("user@example.com", ["CHAT_USER"])

  const warn = console.warn
  const warnings: unknown[][] = []
  console.warn = (...args: unknown[]) => warnings.push(args)
  try {
    const commands: unknown[] = []
    const directory = new CognitoUserDirectory("pool-1", {
      send: async (command) => {
        commands.push(command)
        if (command instanceof ListUsersCommand) {
          return {
            Users: [
              {
                Username: "",
                Attributes: [],
                Enabled: false
              },
              {
                Attributes: [{ Name: "sub", Value: "sub-only" }],
                Enabled: true,
                UserCreateDate: new Date("2026-05-03T00:00:00.000Z")
              }
            ]
          }
        }
        if (command instanceof AdminListGroupsForUserCommand) {
          return { Groups: [{}, { GroupName: "" }, { GroupName: "CHAT_USER" }] }
        }
        throw new Error("unexpected command")
      }
    })

    const users = await directory.listUsers()
    assert.equal(users[0]?.userId, "unknown@example.local")
    assert.equal(users[0]?.email, "unknown@example.local")
    assert.equal(users[0]?.displayName, "unknown")
    assert.equal(users[0]?.status, "suspended")
    assert.deepEqual(users[0]?.groups, [])
    assert.equal(users[1]?.userId, "sub-only")
    assert.equal(users[1]?.email, "sub-only")
    assert.equal(users[1]?.updatedAt, users[1]?.createdAt)
    assert.deepEqual(users[1]?.groups, [])
    assert.equal(warnings.length, 0)
    assert.equal(commands.some((command) => command instanceof AdminListGroupsForUserCommand && (command as any).input.Username === ""), false)
  } finally {
    console.warn = warn
  }
})

test("Cognito user directory skips existing desired groups and unmanaged removals", async () => {
  const commands: unknown[] = []
  const directory = new CognitoUserDirectory("pool-1", {
    send: async (command) => {
      commands.push(command)
      if (command instanceof AdminListGroupsForUserCommand) {
        return {
          Groups: [
            { GroupName: "CHAT_USER" },
            { GroupName: "EXTERNAL_GROUP" }
          ]
        }
      }
      if (command instanceof AdminAddUserToGroupCommand || command instanceof AdminRemoveUserFromGroupCommand) return {}
      throw new Error("unexpected command")
    }
  })

  await directory.setUserGroups("user@example.com", ["CHAT_USER", "EXTERNAL_GROUP"])

  assert.equal(commands.some((command) => command instanceof AdminAddUserToGroupCommand), false)
  assert.equal(commands.some((command) => command instanceof AdminRemoveUserFromGroupCommand), false)
})
