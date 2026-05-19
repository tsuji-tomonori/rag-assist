export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/post-retrieval/offline-compression/hierarchical-summary-builder",
  runtime: "offline",
  stage: "post-retrieval",
  area: "offline-compression",
  status: "planned"
} satisfies RagComponentDescriptor
