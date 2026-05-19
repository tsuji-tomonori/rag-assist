export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/retrieval/index-assets/lexical-field-config",
  runtime: "offline",
  stage: "retrieval",
  area: "index-assets",
  status: "planned"
} satisfies RagComponentDescriptor
