export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/pre-retrieval/conversation/previous-citation-anchor",
  runtime: "online",
  stage: "pre-retrieval",
  area: "conversation",
  status: "planned"
} satisfies RagComponentDescriptor
