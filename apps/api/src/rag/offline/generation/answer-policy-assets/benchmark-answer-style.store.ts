export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/generation/answer-policy-assets/benchmark-answer-style.store",
  runtime: "offline",
  stage: "generation",
  area: "answer-policy-assets",
  status: "planned"
} satisfies RagComponentDescriptor
