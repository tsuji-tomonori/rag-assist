import assert from "node:assert/strict"
import test from "node:test"
import { buildReplayVersionManifest } from "./_shared/replay/replay-version-manifest.js"

const pipeline = {
  chatOrchestrationWorkflowVersion: "workflow-v2",
  agentWorkflowVersion: "workflow-v2",
  chunkerVersion: "chunk-policy-v3",
  sourceExtractorVersion: "textract-json-v1",
  memoryPromptVersion: "memory-v1",
  promptVersion: "prompt-v7",
  indexVersion: "index-v11",
  embeddingModelId: "embed-v4",
  embeddingDimensions: 1024
}

test("FR-074 replay manifest records the observed version set and deterministic source snapshot", () => {
  const manifest = buildReplayVersionManifest({
    citations: [
      { documentId: "doc-b", documentVersion: "b3", fileName: "b", score: 0.7, text: "" },
      { documentId: "doc-a", documentVersion: "a2", fileName: "a", score: 0.8, text: "" }
    ],
    pipelineVersions: pipeline,
    observedVersions: {
      ocrVersion: "textract-json-v1",
      chunkingPolicyVersion: "chunk-policy-v3"
    },
    ragProfile: { id: "rag", version: "rag-v2", retrievalProfileId: "ret", retrievalProfileVersion: "ret-v3", answerPolicyId: "answer", answerPolicyVersion: "answer-v5" },
    modelId: "answer-model-v9",
    clueModelId: "clue-model-v2",
    policyVersions: { authorization: "auth-v4", eligibility: "eligible-v3", untrustedContent: "untrusted-v2", traceSanitization: "trace-v1" },
    question: "what is current?",
    normalizedQuery: "current",
    expandedQueries: ["current policy"],
    candidateCount: 5,
    deniedCandidateCount: 3,
    finalEvidenceCount: 2,
    responseStatus: "success",
    decisionCode: "completed",
    totalLatencyMs: 90,
    nondeterministicFactors: ["model-provider-sampling", "model-provider-sampling"]
  })

  assert.deepEqual(manifest.sourceSnapshots.map((item) => item.documentId), ["doc-a", "doc-b"])
  assert.match(manifest.datasetVersion ?? "", /^source-set-sha256:[a-f0-9]{64}$/)
  assert.equal(manifest.parserVersion, "textract-json-v1")
  assert.equal(manifest.ocrVersion, "textract-json-v1")
  assert.deepEqual(manifest.nondeterministicFactors, ["model-provider-sampling"])
  assert.deepEqual(manifest.decisions, {
    candidateCount: 5,
    deniedCandidateCount: 3,
    finalEvidenceCount: 2,
    responseStatus: "success",
    decisionCode: "completed",
    reasonCodes: [],
    totalLatencyMs: 90
  })
  assert.deepEqual(manifest.missingVersions, [])
})

test("FR-074 missing historical versions remain null and are never replaced by current defaults", () => {
  const manifest = buildReplayVersionManifest({
    citations: [{ documentId: "legacy", fileName: "legacy", score: 0.5, text: "" }],
    policyVersions: {},
    question: "legacy",
    candidateCount: 1,
    finalEvidenceCount: 0,
    responseStatus: "warning",
    totalLatencyMs: 1,
    nondeterministicFactors: []
  })
  assert.equal(manifest.parserVersion, null)
  assert.equal(manifest.ocrVersion, null)
  assert.equal(manifest.chunkingPolicyVersion, null)
  assert.equal(manifest.datasetVersion, null)
  assert.ok(manifest.missingVersions.includes("parserVersion"))
  assert.ok(manifest.missingVersions.includes("sourceSnapshots"))
  assert.ok(manifest.missingVersions.includes("modelVersions.answer"))
  assert.doesNotMatch(JSON.stringify(manifest), /not-applicable|current-default|unknown-version/)
  assert.equal(manifest.decisions.decisionCode, "refused")
})

test("FR-074 retrieved source snapshots propagate observed versions and preserve disagreements as missing", () => {
  const snapshot = (documentId: string, parserVersion: string) => ({
    documentId,
    documentVersion: `${documentId}-v1`,
    ingestTraceId: `ingest:${documentId}`,
    parserVersion,
    ocrVersion: null,
    chunkerVersion: "chunker-observed-v4",
    chunkingPolicyVersion: "chunk-policy-observed-v7",
    embeddingModelId: "embedding-observed-v2",
    embeddingDimensions: 768,
    indexVersion: "index-observed-v5",
    promptVersion: "prompt-observed-v3",
    pipelineVersion: "pipeline-observed-v6"
  })
  const manifest = buildReplayVersionManifest({
    citations: [
      { documentId: "doc-a", documentVersion: "doc-a-v1", fileName: "a", score: 1, text: "" },
      { documentId: "doc-b", documentVersion: "doc-b-v1", fileName: "b", score: 1, text: "" }
    ],
    sourceSnapshots: [snapshot("doc-a", "parser-v1"), snapshot("doc-b", "parser-v2")],
    policyVersions: {},
    question: "observed",
    candidateCount: 2,
    finalEvidenceCount: 2,
    responseStatus: "success",
    totalLatencyMs: 1,
    nondeterministicFactors: []
  })

  assert.deepEqual(manifest.sourceSnapshots.map((source) => source.ingestTraceId), ["ingest:doc-a", "ingest:doc-b"])
  assert.equal(manifest.parserVersion, null, "conflicting observed versions must not be collapsed into a synthetic value")
  assert.equal(manifest.chunkingPolicyVersion, "chunk-policy-observed-v7")
  assert.equal(manifest.embedding.modelId, "embedding-observed-v2")
  assert.equal(manifest.promptVersion, "prompt-observed-v3")
  assert.equal(manifest.pipelineVersion, "pipeline-observed-v6")
  assert.ok(manifest.missingVersions.includes("parserVersion"))
  assert.ok(manifest.missingVersions.includes("ocrVersion"))
})
