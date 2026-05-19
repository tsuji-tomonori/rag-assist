export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/post-retrieval/corpus-dedup/document-deduplicator",
  runtime: "offline",
  stage: "post-retrieval",
  area: "corpus-dedup",
  status: "planned"
} satisfies RagComponentDescriptor
