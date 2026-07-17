import { AdminAddUserToGroupCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider"
import type { PostConfirmationTriggerEvent, PostConfirmationTriggerHandler } from "aws-lambda"

const client = new CognitoIdentityProviderClient({})
const defaultGroupName = "CHAT_USER"
const maxAssignmentAttempts = 3

type Dependencies = {
  addUserToGroup?: (input: { userPoolId: string; username: string; groupName: typeof defaultGroupName }) => Promise<void>
  waitBeforeRetry?: (attempt: number) => Promise<void>
}

export function createPostConfirmationHandler(dependencies: Dependencies = {}) {
  const addUserToGroup = dependencies.addUserToGroup ?? (async (input) => {
    await client.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: input.userPoolId,
        Username: input.username,
        GroupName: input.groupName
      })
    )
  })
  const waitBeforeRetry = dependencies.waitBeforeRetry ?? (async (attempt) => {
    await new Promise((resolve) => setTimeout(resolve, attempt * 100))
  })

  return async (event: PostConfirmationTriggerEvent): Promise<PostConfirmationTriggerEvent> => {
    if (event.triggerSource !== "PostConfirmation_ConfirmSignUp") {
      return event
    }

    const userPoolId = event.userPoolId?.trim()
    const username = event.userName?.trim()
    if (!userPoolId || !username) {
      throw new Error("Cognito post-confirmation event is missing its user pool or username")
    }

    for (let attempt = 1; attempt <= maxAssignmentAttempts; attempt += 1) {
      try {
        await addUserToGroup({ userPoolId, username, groupName: defaultGroupName })
        console.info(JSON.stringify({
          event: "cognito_post_confirmation_group_assignment",
          result: "success",
          groupName: defaultGroupName,
          attempt,
          userPoolId,
          subject: event.request.userAttributes.sub ?? "unknown"
        }))
        return event
      } catch (error) {
        console.warn(JSON.stringify({
          event: "cognito_post_confirmation_group_assignment",
          result: attempt === maxAssignmentAttempts ? "failure" : "retryable_failure",
          groupName: defaultGroupName,
          attempt,
          userPoolId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        }))
        if (attempt === maxAssignmentAttempts) {
          throw new Error("Failed to assign the default Cognito group after retries", { cause: error })
        }
        await waitBeforeRetry(attempt)
      }
    }

    throw new Error("Unreachable Cognito group assignment state")
  }
}

export const handler: PostConfirmationTriggerHandler = createPostConfirmationHandler()
