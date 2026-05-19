export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/pre-retrieval/metadata-acl/source-location-builder",
  runtime: "offline",
  stage: "pre-retrieval",
  area: "metadata-acl",
  status: "planned"
} satisfies RagComponentDescriptor
