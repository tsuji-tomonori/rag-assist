export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/post-retrieval/filter/final-permission-recheck",
  runtime: "online",
  stage: "post-retrieval",
  area: "filter",
  status: "planned"
} satisfies RagComponentDescriptor
