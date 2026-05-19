export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/pre-retrieval/normalization/text-cleaner",
  runtime: "offline",
  stage: "pre-retrieval",
  area: "normalization",
  status: "planned"
} satisfies RagComponentDescriptor
