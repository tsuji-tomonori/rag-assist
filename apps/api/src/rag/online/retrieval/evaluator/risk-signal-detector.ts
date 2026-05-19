export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/retrieval/evaluator/risk-signal-detector",
  runtime: "online",
  stage: "retrieval",
  area: "evaluator",
  status: "planned"
} satisfies RagComponentDescriptor
