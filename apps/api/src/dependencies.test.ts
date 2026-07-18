import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import test from "node:test"
import { Worker } from "node:worker_threads"
import {
  MANDATORY_RAG_GUARDS,
  STANDARD_RAG_GUARD_PROFILE
} from "./rag/_shared/security/safe-degradation-policy.js"

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const safeRagGuardProfileJson = JSON.stringify(STANDARD_RAG_GUARD_PROFILE)

test("createDependencies_usesDynamoDbStores_evenWhenLocalFlagsAreSet", async () => {
  const result = await runDependencyProbe({
    USE_LOCAL_QUESTION_STORE: "true",
    USE_LOCAL_CONVERSATION_HISTORY_STORE: "true"
  })

  assert.equal(result.status, 0, result.stderr)
  const deps = JSON.parse(result.stdout)
  assert.equal(deps.questionStore, "DynamoDbQuestionStore")
  assert.equal(deps.conversationHistoryStore, "DynamoDbConversationHistoryStore")
  assert.equal(deps.favoriteStore, "DynamoDbFavoriteStore")
  assert.equal(deps.securityAuditOutbox, "ObjectStoreSecurityMutationAuditOutbox")
  assert.equal(deps.securityAuditReconciliationUsesMutationOutbox, true)
  assert.deepEqual(deps.ragGuardProfile, STANDARD_RAG_GUARD_PROFILE)
})

test("FR-089 createDependencies rejects an unset guard profile at startup", async () => {
  const result = await runDependencyProbe({}, ["RAG_GUARD_PROFILE_JSON"])

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /RAG_GUARD_PROFILE_JSON is required/)
})

test("FR-089 createDependencies rejects unknown, partial, and all-off profiles at startup", async () => {
  const partial = structuredClone(STANDARD_RAG_GUARD_PROFILE) as {
    id: string
    version: string
    guards: Record<string, boolean>
  }
  delete partial.guards.citation
  const unknown = structuredClone(STANDARD_RAG_GUARD_PROFILE) as {
    id: string
    version: string
    guards: Record<string, boolean>
  }
  unknown.guards.unapproved_guard = true
  const allOff = {
    ...STANDARD_RAG_GUARD_PROFILE,
    guards: Object.fromEntries(MANDATORY_RAG_GUARDS.map((guard) => [guard, false]))
  }

  for (const [label, profile, expected] of [
    ["unknown", unknown, /unknown keys: unapproved_guard/],
    ["partial", partial, /missing required keys: citation/],
    ["all-off", allOff, /mandatory guards disabled/]
  ] as const) {
    const result = await runDependencyProbe({ RAG_GUARD_PROFILE_JSON: JSON.stringify(profile) })
    assert.notEqual(result.status, 0, label)
    assert.match(result.stderr, expected, label)
  }
})

test("createDynamoDbClient_usesEndpointWhenConfigured", async () => {
  const result = await runIsolatedProbe({
    mode: "dynamodbEndpoint",
    moduleUrl: pathToFileURL(path.resolve(apiRoot, "src/adapters/dynamodb-client.ts")).href,
    env: { ...process.env, DYNAMODB_ENDPOINT: "http://localhost:8000" }
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), "http://localhost:8000/")
})

test("createDependencies_rejectsLegacyLocalStoreEscapeInProduction", async () => {
  const result = await runDependencyProbe({
    NODE_ENV: "production",
    AUTH_ENABLED: "true",
    CORS_ALLOWED_ORIGINS: "https://example.com",
    DOCS_BUCKET_NAME: "docs-bucket",
    FAVORITES_TABLE_NAME: "FavoritesTable",
    COGNITO_USER_POOL_ID: "pool",
    COGNITO_APP_CLIENT_ID: "client",
    AUTH_TENANT_ID: "tenant-production",
    BENCHMARK_EVALUATION_ENABLED: "false",
    MEMORAG_ALLOW_LEGACY_LOCAL_STORE_FOR_TESTS: "true"
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /MEMORAG_ALLOW_LEGACY_LOCAL_STORE_FOR_TESTS is not allowed in production/)
})

function runDependencyProbe(env: NodeJS.ProcessEnv, unsetEnv: readonly string[] = []) {
  return runIsolatedProbe({
    mode: "dependencies",
    moduleUrl: pathToFileURL(path.resolve(apiRoot, "src/dependencies.ts")).href,
    env: {
      ...process.env,
      NODE_ENV: "development",
      MOCK_BEDROCK: "true",
      USE_LOCAL_VECTOR_STORE: "true",
      RAG_GUARD_PROFILE_JSON: safeRagGuardProfileJson,
      ...env
    },
    unsetEnv
  })
}

type ProbeResult = Readonly<{ status: number; stdout: string; stderr: string }>

function runIsolatedProbe(input: Readonly<{
  mode: "dependencies" | "dynamodbEndpoint"
  moduleUrl: string
  env: NodeJS.ProcessEnv
  unsetEnv?: readonly string[]
}>): Promise<ProbeResult> {
  const source = `
    import { parentPort, workerData } from "node:worker_threads";
    Object.assign(process.env, workerData.env);
    for (const name of workerData.unsetEnv ?? []) delete process.env[name];
    try {
      const { register } = await import(workerData.tsxApiUrl);
      register();
      const module = await import(workerData.moduleUrl);
      if (workerData.mode === "dependencies") {
        const deps = module.createDependencies();
        parentPort.postMessage({ status: 0, stdout: JSON.stringify({
          questionStore: deps.questionStore.constructor.name,
          conversationHistoryStore: deps.conversationHistoryStore.constructor.name,
          favoriteStore: deps.favoriteStore.constructor.name,
          securityAuditOutbox: deps.securityAuditOutbox?.constructor.name,
          securityAuditReconciliationUsesMutationOutbox:
            deps.securityAuditReconciliationOutbox === deps.securityAuditOutbox,
          ragGuardProfile: deps.ragGuardProfile
        }), stderr: "" });
      } else {
        const endpoint = await module.createDynamoDbClient().config.endpoint();
        parentPort.postMessage({
          status: 0,
          stdout: endpoint.protocol + "//" + endpoint.hostname + ":" + endpoint.port + endpoint.path,
          stderr: ""
        });
      }
    } catch (error) {
      parentPort.postMessage({
        status: 1,
        stdout: "",
        stderr: error instanceof Error ? (error.stack ?? error.message) : String(error)
      });
    }
  `
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(source)}`), {
      workerData: { ...input, tsxApiUrl: import.meta.resolve("tsx/esm/api") }
    })
    worker.once("message", (result: ProbeResult) => resolve(result))
    worker.once("error", reject)
    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`Dependency probe worker exited with code ${code}`))
    })
  })
}
