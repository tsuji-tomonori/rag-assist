export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/retrieval/lexical/bm25-retriever",
  runtime: "online",
  stage: "retrieval",
  area: "lexical",
  status: "planned"
} satisfies RagComponentDescriptor
