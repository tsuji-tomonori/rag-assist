export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/pre-retrieval/query-rewrite/query-rewriter",
  runtime: "online",
  stage: "pre-retrieval",
  area: "query-rewrite",
  status: "planned"
} satisfies RagComponentDescriptor
