export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/generation/prompt/prompt-input-builder",
  runtime: "online",
  stage: "generation",
  area: "prompt",
  status: "planned"
} satisfies RagComponentDescriptor
