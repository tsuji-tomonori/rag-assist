export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/pre-retrieval/hyde/hypothetical-document-generator",
  runtime: "online",
  stage: "pre-retrieval",
  area: "hyde",
  status: "planned"
} satisfies RagComponentDescriptor
