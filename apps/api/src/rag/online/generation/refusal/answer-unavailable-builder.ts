export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/generation/refusal/answer-unavailable-builder",
  runtime: "online",
  stage: "generation",
  area: "refusal",
  status: "planned"
} satisfies RagComponentDescriptor
