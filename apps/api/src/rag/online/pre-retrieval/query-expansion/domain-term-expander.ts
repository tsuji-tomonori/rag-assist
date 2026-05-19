export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/pre-retrieval/query-expansion/domain-term-expander",
  runtime: "online",
  stage: "pre-retrieval",
  area: "query-expansion",
  status: "planned"
} satisfies RagComponentDescriptor
