export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/retrieval/metadata-filter/metadata-filter",
  runtime: "online",
  stage: "retrieval",
  area: "metadata-filter",
  status: "planned"
} satisfies RagComponentDescriptor
