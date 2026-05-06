import assert from "node:assert/strict"
import { setTimeout as delay } from "node:timers/promises"
import test from "node:test"
import { AdminAddUserToGroupCommand, AdminListGroupsForUserCommand, AdminRemoveUserFromGroupCommand, ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider"
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
})
