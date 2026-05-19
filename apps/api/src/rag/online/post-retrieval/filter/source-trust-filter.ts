export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/post-retrieval/filter/source-trust-filter",
  runtime: "online",
  stage: "post-retrieval",
  area: "filter",
  status: "planned"
} satisfies RagComponentDescriptor
