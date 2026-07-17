import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import ts from "typescript"
import type { Dependencies } from "../dependencies.js"
import type { MemoRagService } from "./memorag-service.js"

type FunctionKey<T> = {
  [Key in keyof T]-?: T[Key] extends (...args: never[]) => unknown ? Key : never
}[keyof T]

type PublicMethodName = Extract<FunctionKey<MemoRagService>, string>
type Exact<Left, Right> = [Left] extends [Right]
  ? [Right] extends [Left]
    ? true
    : false
  : false
type Assert<T extends true> = T

const expectedPublicMethodNames = [
  "answerQuestion",
  "approveSourceGovernance",
  "assertDocumentGroupsWritable",
  "assertDocumentWritable",
  "assertSearchScopeReadable",
  "assignUserRoles",
  "cancelAsyncAgentRun",
  "cancelBenchmarkRun",
  "cancelDocumentIngestRun",
  "chat",
  "createAdminExportDownloadUrl",
  "createAlias",
  "createAsyncAgentRun",
  "createBenchmarkArtifactDownloadUrl",
  "createBenchmarkRun",
  "createCurrentDocumentIngestAuthorization",
  "createDebugReplayPlan",
  "createDebugTraceDownloadUrl",
  "createDocumentGroup",
  "createManagedUser",
  "createQuestion",
  "createSearchImprovementCandidate",
  "cutoverReindexMigration",
  "deleteConversationHistory",
  "deleteDocument",
  "deleteFavorite",
  "deleteManagedUser",
  "disableAlias",
  "discardUncommittedIngest",
  "executeAsyncAgentRun",
  "executeChatRun",
  "executeDocumentIngestRun",
  "getAsyncAgentArtifact",
  "getAsyncAgentRun",
  "getBenchmarkCodeBuildLogText",
  "getBenchmarkDocumentManifest",
  "getBenchmarkRun",
  "getCostAuditSummary",
  "getDebugRun",
  "getDocumentExtractedText",
  "getDocumentManifest",
  "getDocumentShareInfo",
  "getManagedUserDeletionPreflight",
  "getParsedDocumentPreview",
  "getQuestion",
  "getResourceGroupMembershipState",
  "getSourceGovernance",
  "ingest",
  "listAccessRoles",
  "listAdminAuditLog",
  "listAgentProviderSettings",
  "listAgentRuntimeProviders",
  "listAliasAuditLog",
  "listAliases",
  "listAllQuestionsForAdmin",
  "listAssignedQuestions",
  "listAsyncAgentArtifacts",
  "listAsyncAgentRuns",
  "listBenchmarkDocumentManifests",
  "listBenchmarkRuns",
  "listBenchmarkSuites",
  "listChatToolInvocations",
  "listConversationHistory",
  "listDebugRuns",
  "listDocumentGroups",
  "listDocuments",
  "listFavorites",
  "listManagedUsers",
  "listManagedUsersPage",
  "listQualityActionCards",
  "listReindexMigrations",
  "listRequestedQuestions",
  "listUsageSummaries",
  "markChatRunFailed",
  "markDocumentIngestRunFailed",
  "moveDocument",
  "moveDocumentGroup",
  "publishAliases",
  "reauthorizeBenchmarkRunExecution",
  "registerSourceGovernance",
  "reindexDocument",
  "replaceResourceGroupMemberships",
  "resolveQuestion",
  "restrictSourceGovernance",
  "retryPendingResourceGroupMembershipRevocationCleanups",
  "reviewAlias",
  "rollbackReindexMigration",
  "saveConversationHistory",
  "saveFavorite",
  "search",
  "stageReindexMigration",
  "startChatRun",
  "startDocumentIngestRun",
  "suspendManagedUser",
  "transferManagedUserAdministrativePrincipal",
  "transitionAliasToDraft",
  "unsuspendManagedUser",
  "updateAlias",
  "updateAsyncAgentArtifactWriteback",
  "updateDocumentGroupSharing",
  "updateDocumentShare"
] as const satisfies readonly PublicMethodName[]

const expectedDependencyKeys = [
  "accountRevocationRegistry",
  "administrativePrincipalTransferFence",
  "asyncAgentProviders",
  "benchmarkArtifactStore",
  "benchmarkRunStore",
  "chatRunEventStore",
  "chatRunStore",
  "codeBuildLogReader",
  "conversationHistoryStore",
  "documentGroupStore",
  "documentIngestRunEventStore",
  "documentIngestRunStore",
  "evidenceVectorStore",
  "favoriteStore",
  "folderPolicyStore",
  "groupMembershipStore",
  "legacyGlobalDocumentArtifacts",
  "localTestIngestAdmissionContext",
  "memoryVectorStore",
  "objectStore",
  "questionStore",
  "resourceUserPrincipalDirectory",
  "securityAuditOutbox",
  "securityAuditReconciliationOutbox",
  "textModel",
  "usageAccountingMode",
  "usageEventStore",
  "usagePricingCatalog",
  "userDirectory",
  "userGroupStore",
  "verifiedIdentityProvider"
] as const satisfies readonly (keyof Dependencies)[]

const publicMethodTypeContract: Assert<Exact<PublicMethodName, typeof expectedPublicMethodNames[number]>> = true
const dependencyTypeContract: Assert<Exact<keyof Dependencies, typeof expectedDependencyKeys[number]>> = true

const expectedConsumerMethods = {
  "apps/api/src/benchmark-run-authorization-worker.ts": ["reauthorizeBenchmarkRunExecution"],
  "apps/api/src/chat-run-mark-failed.ts": ["markChatRunFailed"],
  "apps/api/src/chat-run-worker.ts": ["executeChatRun"],
  "apps/api/src/document-ingest-run-mark-failed.ts": ["markDocumentIngestRunFailed"],
  "apps/api/src/document-ingest-run-worker.ts": ["executeDocumentIngestRun"],
  "apps/api/src/orpc/router.ts": ["chat", "search", "startChatRun"],
  "apps/api/src/routes/admin-routes.ts": [
    "assignUserRoles",
    "createAdminExportDownloadUrl",
    "createAlias",
    "createManagedUser",
    "deleteManagedUser",
    "disableAlias",
    "getCostAuditSummary",
    "getManagedUserDeletionPreflight",
    "listAccessRoles",
    "listAdminAuditLog",
    "listAliasAuditLog",
    "listAliases",
    "listManagedUsersPage",
    "listQualityActionCards",
    "listUsageSummaries",
    "publishAliases",
    "reviewAlias",
    "suspendManagedUser",
    "transferManagedUserAdministrativePrincipal",
    "transitionAliasToDraft",
    "unsuspendManagedUser",
    "updateAlias"
  ],
  "apps/api/src/routes/benchmark-routes.ts": [
    "cancelBenchmarkRun",
    "chat",
    "createBenchmarkArtifactDownloadUrl",
    "createBenchmarkRun",
    "getBenchmarkCodeBuildLogText",
    "getBenchmarkRun",
    "listBenchmarkRuns",
    "listBenchmarkSuites",
    "search"
  ],
  "apps/api/src/routes/benchmark-seed.ts": ["assertDocumentWritable", "getBenchmarkDocumentManifest", "getDocumentManifest"],
  "apps/api/src/routes/chat-routes.ts": ["chat", "listChatToolInvocations", "search", "startChatRun"],
  "apps/api/src/routes/conversation-history-routes.ts": ["deleteConversationHistory", "listConversationHistory", "saveConversationHistory"],
  "apps/api/src/routes/debug-routes.ts": ["createDebugReplayPlan", "createDebugTraceDownloadUrl", "getDebugRun", "listDebugRuns"],
  "apps/api/src/routes/document-routes.ts": [
    "approveSourceGovernance",
    "assertDocumentGroupsWritable",
    "createCurrentDocumentIngestAuthorization",
    "createDocumentGroup",
    "cutoverReindexMigration",
    "deleteDocument",
    "discardUncommittedIngest",
    "getBenchmarkDocumentManifest",
    "getDocumentExtractedText",
    "getDocumentShareInfo",
    "getParsedDocumentPreview",
    "getSourceGovernance",
    "ingest",
    "listBenchmarkDocumentManifests",
    "listDocumentGroups",
    "listDocuments",
    "listReindexMigrations",
    "moveDocument",
    "moveDocumentGroup",
    "registerSourceGovernance",
    "reindexDocument",
    "restrictSourceGovernance",
    "rollbackReindexMigration",
    "stageReindexMigration",
    "startDocumentIngestRun",
    "updateDocumentGroupSharing",
    "updateDocumentShare"
  ],
  "apps/api/src/routes/favorite-routes.ts": ["deleteFavorite", "listFavorites", "saveFavorite"],
  "apps/api/src/routes/question-routes.ts": [
    "answerQuestion",
    "createQuestion",
    "createSearchImprovementCandidate",
    "getQuestion",
    "listAllQuestionsForAdmin",
    "listAssignedQuestions",
    "resolveQuestion"
  ],
  "apps/api/src/routes/resource-group-routes.ts": ["getResourceGroupMembershipState", "replaceResourceGroupMemberships"]
} as const satisfies Record<string, readonly PublicMethodName[]>

const expectedConstructorSites = {
  "apps/api/src/app.ts": 1,
  "apps/api/src/benchmark-run-authorization-worker.test.ts": 1,
  "apps/api/src/benchmark-run-authorization-worker.ts": 1,
  "apps/api/src/chat-orchestration/graph.test.ts": 35,
  "apps/api/src/chat-run-mark-failed.ts": 1,
  "apps/api/src/chat-run-worker.ts": 1,
  "apps/api/src/document-ingest-run-mark-failed.ts": 1,
  "apps/api/src/document-ingest-run-worker.ts": 1,
  "apps/api/src/folder-move-routes.test.ts": 1,
  "apps/api/src/folder-share-routes.test.ts": 1,
  "apps/api/src/rag/memorag-service.test.ts": 2,
  "apps/api/src/rag/offline/pre-retrieval/admission/source-governance-approval-service.test.ts": 1,
  "apps/api/src/rag/tenant-artifact-partition.test.ts": 1,
  "apps/api/src/routes/benchmark-tenant-boundary.test.ts": 1,
  "apps/api/src/routes/resource-group-routes.test.ts": 1,
  "apps/api/src/search/hybrid-search.test.ts": 6,
  "apps/api/src/security/account-lifecycle-current-identity.test.ts": 1
}

const expectedDirectDependencyReads = [
  "accountRevocationRegistry",
  "asyncAgentProviders",
  "benchmarkArtifactStore",
  "benchmarkRunStore",
  "chatRunEventStore",
  "chatRunStore",
  "codeBuildLogReader",
  "conversationHistoryStore",
  "documentGroupStore",
  "documentIngestRunEventStore",
  "documentIngestRunStore",
  "evidenceVectorStore",
  "favoriteStore",
  "groupMembershipStore",
  "localTestIngestAdmissionContext",
  "memoryVectorStore",
  "objectStore",
  "resourceUserPrincipalDirectory",
  "securityAuditOutbox",
  "textModel",
  "usageAccountingMode",
  "usageEventStore",
  "usagePricingCatalog",
  "userDirectory",
  "userGroupStore",
  "verifiedIdentityProvider"
]

const expectedBroadDependencyPasses = {
  constructors: {
    AdministrativePrincipalTransferService: 4,
    DocumentLifecycleMutationCoordinator: 2,
    DocumentPermissionService: 7,
    FolderLifecycleMutationCoordinator: 1,
    FolderPermissionService: 7,
    StagedPublicationCoordinator: 8
  },
  calls: {
    deleteUncommittedIngestArtifacts: 1,
    embedWithCache: 2,
    isManifestCurrentPublication: 2,
    loadChunksForManifest: 1,
    loadStructuredBlocksForManifest: 1,
    localTestActor: 3,
    putDocumentVectorRecords: 1,
    readTenantManifest: 1,
    readTenantManifestByKey: 3,
    registerUncommittedIngestCleanupReconciliation: 1,
    searchRag: 1,
    tenantManifestPrefix: 2,
    tenantVectorKey: 2
  }
}

const expectedAwsImports = [
  "@aws-sdk/client-s3",
  "@aws-sdk/client-sfn",
  "@aws-sdk/s3-request-presigner"
]

const expectedPolicyImports = [
  "../authorization.js",
  "../chat-orchestration/runtime-policy.js",
  "../documents/document-lifecycle-mutation-coordinator.js",
  "../documents/document-permission-service.js",
  "../folders/folder-lifecycle-mutation-coordinator.js",
  "../folders/folder-permission-service.js",
  "../security/account-revocation-registry.js",
  "../security/administrative-principal-transfer-service.js",
  "../security/application-role-mutation-service.js",
  "../security/current-worker-authorization.js",
  "../security/production-resource-operation-authorizer.js",
  "../security/resource-group-membership-cleanup-repair-store.js",
  "../security/resource-group-membership-service.js",
  "../security/security-mutation-audit-outbox.js",
  "../security/security-resource-reference.js",
  "../security/tenant-partition.js",
  "./_shared/policies/quality-policy.js",
  "./_shared/publication/reindex-publication-compensation-repair.js",
  "./_shared/publication/staged-publication-coordinator.js",
  "./_shared/security/derived-record-security.js",
  "./_shared/security/revocation-cleanup-coordinator.js",
  "./_shared/security/revocation-cleanup-repair-outbox.js",
  "./_shared/security/trace-sanitizer.js",
  "./offline/pre-retrieval/admission/source-governance-approval-service.js"
]

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
const apiSourceRoot = path.join(projectRoot, "apps/api/src")
const servicePath = path.join(apiSourceRoot, "rag/memorag-service.ts")
const dependenciesPath = path.join(apiSourceRoot, "dependencies.ts")

test("MemoRagService public method names and compiler-resolved signatures match the Phase 4a snapshot", () => {
  assert.equal(publicMethodTypeContract, true)
  const actual = compilerResolvedPublicContract()
  const snapshot = JSON.parse(readFileSync(path.join(apiSourceRoot, "rag/__snapshots__/memorag-service-public-contract.snapshot.json"), "utf8"))
  assert.deepEqual(actual.map((signature) => signature.slice(0, signature.indexOf("("))), [...expectedPublicMethodNames])
  assert.deepEqual(actual, snapshot)
})

test("route, worker, and oRPC method consumers stay inside the source-backed Pick graph", () => {
  assert.deepEqual(scanProductionConsumerMethods(), expectedConsumerMethods)
  assert.deepEqual(scanExplicitPickConsumers(), {
    "apps/api/src/benchmark-run-authorization-worker.ts": ["reauthorizeBenchmarkRunExecution"]
  })
})

test("all MemoRagService constructor sites remain explicit and reviewable", () => {
  assert.deepEqual(scanConstructorSites(), expectedConstructorSites)
})

test("the remaining broad private Dependencies field and its direct reads stay source-characterized during extraction", () => {
  assert.equal(dependencyTypeContract, true)
  assert.deepEqual(scanDependencyKeys(), [...expectedDependencyKeys])
  assert.deepEqual(scanDirectDependencyReads(), expectedDirectDependencyReads)
  assert.deepEqual(scanBroadDependencyPasses(), expectedBroadDependencyPasses)
  assert.deepEqual(scanImports((moduleName) => moduleName.startsWith("@aws-sdk/")), expectedAwsImports)
  assert.deepEqual(
    scanImports((moduleName) => /authorization|security|permission|lifecycle|publication|quality-policy|source-governance|runtime-policy|audit/.test(moduleName)),
    expectedPolicyImports
  )
  assertPrivateDependencyField()
})

function compilerResolvedPublicContract(): string[] {
  const configPath = path.join(projectRoot, "apps/api/tsconfig.json")
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"))
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath), {}, configPath)
  const program = ts.createProgram(parsed.fileNames, parsed.options)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.deepEqual(diagnostics.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")), [])
  const checker = program.getTypeChecker()
  const source = program.getSourceFile(servicePath)
  assert.ok(source)
  const declaration = source.statements.find((node): node is ts.ClassDeclaration => (
    ts.isClassDeclaration(node) && node.name?.text === "MemoRagService"
  ))
  assert.ok(declaration)
  const flags = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope
  return checker.getPropertiesOfType(checker.getTypeAtLocation(declaration))
    .flatMap((symbol) => {
      const valueDeclaration = symbol.valueDeclaration
      if (!valueDeclaration || !ts.isMethodDeclaration(valueDeclaration)) return []
      const modifiers = ts.getCombinedModifierFlags(valueDeclaration)
      if ((modifiers & ts.ModifierFlags.Private) !== 0 || (modifiers & ts.ModifierFlags.Protected) !== 0) return []
      const signatures = checker.getSignaturesOfType(
        checker.getTypeOfSymbolAtLocation(symbol, valueDeclaration),
        ts.SignatureKind.Call
      )
      return signatures.map((signature) => (
        `${symbol.getName()}${checker.signatureToString(signature, declaration, flags, ts.SignatureKind.Call)}`
      ))
    })
    .sort((left, right) => left.localeCompare(right))
}

function scanProductionConsumerMethods(): Record<string, string[]> {
  const relativeFiles = [
    ...readdirSync(path.join(apiSourceRoot, "routes"))
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .map((file) => `routes/${file}`),
    "orpc/router.ts",
    "benchmark-run-authorization-worker.ts",
    "chat-run-worker.ts",
    "chat-run-mark-failed.ts",
    "document-ingest-run-worker.ts",
    "document-ingest-run-mark-failed.ts"
  ].sort()
  const result: Record<string, string[]> = {}
  for (const relativeFile of relativeFiles) {
    const source = readFileSync(path.join(apiSourceRoot, relativeFile), "utf8")
    const methods = [...source.matchAll(/(?:\bservice|\bcontext\.service|\btargetService)\.([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)]
      .map((match) => match[1])
      .filter((method): method is string => Boolean(method))
    if (methods.length > 0) result[`apps/api/src/${relativeFile}`] = [...new Set(methods)].sort()
  }
  return result
}

function scanExplicitPickConsumers(): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const relativeFile of allTypeScriptFiles(apiSourceRoot)) {
    if (relativeFile.endsWith(".test.ts")) continue
    const source = readFileSync(path.join(apiSourceRoot, relativeFile), "utf8")
    const methods = [...source.matchAll(/Pick<MemoRagService,\s*"([A-Za-z_$][A-Za-z0-9_$]*)"\s*>/g)]
      .map((match) => match[1])
      .filter((method): method is string => Boolean(method))
    if (methods.length > 0) result[`apps/api/src/${relativeFile}`] = [...new Set(methods)].sort()
  }
  return result
}

function scanConstructorSites(): Record<string, number> {
  const result: Record<string, number> = {}
  for (const relativeFile of allTypeScriptFiles(apiSourceRoot)) {
    const source = readFileSync(path.join(apiSourceRoot, relativeFile), "utf8")
    const count = [...source.matchAll(/new\s+MemoRagService\s*\(/g)].length
    if (count > 0) result[`apps/api/src/${relativeFile}`] = count
  }
  return result
}

function scanDependencyKeys(): string[] {
  const source = ts.createSourceFile(dependenciesPath, readFileSync(dependenciesPath, "utf8"), ts.ScriptTarget.Latest, true)
  const declaration = source.statements.find((node): node is ts.TypeAliasDeclaration => (
    ts.isTypeAliasDeclaration(node) && node.name.text === "Dependencies"
  ))
  assert.ok(declaration && ts.isTypeLiteralNode(declaration.type))
  return declaration.type.members.flatMap((member) => (
    ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name) ? [member.name.text] : []
  )).sort()
}

function scanDirectDependencyReads(): string[] {
  const source = readFileSync(servicePath, "utf8")
  return [...new Set(
    [...source.matchAll(/this\.deps\.([A-Za-z_$][A-Za-z0-9_$]*)/g)]
      .map((match) => match[1])
      .filter((dependency): dependency is string => Boolean(dependency))
  )].sort()
}

function scanBroadDependencyPasses(): typeof expectedBroadDependencyPasses {
  const source = ts.createSourceFile(servicePath, readFileSync(servicePath, "utf8"), ts.ScriptTarget.Latest, true)
  const constructors: Record<string, number> = {}
  const calls: Record<string, number> = {}
  const isPrivateDependency = (node: ts.Node): boolean => (
    ts.isPropertyAccessExpression(node)
      && node.expression.kind === ts.SyntaxKind.ThisKeyword
      && node.name.text === "deps"
  )
  const visit = (node: ts.Node): void => {
    if (ts.isNewExpression(node) && node.arguments?.some(isPrivateDependency)) {
      const name = node.expression.getText(source)
      constructors[name] = (constructors[name] ?? 0) + 1
    }
    if (ts.isCallExpression(node) && !ts.isPropertyAccessExpression(node.expression) && node.arguments.some(isPrivateDependency)) {
      const name = node.expression.getText(source)
      calls[name] = (calls[name] ?? 0) + 1
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return {
    constructors: Object.fromEntries(Object.entries(constructors).sort(([left], [right]) => left.localeCompare(right))),
    calls: Object.fromEntries(Object.entries(calls).sort(([left], [right]) => left.localeCompare(right)))
  } as typeof expectedBroadDependencyPasses
}

function scanImports(include: (moduleName: string) => boolean): string[] {
  const source = ts.createSourceFile(servicePath, readFileSync(servicePath, "utf8"), ts.ScriptTarget.Latest, true)
  return source.statements
    .filter(ts.isImportDeclaration)
    .map((declaration) => declaration.moduleSpecifier)
    .filter(ts.isStringLiteral)
    .map((moduleSpecifier) => moduleSpecifier.text)
    .filter(include)
    .sort()
}

function assertPrivateDependencyField(): void {
  const source = ts.createSourceFile(servicePath, readFileSync(servicePath, "utf8"), ts.ScriptTarget.Latest, true)
  const declaration = source.statements.find((node): node is ts.ClassDeclaration => (
    ts.isClassDeclaration(node) && node.name?.text === "MemoRagService"
  ))
  assert.ok(declaration)
  const constructors = declaration.members.filter(ts.isConstructorDeclaration)
  assert.equal(constructors.length, 1)
  assert.equal(constructors[0]?.parameters.length, 1)
  const parameter = constructors[0]?.parameters[0]
  assert.ok(parameter && ts.isIdentifier(parameter.name) && parameter.name.text === "deps")
  assert.equal(parameter.type?.getText(source), "Dependencies")
  const modifiers = ts.getCombinedModifierFlags(parameter)
  assert.ok((modifiers & ts.ModifierFlags.Private) !== 0)
  assert.ok((modifiers & ts.ModifierFlags.Readonly) !== 0)
}

function allTypeScriptFiles(root: string, prefix = ""): string[] {
  return readdirSync(path.join(root, prefix), { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = path.join(prefix, entry.name)
      if (entry.isDirectory()) return allTypeScriptFiles(root, relativePath)
      return entry.isFile() && entry.name.endsWith(".ts") ? [relativePath] : []
    })
    .sort()
}
