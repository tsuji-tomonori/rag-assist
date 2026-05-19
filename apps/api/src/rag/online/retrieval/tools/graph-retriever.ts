export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/retrieval/tools/graph-retriever",
  runtime: "online",
  stage: "retrieval",
  area: "tools",
  status: "planned"
} satisfies RagComponentDescriptor
