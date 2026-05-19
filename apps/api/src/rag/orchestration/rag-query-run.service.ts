export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "orchestration/rag-query-run.service",
  runtime: "shared",
  stage: "orchestration",
  area: "orchestration",
  status: "planned"
} satisfies RagComponentDescriptor
