export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/pre-retrieval/query-decomposition/query-decomposer",
  runtime: "online",
  stage: "pre-retrieval",
  area: "query-decomposition",
  status: "planned"
} satisfies RagComponentDescriptor
