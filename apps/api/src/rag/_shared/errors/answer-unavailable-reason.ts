export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "_shared/errors/answer-unavailable-reason",
  runtime: "shared",
  stage: "_shared",
  area: "errors",
  status: "planned"
} satisfies RagComponentDescriptor
