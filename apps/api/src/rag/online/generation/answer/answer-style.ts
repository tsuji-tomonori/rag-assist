export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/generation/answer/answer-style",
  runtime: "online",
  stage: "generation",
  area: "answer",
  status: "planned"
} satisfies RagComponentDescriptor
