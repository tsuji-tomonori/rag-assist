export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/post-retrieval/dedup/evidence-deduplicator",
  runtime: "online",
  stage: "post-retrieval",
  area: "dedup",
  status: "planned"
} satisfies RagComponentDescriptor
