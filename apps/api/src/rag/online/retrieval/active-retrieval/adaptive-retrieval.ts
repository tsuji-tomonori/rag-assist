export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/retrieval/active-retrieval/adaptive-retrieval",
  runtime: "online",
  stage: "retrieval",
  area: "active-retrieval",
  status: "planned"
} satisfies RagComponentDescriptor
