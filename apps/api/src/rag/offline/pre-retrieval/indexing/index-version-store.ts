export const CHUNKER_VERSION = "chunk-semantic-v3"
export const SOURCE_EXTRACTOR_VERSION = "extract-upload-v2"
export const MEMORY_PROMPT_VERSION = "memory-card-v1"
export const PROMPT_VERSION = "rag-prompts-v1"
export const HYBRID_INDEX_VERSION = "hybrid-runtime-v1"
export const CHAT_ORCHESTRATION_WORKFLOW_VERSION = "qa-agent-v2"
/** @deprecated Use CHAT_ORCHESTRATION_WORKFLOW_VERSION. Kept to preserve existing debug and benchmark version comparisons. */
export const AGENT_WORKFLOW_VERSION = CHAT_ORCHESTRATION_WORKFLOW_VERSION

export type PipelineVersions = {
  chatOrchestrationWorkflowVersion: string
  /** @deprecated Use chatOrchestrationWorkflowVersion. */
  agentWorkflowVersion: string
  chunkerVersion: string
  sourceExtractorVersion: string
  memoryPromptVersion: string
  promptVersion: string
  indexVersion: string
  embeddingModelId: string
  embeddingDimensions: number
}

export function buildPipelineVersions(input: { embeddingModelId: string; embeddingDimensions: number; sourceExtractorVersion?: string }): PipelineVersions {
  return {
    chatOrchestrationWorkflowVersion: CHAT_ORCHESTRATION_WORKFLOW_VERSION,
    agentWorkflowVersion: AGENT_WORKFLOW_VERSION,
    chunkerVersion: CHUNKER_VERSION,
    sourceExtractorVersion: input.sourceExtractorVersion ?? SOURCE_EXTRACTOR_VERSION,
    memoryPromptVersion: MEMORY_PROMPT_VERSION,
    promptVersion: PROMPT_VERSION,
    indexVersion: HYBRID_INDEX_VERSION,
    embeddingModelId: input.embeddingModelId,
    embeddingDimensions: input.embeddingDimensions
  }
}
