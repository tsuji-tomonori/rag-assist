export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/pre-retrieval/extraction/figure-extractor",
  runtime: "offline",
  stage: "pre-retrieval",
  area: "extraction",
  status: "planned"
} satisfies RagComponentDescriptor
