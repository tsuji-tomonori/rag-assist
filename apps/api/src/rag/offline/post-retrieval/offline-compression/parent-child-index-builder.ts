export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/post-retrieval/offline-compression/parent-child-index-builder",
  runtime: "offline",
  stage: "post-retrieval",
  area: "offline-compression",
  status: "planned"
} satisfies RagComponentDescriptor
