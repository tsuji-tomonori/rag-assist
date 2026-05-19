export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/pre-retrieval/planning/question-requirement-slot-detector",
  runtime: "online",
  stage: "pre-retrieval",
  area: "planning",
  status: "planned"
} satisfies RagComponentDescriptor
