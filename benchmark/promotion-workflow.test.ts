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

test("FR-075 deploy fails closed on missing evidence and enforces promotion before build, synth, or deploy", async () => {
  const workflow = await readFile(path.join(repoRoot, ".github/workflows/memorag-deploy.yml"), "utf-8")
  const requiredPolicy = workflow.indexOf("RAG_QUALITY_POLICY_S3_URI is required")
  const requiredObservations = workflow.indexOf("RAG_QUALITY_OBSERVATIONS_S3_URI is required")
  const gate = workflow.indexOf("Enforce RAG promotion gate before deployment")
  const build = workflow.indexOf("Build deployment artifacts")
  const synth = workflow.indexOf("Synthesize CloudFormation YAML")
  const deploy = workflow.indexOf("      - name: CDK deploy")

  for (const [label, index] of Object.entries({ requiredPolicy, requiredObservations, gate, build, synth, deploy })) {
    assert.ok(index >= 0, `${label} must exist in deploy workflow`)
  }
  assert.ok(requiredPolicy < gate)
  assert.ok(requiredObservations < gate)
  assert.ok(gate < build)
  assert.ok(gate < synth)
  assert.ok(gate < deploy)
  const gateBlock = workflow.slice(gate, workflow.indexOf("Build deployment artifacts"))
  assert.match(gateBlock, /npm run rag:promotion:check/)
  assert.doesNotMatch(gateBlock, /continue-on-error:\s*true/)
})
