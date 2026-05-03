#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { pathToFileURL } from "node:url"

if (isMainModule()) {
  main()
}

export function main() {
  const secretId = process.env.BENCHMARK_AUTH_SECRET_ID
  if (!secretId) throw new Error("BENCHMARK_AUTH_SECRET_ID is required")

  const secret = JSON.parse(aws(["secretsmanager", "get-secret-value", "--secret-id", secretId, "--query", "SecretString", "--output", "text"]))
  const staticToken = secret.idToken ?? secret.token
  if (staticToken) {
    process.stdout.write(staticToken)
    process.exit(0)
  }

  const username = required(secret.username, "benchmark auth secret username")
  const password = required(secret.password, "benchmark auth secret password")
  const userPoolId = required(process.env.COGNITO_USER_POOL_ID, "COGNITO_USER_POOL_ID")
  const appClientId = required(process.env.COGNITO_APP_CLIENT_ID, "COGNITO_APP_CLIENT_ID")
  const runnerGroup = process.env.BENCHMARK_RUNNER_GROUP || "BENCHMARK_RUNNER"

  ensureRunnerUser({ userPoolId, username, password, runnerGroup })
  process.stdout.write(authenticate({ appClientId, username, password }))
}

function ensureRunnerUser({ userPoolId, username, password, runnerGroup }) {
  if (!userExists(userPoolId, username)) {
    aws([
      "cognito-idp",
      "admin-create-user",
      "--user-pool-id",
      userPoolId,
      "--username",
      username,
      "--temporary-password",
      password,
      "--message-action",
      "SUPPRESS",
      "--user-attributes",
      `Name=email,Value=${username}`,
      "Name=email_verified,Value=true"
    ])
  }

  aws([
    "cognito-idp",
    "admin-set-user-password",
    "--user-pool-id",
    userPoolId,
    "--username",
    username,
    "--password",
    password,
    "--permanent"
  ])

  aws([
    "cognito-idp",
    "admin-add-user-to-group",
    "--user-pool-id",
    userPoolId,
    "--username",
    username,
    "--group-name",
    runnerGroup
  ])
}

function userExists(userPoolId, username) {
  try {
    aws(["cognito-idp", "admin-get-user", "--user-pool-id", userPoolId, "--username", username])
    return true
  } catch (error) {
    if (String(error.stderr ?? error.message ?? error).includes("UserNotFoundException")) return false
    throw error
  }
}

function authenticate({ appClientId, username, password }) {
  const output = aws([
    "cognito-idp",
    "initiate-auth",
    "--auth-flow",
    "USER_PASSWORD_AUTH",
    "--client-id",
    appClientId,
    "--auth-parameters",
    cognitoAuthParameters({ username, password })
  ])
  const parsed = JSON.parse(output)
  const token = parsed.AuthenticationResult?.IdToken
  if (!token) throw new Error(`Cognito did not return an id token. Challenge: ${parsed.ChallengeName ?? "none"}`)
  return token
}

export function cognitoAuthParameters({ username, password }) {
  return JSON.stringify({ USERNAME: username, PASSWORD: password })
}

function aws(args) {
  return execFileSync("aws", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim()
}

function required(value, label) {
  if (!value) throw new Error(`${label} is required`)
  return value
}

function isMainModule() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false
}
