export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/post-retrieval/quality-gates/extraction-quality-gate",
  runtime: "offline",
  stage: "post-retrieval",
  area: "quality-gates",
  status: "planned"
} satisfies RagComponentDescriptor
