export const CHUNKER_VERSION = "chunk-structured-v2"
export const SOURCE_EXTRACTOR_VERSION = "extract-upload-v2"
export const MEMORY_PROMPT_VERSION = "memory-card-v1"
export const PROMPT_VERSION = "rag-prompts-v1"
export const HYBRID_INDEX_VERSION = "hybrid-runtime-v1"
export const AGENT_WORKFLOW_VERSION = "qa-agent-v2"

export type PipelineVersions = {
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
