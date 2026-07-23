import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

test("FR-075 CI exposes an explicit promotion gate without forcing ordinary PRs to invent thresholds", async () => {
  const workflow = await readFile(path.join(repoRoot, ".github/workflows/memorag-ci.yml"), "utf-8")

  assert.match(workflow, /run-rag-promotion-gate:/)
  assert.match(workflow, /github\.event_name == 'workflow_dispatch' && inputs\.run-rag-promotion-gate/)
  assert.match(workflow, /npm run rag:promotion:check --/)
  assert.match(workflow, /--policy "\$RAG_QUALITY_POLICY_PATH"/)
  assert.match(workflow, /--observations "\$RAG_QUALITY_OBSERVATIONS_PATH"/)
  const pullRequestBlock = workflow.slice(workflow.indexOf("pull_request:"), workflow.indexOf("permissions:"))
  assert.doesNotMatch(pullRequestBlock, /required:\s+true[\s\S]*threshold/i)
})

test("SQ-015 cost-first deploy validates repository policy without scanning S3 observations", async () => {
  const workflow = await readFile(path.join(repoRoot, ".github/workflows/memorag-deploy.yml"), "utf-8")
  const prepare = workflow.indexOf("Prepare cost-priority deployment context")
  const configure = workflow.indexOf("Configure AWS credentials")
  const build = workflow.indexOf("Build deployment artifacts")
  const synth = workflow.indexOf("Synthesize CloudFormation YAML")
  const deploy = workflow.indexOf("      - name: CDK deploy")

  for (const [label, index] of Object.entries({ prepare, configure, build, synth, deploy })) {
    assert.ok(index >= 0, `${label} must exist in deploy workflow`)
  }
  assert.ok(prepare < configure)
  assert.ok(configure < build)
  assert.ok(build < synth)
  assert.ok(synth < deploy)

  assert.match(workflow, /DEPLOYMENT_MODE: cost_priority/)
  assert.match(workflow, /--policy config\/rag-quality\/dev-policy\.json/)
  assert.match(workflow, /--observations-dir artifacts\/rag-observations/)
  assert.match(workflow, /promotionGateApplied: false/)
  assert.match(workflow, /deployAllowed: true/)
  assert.match(workflow, /sourceObservationScan: false/)
  assert.match(workflow, /echo "deploy-allowed=true" >> "\$GITHUB_OUTPUT"/)
  assert.match(workflow, /memorag-cost-priority-deployment-\$\{\{ github\.run_id \}\}/)
  assert.match(workflow, /if-no-files-found: error/)

  assert.doesNotMatch(workflow, /aws s3 sync/)
  assert.doesNotMatch(workflow, /quality-control\/observations\//)
  assert.doesNotMatch(workflow, /Resolve the documents bucket/)
  assert.doesNotMatch(workflow, /aws s3 cp artifacts\/rag-promotion/)
  assert.doesNotMatch(workflow, /policy-bootstrap/)
  assert.doesNotMatch(workflow, /steps\.promotion-candidate/)

  for (const step of ["Build deployment artifacts", "Synthesize CloudFormation YAML", "      - name: CDK deploy", "Upload deployment outputs"]) {
    const start = workflow.indexOf(step)
    const blockEnd = workflow.indexOf("run:", start) >= 0 ? workflow.indexOf("run:", start) : start + 350
    const block = workflow.slice(start, blockEnd)
    assert.match(block, /steps\.deployment-context\.outputs\.deploy-allowed == 'true'/)
  }

  for (const versionContext of [
    "ragRuntimeProfileVersion",
    "ragWorkloadProfileVersion",
    "ragPriceCatalogVersion",
    "ragIndexVersion",
    "ragPromptVersion",
    "ragPipelineVersion",
    "ragParserVersion",
    "ragChunkerVersion"
  ]) {
    assert.match(workflow, new RegExp(`--context "${versionContext}=\\$RAG_`))
  }
})
