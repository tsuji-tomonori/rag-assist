export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "_shared/tracing/rag-run-trace",
  runtime: "shared",
  stage: "_shared",
  area: "tracing",
  status: "planned"
} satisfies RagComponentDescriptor
