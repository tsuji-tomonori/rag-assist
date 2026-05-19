export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/pre-retrieval/indexing/index-version-store",
  runtime: "offline",
  stage: "pre-retrieval",
  area: "indexing",
  status: "planned"
} satisfies RagComponentDescriptor
