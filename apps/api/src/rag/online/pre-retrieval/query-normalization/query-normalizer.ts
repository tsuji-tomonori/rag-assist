export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/pre-retrieval/query-normalization/query-normalizer",
  runtime: "online",
  stage: "pre-retrieval",
  area: "query-normalization",
  status: "planned"
} satisfies RagComponentDescriptor
