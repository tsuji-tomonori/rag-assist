import { parseJsonObject } from "../../rag/json.js"
import { buildPolicyComputationExtractionPrompt } from "../../rag/prompts.js"
import type { Dependencies } from "../../dependencies.js"
import { PolicyComputationExtractionSchema, policyExtractionToComputedFacts } from "../policy-computation.js"
import type { QaAgentState, QaAgentUpdate } from "../state.js"

export function createExtractPolicyComputationsNode(deps: Dependencies) {
  return async function extractPolicyComputations(state: QaAgentState): Promise<QaAgentUpdate> {
    if (state.selectedChunks.length === 0) return { computedFacts: state.computedFacts }

    const raw = await deps.textModel.generate(buildPolicyComputationExtractionPrompt(state.question, state.selectedChunks), {
      modelId: state.modelId,
      temperature: 0,
      maxTokens: 1600
    })
    const parsed = PolicyComputationExtractionSchema.safeParse(parseJsonObject(raw))
    if (!parsed.success) return { computedFacts: state.computedFacts }

    const facts = policyExtractionToComputedFacts(parsed.data, state.selectedChunks, state.question)
    return {
      computedFacts: [
        ...state.computedFacts,
        ...facts
      ]
    }
  }
}
