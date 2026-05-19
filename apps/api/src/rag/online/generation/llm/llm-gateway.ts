export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/generation/llm/llm-gateway",
  runtime: "online",
  stage: "generation",
  area: "llm",
  status: "planned"
} satisfies RagComponentDescriptor
