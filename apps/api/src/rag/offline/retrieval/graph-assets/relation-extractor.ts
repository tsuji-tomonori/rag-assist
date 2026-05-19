export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/retrieval/graph-assets/relation-extractor",
  runtime: "offline",
  stage: "retrieval",
  area: "graph-assets",
  status: "planned"
} satisfies RagComponentDescriptor
