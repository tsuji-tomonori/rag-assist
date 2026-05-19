export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/generation/synthetic-data/question-answer-pair-generator",
  runtime: "offline",
  stage: "generation",
  area: "synthetic-data",
  status: "planned"
} satisfies RagComponentDescriptor
