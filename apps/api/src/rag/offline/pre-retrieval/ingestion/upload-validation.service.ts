export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/pre-retrieval/ingestion/upload-validation.service",
  runtime: "offline",
  stage: "pre-retrieval",
  area: "ingestion",
  status: "planned"
} satisfies RagComponentDescriptor
