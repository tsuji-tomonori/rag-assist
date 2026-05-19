export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/pre-retrieval/auth-scope/user-status-check",
  runtime: "online",
  stage: "pre-retrieval",
  area: "auth-scope",
  status: "planned"
} satisfies RagComponentDescriptor
