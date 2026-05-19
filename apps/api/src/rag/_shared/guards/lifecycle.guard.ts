export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "_shared/guards/lifecycle.guard",
  runtime: "shared",
  stage: "_shared",
  area: "guards",
  status: "planned"
} satisfies RagComponentDescriptor
