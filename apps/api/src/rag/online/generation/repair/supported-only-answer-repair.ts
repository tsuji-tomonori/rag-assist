export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/generation/repair/supported-only-answer-repair",
  runtime: "online",
  stage: "generation",
  area: "repair",
  status: "planned"
} satisfies RagComponentDescriptor
