export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "_shared/policies/context-policy",
  runtime: "shared",
  stage: "_shared",
  area: "policies",
  status: "planned"
} satisfies RagComponentDescriptor
