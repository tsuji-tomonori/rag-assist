import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repoRoot = path.resolve(apiRoot, "../..")

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
  const tsxBin = path.resolve(repoRoot, "node_modules/.bin/tsx")
  const result = spawnSync(tsxBin, ["--eval", [
    "(async()=>{",
    "process.env.DYNAMODB_ENDPOINT='http://localhost:8000';",
    "const { createDynamoDbClient } = await import('./src/adapters/dynamodb-client.ts');",
    "const endpoint = await createDynamoDbClient().config.endpoint();",
    "console.log(`${endpoint.protocol}//${endpoint.hostname}:${endpoint.port}${endpoint.path}`);",
    "})().catch((err)=>{ console.error(err); process.exit(1); });"
  ].join("")], {
    cwd: apiRoot,
    env: { ...process.env },
    encoding: "utf8"
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), "http://localhost:8000/")
})

test("createDependencies_rejectsLegacyLocalStoreEscapeInProduction", () => {
  const result = runDependencyProbe({
    NODE_ENV: "production",
    AUTH_ENABLED: "true",
    CORS_ALLOWED_ORIGINS: "https://example.com",
    DOCS_BUCKET_NAME: "docs-bucket",
    FAVORITES_TABLE_NAME: "FavoritesTable",
    COGNITO_USER_POOL_ID: "pool",
    COGNITO_APP_CLIENT_ID: "client",
    MEMORAG_ALLOW_LEGACY_LOCAL_STORE_FOR_TESTS: "true"
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /MEMORAG_ALLOW_LEGACY_LOCAL_STORE_FOR_TESTS is not allowed in production/)
})

function runDependencyProbe(env: NodeJS.ProcessEnv) {
  const tsxBin = path.resolve(repoRoot, "node_modules/.bin/tsx")
  return spawnSync(tsxBin, ["--eval", [
    "(async()=>{",
    "const { createDependencies } = await import('./src/dependencies.ts');",
    "const deps = createDependencies();",
    "console.log(JSON.stringify({",
    "questionStore: deps.questionStore.constructor.name,",
    "conversationHistoryStore: deps.conversationHistoryStore.constructor.name,",
    "favoriteStore: deps.favoriteStore.constructor.name",
    "}));",
    "})().catch((err)=>{ console.error(err); process.exit(1); });"
  ].join("")], {
    cwd: apiRoot,
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
