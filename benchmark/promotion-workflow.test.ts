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

test("FR-075 deploy prepares versioned evidence automatically and only bootstraps incomplete evidence with exact authorization", async () => {
  const workflow = await readFile(path.join(repoRoot, ".github/workflows/memorag-deploy.yml"), "utf-8")
  const resolveBucket = workflow.indexOf("Resolve the documents bucket")
  const prepare = workflow.indexOf("Prepare and upload RAG promotion candidate")
  const gate = workflow.indexOf("Enforce RAG promotion gate before deployment")
  const build = workflow.indexOf("Build deployment artifacts")
  const synth = workflow.indexOf("Synthesize CloudFormation YAML")
  const deploy = workflow.indexOf("      - name: CDK deploy")

  for (const [label, index] of Object.entries({ resolveBucket, prepare, gate, build, synth, deploy })) {
    assert.ok(index >= 0, `${label} must exist in deploy workflow`)
  }
  assert.ok(resolveBucket < prepare)
  assert.ok(prepare < gate)
  assert.ok(gate < build)
  assert.ok(gate < synth)
  assert.ok(gate < deploy)
  assert.doesNotMatch(workflow, /rag-quality-(?:policy|observations)-s3-uri:/)
  assert.doesNotMatch(workflow, /vars\.RAG_QUALITY_(?:POLICY|OBSERVATIONS)_S3_URI/)
  assert.match(workflow, /OutputKey=='DocumentsBucketName'/)
  assert.match(workflow, /quality-control\/policies\/active\.json/)
  assert.match(workflow, /quality-control\/promotion-candidates\/\$POLICY_VERSION\/\$GITHUB_SHA\/\$GITHUB_RUN_ID/)
  assert.match(workflow, /RAG_QUALITY_POLICY_S3_URI=.*>> "\$GITHUB_ENV"/)
  assert.match(workflow, /RAG_QUALITY_OBSERVATIONS_S3_URI=.*>> "\$GITHUB_ENV"/)
  assert.match(workflow, /required evidence is incomplete; deploy is deferred without synthesizing values/)
  assert.match(workflow, /policy-bootstrap:/)
  assert.match(workflow, /policy-bootstrap-authorization:/)
  assert.match(workflow, /EXPECTED_BOOTSTRAP_AUTHORIZATION="\$GITHUB_SHA:\$POLICY_ID@\$POLICY_VERSION"/)
  assert.match(workflow, /POLICY_BOOTSTRAP_APPROVED_IDENTITY: memorag-dev-rag-quality@2026-07-16\.draft-1/)
  assert.match(workflow, /"\$POLICY_ID@\$POLICY_VERSION" != "\$POLICY_BOOTSTRAP_APPROVED_IDENTITY"/)
  assert.match(workflow, /"\$GITHUB_EVENT_NAME" != "workflow_dispatch"/)
  assert.match(workflow, /"\$DEPLOYMENT_ENVIRONMENT" != "dev"/)
  assert.match(workflow, /"\$POLICY_BOOTSTRAP_AUTHORIZATION" != "\$EXPECTED_BOOTSTRAP_AUTHORIZATION"/)
  assert.match(workflow, /quality-control\/bootstrap-authorizations\/\$POLICY_ID\/\$POLICY_VERSION\.json/)
  assert.match(workflow, /aws s3api head-object --bucket "\$DOCUMENTS_BUCKET_NAME" --key "\$RAG_POLICY_BOOTSTRAP_MARKER_KEY"/)
  assert.match(workflow, /Record completed RAG policy bootstrap/)
  assert.match(workflow, /steps\.promotion-candidate\.outputs\.bootstrap-authorized == 'true'/)
  assert.match(workflow, /aws s3 cp artifacts\/rag-bootstrap\/bootstrap-completion\.json "\$RAG_POLICY_BOOTSTRAP_MARKER_S3_URI"/)
  assert.match(workflow, /echo "deploy-allowed=\$DEPLOY_ALLOWED" >> "\$GITHUB_OUTPUT"/)
  const gateBlock = workflow.slice(gate, workflow.indexOf("Build deployment artifacts"))
  assert.match(gateBlock, /if: \$\{\{ steps\.promotion-candidate\.outputs\.ready == 'true' \}\}/)
  assert.match(gateBlock, /npm run rag:promotion:check/)
  assert.doesNotMatch(gateBlock, /continue-on-error:\s*true/)
  const pushBlock = workflow.slice(workflow.indexOf("push:"), workflow.indexOf("workflow_dispatch:"))
  assert.doesNotMatch(pushBlock, /policy-bootstrap/)
  for (const step of ["Build deployment artifacts", "Synthesize CloudFormation YAML", "      - name: CDK deploy", "Upload deployment outputs"]) {
    const start = workflow.indexOf(step)
    const block = workflow.slice(start, workflow.indexOf("run:", start) >= 0 ? workflow.indexOf("run:", start) : start + 300)
    assert.match(block, /steps\.promotion-candidate\.outputs\.deploy-allowed == 'true'/)
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
