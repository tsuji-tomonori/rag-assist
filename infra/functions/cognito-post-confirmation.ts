import { AdminAddUserToGroupCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider"
import { DEFAULT_APPLICATION_ROLE, isApplicationRole } from "@memorag-mvp/contract/access-control"
import type { PostConfirmationTriggerHandler } from "aws-lambda"

const client = new CognitoIdentityProviderClient({})

export const handler: PostConfirmationTriggerHandler = async (event) => {
  if (event.triggerSource !== "PostConfirmation_ConfirmSignUp") {
    return event
  }

  const configuredDefaultRole = process.env.DEFAULT_SIGNUP_GROUP_NAME ?? DEFAULT_APPLICATION_ROLE
  if (!isApplicationRole(configuredDefaultRole)) {
    throw new Error("DEFAULT_SIGNUP_GROUP_NAME must be a canonical application role")
  }

  await client.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: event.userPoolId,
      Username: event.userName,
      GroupName: configuredDefaultRole
    })
  )

  return event
}
