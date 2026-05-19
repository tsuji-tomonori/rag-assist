export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/post-retrieval/rerank/reranker.service",
  runtime: "online",
  stage: "post-retrieval",
  area: "rerank",
  status: "planned"
} satisfies RagComponentDescriptor
