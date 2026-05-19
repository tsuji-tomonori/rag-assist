export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/generation/verification/answer-support-verifier",
  runtime: "online",
  stage: "generation",
  area: "verification",
  status: "planned"
} satisfies RagComponentDescriptor
