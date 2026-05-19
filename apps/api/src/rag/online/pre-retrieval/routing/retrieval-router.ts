export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/pre-retrieval/routing/retrieval-router",
  runtime: "online",
  stage: "pre-retrieval",
  area: "routing",
  status: "planned"
} satisfies RagComponentDescriptor
