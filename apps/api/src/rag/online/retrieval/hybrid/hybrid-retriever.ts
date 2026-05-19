export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/retrieval/hybrid/hybrid-retriever",
  runtime: "online",
  stage: "retrieval",
  area: "hybrid",
  status: "planned"
} satisfies RagComponentDescriptor
