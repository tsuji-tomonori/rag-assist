export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "online/post-retrieval/compression/extractive-compressor",
  runtime: "online",
  stage: "post-retrieval",
  area: "compression",
  status: "planned"
} satisfies RagComponentDescriptor
