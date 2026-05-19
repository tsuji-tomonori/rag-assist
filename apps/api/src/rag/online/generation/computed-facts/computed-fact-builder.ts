export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/generation/computed-facts/computed-fact-builder",
  runtime: "online",
  stage: "generation",
  area: "computed-facts",
  status: "planned"
} satisfies RagComponentDescriptor
