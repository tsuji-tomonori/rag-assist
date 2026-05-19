export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/pre-retrieval/embedding/embedding-worker",
  runtime: "offline",
  stage: "pre-retrieval",
  area: "embedding",
  status: "planned"
} satisfies RagComponentDescriptor
