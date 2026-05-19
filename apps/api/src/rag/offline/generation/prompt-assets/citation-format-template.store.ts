export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/generation/prompt-assets/citation-format-template.store",
  runtime: "offline",
  stage: "generation",
  area: "prompt-assets",
  status: "planned"
} satisfies RagComponentDescriptor
