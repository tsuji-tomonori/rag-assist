import { AdminAddUserToGroupCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider"
import type { PostConfirmationTriggerHandler } from "aws-lambda"

const defaultGroupName = "CHAT_USER"
const client = new CognitoIdentityProviderClient({})

export const handler: PostConfirmationTriggerHandler = async (event) => {
  if (event.triggerSource !== "PostConfirmation_ConfirmSignUp") {
    return event
  }

  await client.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: event.userPoolId,
      Username: event.userName,
      GroupName: process.env.DEFAULT_SIGNUP_GROUP_NAME ?? defaultGroupName
    })
  )

  return event
}
