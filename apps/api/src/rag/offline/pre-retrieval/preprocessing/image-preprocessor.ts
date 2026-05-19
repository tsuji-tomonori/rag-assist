export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/pre-retrieval/preprocessing/image-preprocessor",
  runtime: "offline",
  stage: "pre-retrieval",
  area: "preprocessing",
  status: "planned"
} satisfies RagComponentDescriptor
