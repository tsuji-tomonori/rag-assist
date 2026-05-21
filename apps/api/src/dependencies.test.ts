import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"
import test from "node:test"

test("createDependencies_usesDynamoDbStores_evenWhenLocalFlagsAreSet", () => {
  const result = runDependencyProbe({
    USE_LOCAL_QUESTION_STORE: "true",
    USE_LOCAL_CONVERSATION_HISTORY_STORE: "true"
  })

  assert.equal(result.status, 0, result.stderr)
  const deps = JSON.parse(result.stdout)
  assert.equal(deps.questionStore, "DynamoDbQuestionStore")
  assert.equal(deps.conversationHistoryStore, "DynamoDbConversationHistoryStore")
  assert.equal(deps.favoriteStore, "DynamoDbFavoriteStore")
})

test("createDynamoDbClient_usesEndpointWhenConfigured", () => {
  const tsxBin = path.resolve(process.cwd(), "../../node_modules/.bin/tsx")
  const result = spawnSync(tsxBin, ["--eval", [
    "process.env.DYNAMODB_ENDPOINT='http://localhost:8000';",
    "const { createDynamoDbClient } = await import('./src/adapters/dynamodb-client.ts');",
    "const endpoint = await createDynamoDbClient().config.endpoint();",
    "console.log(endpoint.href);"
  ].join("")], {
    cwd: process.cwd(),
    env: { ...process.env },
    encoding: "utf8"
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), "http://localhost:8000/")
})

function runDependencyProbe(env: NodeJS.ProcessEnv) {
  const tsxBin = path.resolve(process.cwd(), "../../node_modules/.bin/tsx")
  return spawnSync(tsxBin, ["--eval", [
    "const { createDependencies } = await import('./src/dependencies.ts');",
    "const deps = createDependencies();",
    "console.log(JSON.stringify({",
    "questionStore: deps.questionStore.constructor.name,",
    "conversationHistoryStore: deps.conversationHistoryStore.constructor.name,",
    "favoriteStore: deps.favoriteStore.constructor.name",
    "}));"
  ].join("")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "development",
      MOCK_BEDROCK: "true",
      USE_LOCAL_VECTOR_STORE: "true",
      ...env
    },
    encoding: "utf8"
  })
}
