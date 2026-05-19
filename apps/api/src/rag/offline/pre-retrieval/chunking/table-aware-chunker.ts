export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/pre-retrieval/chunking/table-aware-chunker",
  runtime: "offline",
  stage: "pre-retrieval",
  area: "chunking",
  status: "planned"
} satisfies RagComponentDescriptor
