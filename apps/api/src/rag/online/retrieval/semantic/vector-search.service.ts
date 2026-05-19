export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/retrieval/semantic/vector-search.service",
  runtime: "online",
  stage: "retrieval",
  area: "semantic",
  status: "planned"
} satisfies RagComponentDescriptor
