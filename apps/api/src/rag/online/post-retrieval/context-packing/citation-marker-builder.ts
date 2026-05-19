export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/post-retrieval/context-packing/citation-marker-builder",
  runtime: "online",
  stage: "post-retrieval",
  area: "context-packing",
  status: "planned"
} satisfies RagComponentDescriptor
