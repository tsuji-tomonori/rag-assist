export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/generation/citation/citation-builder",
  runtime: "online",
  stage: "generation",
  area: "citation",
  status: "planned"
} satisfies RagComponentDescriptor
