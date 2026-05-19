export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/generation/verification/claim-extractor",
  runtime: "online",
  stage: "generation",
  area: "verification",
  status: "planned"
} satisfies RagComponentDescriptor
