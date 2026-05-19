export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "_shared/types/trace",
  runtime: "shared",
  stage: "_shared",
  area: "types",
  status: "planned"
} satisfies RagComponentDescriptor
