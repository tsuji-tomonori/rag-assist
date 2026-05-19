export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/retrieval/offline-query-assets/domain-term-dictionary-builder",
  runtime: "offline",
  stage: "retrieval",
  area: "offline-query-assets",
  status: "planned"
} satisfies RagComponentDescriptor
