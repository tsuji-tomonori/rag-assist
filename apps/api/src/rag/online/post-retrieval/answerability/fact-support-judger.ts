export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/post-retrieval/answerability/fact-support-judger",
  runtime: "online",
  stage: "post-retrieval",
  area: "answerability",
  status: "planned"
} satisfies RagComponentDescriptor
