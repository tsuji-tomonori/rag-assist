export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/generation/llm/model-registry",
  runtime: "online",
  stage: "generation",
  area: "llm",
  status: "planned"
} satisfies RagComponentDescriptor
