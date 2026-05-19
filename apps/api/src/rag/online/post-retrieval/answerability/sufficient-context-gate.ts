export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/post-retrieval/answerability/sufficient-context-gate",
  runtime: "online",
  stage: "post-retrieval",
  area: "answerability",
  status: "planned"
} satisfies RagComponentDescriptor
