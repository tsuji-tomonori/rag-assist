#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../../..");

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      throw new ValidationError(`unexpected argument: ${arg}`);
    }
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args.set(arg.slice(2), "true");
      continue;
    }
    args.set(arg.slice(2), next);
    i += 1;
  }
  return args;
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new ValidationError(`${relative(repoRoot, filePath)} is not valid JSON: ${error.message}`);
  }
}

function readJsonl(filePath) {
  const lines = readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new ValidationError(`${relative(repoRoot, filePath)}:${index + 1} is not valid JSON: ${error.message}`);
    }
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new ValidationError(message);
  }
}

function resolveSuitePath(suiteDir, pathValue) {
  assert(typeof pathValue === "string" && pathValue.length > 0, "path value must be a non-empty string");
  const interpolated = pathValue.replace(/\$\{[A-Z0-9_]+\}/gu, "__var__");
  if (isAbsolute(interpolated)) {
    return interpolated;
  }
  return resolve(suiteDir, interpolated);
}

function assertExistingRelativeFile(suiteDir, pathValue, label) {
  assert(!isAbsolute(pathValue), `${label} must be suite directory relative: ${pathValue}`);
  const filePath = resolveSuitePath(suiteDir, pathValue);
  assert(existsSync(filePath), `${label} does not exist: ${relative(repoRoot, filePath)}`);
  assert(statSync(filePath).isFile(), `${label} is not a file: ${relative(repoRoot, filePath)}`);
}

function validateSchemaShape(suite, corpus, runSpec, cases) {
  assert(suite.schemaVersion === "benchmark.suite.v1", "suite.json.schemaVersion must be benchmark.suite.v1");
  assert(corpus.schemaVersion === "benchmark.corpus.v1", "corpus.json.schemaVersion must be benchmark.corpus.v1");
  assert(runSpec.schemaVersion === "benchmark.run.v1", "benchmark.run.json.schemaVersion must be benchmark.run.v1");
  assert(typeof suite.suiteId === "string" && suite.suiteId.length > 0, "suite.json.suiteId is required");
  assert(typeof suite.useCase === "string" && suite.useCase.length > 0, "suite.json.useCase is required");
  assert(Array.isArray(corpus.documents) && corpus.documents.length > 0, "corpus.json.documents must not be empty");
  assert(corpus.benchmarkScope?.scopeType === "benchmark", "corpus.json.benchmarkScope.scopeType must be benchmark");
  assert(Array.isArray(runSpec.pipeline?.stages) && runSpec.pipeline.stages.length > 0, "benchmark.run.json.pipeline.stages is required");
  assert(typeof runSpec.output?.artifactDir === "string", "benchmark.run.json.output.artifactDir is required");
  assert(cases.length > 0, "cases.jsonl must contain at least one case");
}

function validateSuiteIds(suite, corpus, runSpec, cases) {
  const suiteId = suite.suiteId;
  assert(corpus.suiteId === suiteId, `corpus.json.suiteId must match suite.json.suiteId (${suiteId})`);
  assert(runSpec.suiteId === suiteId, `benchmark.run.json.suiteId must match suite.json.suiteId (${suiteId})`);
  for (const benchmarkCase of cases) {
    if (benchmarkCase.suiteId !== undefined) {
      assert(benchmarkCase.suiteId === suiteId, `case ${benchmarkCase.caseId} suiteId must match ${suiteId}`);
    }
    assert(benchmarkCase.useCase === suite.useCase, `case ${benchmarkCase.caseId} useCase must match ${suite.useCase}`);
  }
}

function validateCases(corpus, cases) {
  const documentKeys = new Set(corpus.documents.map((document) => document.documentKey));
  const caseIds = new Set();
  for (const benchmarkCase of cases) {
    assert(typeof benchmarkCase.caseId === "string" && benchmarkCase.caseId.length > 0, "caseId is required");
    assert(!caseIds.has(benchmarkCase.caseId), `duplicate caseId: ${benchmarkCase.caseId}`);
    caseIds.add(benchmarkCase.caseId);
    assert(typeof benchmarkCase.question === "string" && benchmarkCase.question.length > 0, `case ${benchmarkCase.caseId} question is required`);
    assert(typeof benchmarkCase.answerUnavailableExpected === "boolean", `case ${benchmarkCase.caseId} answerUnavailableExpected is required`);
    assert(Array.isArray(benchmarkCase.judge) && benchmarkCase.judge.length > 0, `case ${benchmarkCase.caseId} judge is required`);
    assert(Array.isArray(benchmarkCase.tags), `case ${benchmarkCase.caseId} tags is required`);

    const expectedDocumentKeys = benchmarkCase.expectedDocumentKeys ?? [];
    assert(Array.isArray(expectedDocumentKeys), `case ${benchmarkCase.caseId} expectedDocumentKeys must be an array`);
    for (const key of expectedDocumentKeys) {
      assert(documentKeys.has(key), `case ${benchmarkCase.caseId} expectedDocumentKey is not in corpus.json: ${key}`);
    }

    if (benchmarkCase.answerUnavailableExpected === false) {
      const hasAnswer = typeof benchmarkCase.expectedAnswer === "string" && benchmarkCase.expectedAnswer.length > 0;
      assert(hasAnswer || expectedDocumentKeys.length > 0, `case ${benchmarkCase.caseId} requires expectedAnswer or expectedDocumentKeys`);
    }

    if (benchmarkCase.useCase === "multiturn_chat") {
      assert(Array.isArray(benchmarkCase.turns) || typeof benchmarkCase.previousContextFixturePath === "string", `case ${benchmarkCase.caseId} multiturn_chat requires turns or previousContextFixturePath`);
    }

    if (Array.isArray(benchmarkCase.expectedPages) && benchmarkCase.expectedPages.length > 0) {
      assert(benchmarkCase.judge.includes("citation_page_match"), `case ${benchmarkCase.caseId} expectedPages requires citation_page_match judge`);
    }
  }
}

function validateRunSpec(suiteDir, runSpec, corpus) {
  assertExistingRelativeFile(suiteDir, runSpec.casesPath, "benchmark.run.json.casesPath");
  for (const key of ["targetConfigPath", "answerPolicyPath", "promotionGatePath", "permissionFixturePath"]) {
    if (runSpec[key] !== undefined) {
      assertExistingRelativeFile(suiteDir, runSpec[key], `benchmark.run.json.${key}`);
    }
  }

  const targetConfig = runSpec.targetConfigPath ? readJson(resolveSuitePath(suiteDir, runSpec.targetConfigPath)) : runSpec.targetConfig;
  const answerPolicy = runSpec.answerPolicyPath ? readJson(resolveSuitePath(suiteDir, runSpec.answerPolicyPath)) : runSpec.answerPolicy;
  const promotionGate = runSpec.promotionGatePath ? readJson(resolveSuitePath(suiteDir, runSpec.promotionGatePath)) : runSpec.promotionGate;

  assert(targetConfig, "benchmark.run.json requires targetConfig or targetConfigPath");
  assert(answerPolicy, "benchmark.run.json requires answerPolicy or answerPolicyPath");
  assert(promotionGate, "benchmark.run.json requires promotionGate or promotionGatePath");
  assert(typeof targetConfig.indexVersion === "string" && targetConfig.indexVersion.length > 0, "targetConfig.indexVersion is required");

  if (answerPolicy.answerStyle === "benchmark_grounded_short") {
    assert(answerPolicy.forbidExternalKnowledge === true, "benchmark_grounded_short requires forbidExternalKnowledge=true");
    assert(answerPolicy.forbidConversationHistoryOnlyAnswer === true, "benchmark_grounded_short requires forbidConversationHistoryOnlyAnswer=true");
    assert(answerPolicy.forbidDatasetRowIdBranching === true, "benchmark_grounded_short requires forbidDatasetRowIdBranching=true");
  }

  const forbiddenBranchKeys = ["caseIdBranching", "datasetRowIdBranching", "fileNameBranching"];
  for (const key of forbiddenBranchKeys) {
    assert(runSpec[key] === undefined && targetConfig[key] === undefined && answerPolicy[key] === undefined, `${key} is forbidden in benchmark runtime config`);
  }

  assert(runSpec.output.artifactDir.startsWith("${ARTIFACT_DIR}") || runSpec.output.artifactDir.startsWith("./artifacts/benchmarks/") || runSpec.output.artifactDir.startsWith("artifacts/benchmarks/"), "output.artifactDir must point to artifacts/benchmarks");
  assert(corpus.benchmarkScope.scopeType === "benchmark", "benchmark corpus must use benchmark scope");
}

function validateInitDelegation(suiteDir) {
  const initPath = resolve(suiteDir, "init.sh");
  const initBody = readFileSync(initPath, "utf8");
  assert(initBody.includes("benchmarks/_shared/scripts/init-suite.sh"), "init.sh must delegate to benchmarks/_shared/scripts/init-suite.sh");
  assert(initBody.includes("--suite-dir"), "init.sh must pass --suite-dir to the shared init script");
}

function validateSecretHygiene(files) {
  const suspiciousAssignment = /(?:secret|token|password)\s*[:=]\s*["']?(?!\$\{|<|REDACTED|__|""|''|null\b|true\b|false\b)[A-Za-z0-9_./+=:@-]{12,}/iu;
  for (const filePath of files) {
    const body = readFileSync(filePath, "utf8");
    assert(!suspiciousAssignment.test(body), `possible secret value found in ${relative(repoRoot, filePath)}`);
  }
}

function validateArtifactIgnore() {
  const ignorePath = resolve(repoRoot, "artifacts/benchmarks/.gitignore");
  assert(existsSync(ignorePath), "artifacts/benchmarks/.gitignore is required");
  const body = readFileSync(ignorePath, "utf8");
  assert(body.includes("*") && body.includes("!.gitignore"), "artifacts/benchmarks/.gitignore must ignore generated artifacts");
}

export function validateSuite(suiteDirInput) {
  const suiteDir = resolve(suiteDirInput);
  const requiredFiles = ["init.sh", "suite.json", "corpus.json", "cases.jsonl", "benchmark.run.json"];
  for (const fileName of requiredFiles) {
    const filePath = resolve(suiteDir, fileName);
    assert(existsSync(filePath), `missing required suite file: ${relative(repoRoot, filePath)}`);
  }

  const suite = readJson(resolve(suiteDir, "suite.json"));
  const corpus = readJson(resolve(suiteDir, "corpus.json"));
  const runSpec = readJson(resolve(suiteDir, "benchmark.run.json"));
  const cases = readJsonl(resolve(suiteDir, "cases.jsonl"));

  validateSchemaShape(suite, corpus, runSpec, cases);
  validateSuiteIds(suite, corpus, runSpec, cases);
  validateInitDelegation(suiteDir);
  for (const document of corpus.documents) {
    assertExistingRelativeFile(suiteDir, document.filePath, `corpus document ${document.documentKey} filePath`);
  }
  validateCases(corpus, cases);
  validateRunSpec(suiteDir, runSpec, corpus);
  validateArtifactIgnore();
  validateSecretHygiene(requiredFiles.map((fileName) => resolve(suiteDir, fileName)));

  return {
    suiteId: suite.suiteId,
    useCase: suite.useCase,
    caseCount: cases.length,
    documentCount: corpus.documents.length,
  };
}

if (process.argv[1] === __filename) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const suiteDir = args.get("suite-dir");
    assert(suiteDir, "--suite-dir is required");
    const result = validateSuite(suiteDir);
    process.stdout.write(`${JSON.stringify({ status: "passed", ...result }, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`validate-suite failed: ${message}\n`);
    process.exitCode = 1;
  }
}
